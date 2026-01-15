# Jobber Analytics - Lessons Learned & Implementation Guide

This document captures all critical knowledge from building the Builder Division analytics that should be applied to Residential and future analytics implementations.

## Critical Issue #1: Supabase 1000-Row Default Limit

### Problem
Supabase has a **default limit of 1000 rows** on queries. When the dataset grew beyond 1000 jobs, charts started showing only 3 months of data instead of 12+ months.

### Symptoms
- Monthly charts showing only recent 3-4 months
- Trends page showing incomplete data
- Total counts not matching expected values
- "It used to work" - data grew past the limit

### Solution: Pagination Pattern
```typescript
async function fetchAllJobsWithFilters<T>(
  selectFields: string,
  filters?: JobberFilters,
  dateField: string = 'created_date'
): Promise<T[]> {
  const allJobs: T[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    let query = supabase
      .from('jobber_builder_jobs')
      .select(selectFields)
      .range(offset, offset + pageSize - 1);

    // Apply filters...
    if (filters?.dateRange.start) {
      query = query.gte(dateField, filters.dateRange.start.toISOString().split('T')[0]);
    }
    // ... more filters

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
    if (!data || data.length === 0) break;

    allJobs.push(...(data as T[]));

    // Exit if we got fewer than pageSize (last page)
    if (data.length < pageSize) break;

    offset += pageSize;
  }
  return allJobs;
}
```

### Files That Required This Fix
- `src/features/analytics/hooks/jobber/useJobberJobs.ts` - Main jobs hook
- `src/features/analytics/hooks/jobber/useSalespersonMetrics.ts` - Multiple functions:
  - `fetchAllJobsWithFilters()` helper
  - `fallbackSalespersonMetrics()`
  - `calculateMonthlyTrend()`
  - `useSalespersonDetail()`

---

## Critical Issue #2: React Query Infinite Loop from Filter Objects

### Problem
Passing filter objects directly to React Query caused infinite re-renders because object references change on every render.

### Symptoms
- Console showing endless query fetches
- Browser freezing or becoming unresponsive
- Network tab showing repeated identical requests

### Solution: Memoize Filter Objects
```typescript
// BAD - Creates new object reference every render
const { data } = useJobberJobs({ filters });

// GOOD - Memoize the filters
const memoizedFilters = useMemo((): JobberFilters => ({
  ...filters,
  timePreset: 'custom',
  dateRange: { start: fifteenMonthsAgo, end: new Date() },
}), [filters.salesperson, filters.location, filters.jobSizes]);

const { data } = useJobberJobs({ filters: memoizedFilters });
```

### Key Rule
Always memoize filter objects passed to React Query hooks. List specific primitive dependencies, not the whole filter object.

---

## Critical Issue #3: TypeScript Errors with Database Fields

### Problem
Database fields like `total_revenue` can be `number | null`, but code assumed they were always numbers.

### Solution
```typescript
// BAD
const revenue = job.total_revenue; // Could be null

// GOOD
const revenue = Number(job.total_revenue) || 0;

// For string fields from Record<string, unknown>
const client = String(job.client_name || 'Unknown');
```

---

## Architecture Patterns

### Query Key Naming Convention
All Jobber analytics queries use the `jobber-` prefix:
```typescript
queryKey: ['jobber-jobs', filters]
queryKey: ['jobber-salesperson-metrics', filters]
queryKey: ['jobber-monthly-trend', filters]
queryKey: ['jobber-import-stats', businessUnit]
queryKey: ['jobber-import-logs', businessUnit, limit]
```

This allows:
1. Easy cache invalidation after imports
2. Selective localStorage persistence (only `jobber-*` queries are persisted)

### Cache Persistence
Implemented in `src/lib/queryClient.ts`:
```typescript
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const queryKey = query.queryKey;
      if (Array.isArray(queryKey) && typeof queryKey[0] === 'string') {
        return queryKey[0].startsWith('jobber-');
      }
      return false;
    },
  },
});
```

### Import Invalidation
When new data is uploaded, all related queries are invalidated:
```typescript
// In useJobberImport.ts after successful import
await queryClient.invalidateQueries({ queryKey: ['jobber-jobs'] });
await queryClient.invalidateQueries({ queryKey: ['jobber-salesperson-metrics'] });
await queryClient.invalidateQueries({ queryKey: ['jobber-monthly-trend'] });
// etc.
```

---

## Data Model Insights

### Key Date Fields
| Field | Purpose | Use Case |
|-------|---------|----------|
| `created_date` | When job entered system | Sales activity trends |
| `scheduled_start_date` | When work planned | Scheduling efficiency |
| `closed_date` | When job completed | Actual performance, monthly reports |

### Job Size Categories (Revenue-Based)
```typescript
if (revenue > 500) {
  // Standard job - substantial work
} else if (revenue > 0) {
  // Small job ($1-500) - minor work, repairs
} else {
  // Warranty job ($0) - no revenue
}
```

### Effective Salesperson
The `effective_salesperson` field is computed during import:
- Uses name normalization map to handle variations
- Falls back through multiple raw fields
- Stored as computed field in database

---

## Column Mapping (Builder Division)

Located in `src/features/analytics/services/jobber/columnMapper.ts`:

### Key Builder-Specific Columns
```typescript
// Builder custom fields
'Builder Rep': 'builder_rep_raw',
'BUILDER REP': 'builder_rep_raw',  // Handle case variations
'Community': 'community',
'COMMUNITY': 'community',
'Super name': 'super_name',
'Super email': 'super_email',
'FRANCHISE LOCATION': 'franchise_location',
'STANDARD PRODUCT': 'standard_product',
```

### For Residential
Will need different column mappings for residential-specific custom fields.

---

## UI Components Structure

### Dashboard Tabs
```
Overview    → Executive summary, monthly chart, location/project breakdown
Trends      → 12-month matrix by salesperson/client (date field configurable)
Salespeople → Leaderboard with drill-down
Clients     → Client and community analysis
Pipeline    → Quote pipeline tracking
Cycle Time  → Scheduling and completion metrics
Reports     → Import history, monthly AI reports
```

### Full-Width Layout
Analytics is now a "hub section" in App.tsx:
```typescript
const isHubSection = ... || activeSection === 'analytics';
```

This removes the `max-w-7xl` container constraint and auto-collapses sidebar.

---

## Database Schema Reference

### Main Table: `jobber_builder_jobs`
Key fields:
- `job_number` (unique key for UPSERT)
- `client_name`, `client_email`, `client_phone`
- `service_street`, `service_city`, `service_state`, `service_zip`
- `created_date`, `scheduled_start_date`, `closed_date`
- `total_revenue`, `total_costs`, `profit`
- `effective_salesperson` (computed)
- `is_substantial`, `is_warranty` (computed from revenue)
- `days_to_schedule`, `days_to_close`, `total_cycle_days` (computed)

### Import Logs: `jobber_import_logs`
Tracks each CSV upload with:
- `business_unit` ('builder' | 'residential')
- `report_type` ('jobs' | 'quotes' | 'invoices')
- `data_start_date`, `data_end_date` (from CSV content)
- `total_rows`, `new_records`, `updated_records`

---

## Testing Checklist for New Analytics

1. [ ] Upload small dataset (~100 rows) - verify basic functionality
2. [ ] Upload large dataset (1000+ rows) - verify pagination works
3. [ ] Check all date fields work (created/scheduled/closed)
4. [ ] Verify cache invalidation after upload
5. [ ] Test browser refresh - data should load from cache
6. [ ] Check filter combinations don't cause infinite loops
7. [ ] Verify monthly reports show all months with data
8. [ ] Test Trends page with both weekly and monthly views

---

## Files to Create/Modify for Residential

### New Files Needed
1. `jobber_residential_jobs` table migration
2. Column mapper for residential fields
3. Hooks: `useResidentialJobs.ts`, `useResidentialMetrics.ts`
4. Components: Residential-specific dashboard components

### Files to Modify
1. `JobberDataTab.tsx` - Add residential tab functionality
2. `importService.ts` - Support residential business unit
3. `columnMapper.ts` - Add residential column mappings
4. Various hooks - Support residential query keys

---

## Performance Notes

- Dataset size: ~8,000 jobs for Builder (24 months)
- Pagination fetches: 8-9 pages of 1000 rows each
- Cache persistence: 7 days max, ~2-3MB in localStorage
- Initial load: ~2-3 seconds (all jobs)
- Subsequent loads: Instant (from cache)
- After upload: Cache invalidated, fresh fetch

---

## Common Gotchas

1. **Date parsing**: Jobber exports dates in various formats (MM/DD/YYYY, YYYY-MM-DD). The `parseDate()` function handles this.

2. **Currency parsing**: Remove `$` and `,` before parsing numbers:
   ```typescript
   const cleanValue = value.replace(/[$,%]/g, '').replace(/,/g, '').trim();
   ```

3. **Column name case sensitivity**: Always map both cases:
   ```typescript
   'Community': 'community',
   'COMMUNITY': 'community',
   ```

4. **Empty vs null dates**: Check for both when filtering:
   ```typescript
   if (!job.closed_date) continue; // Handles null and undefined
   ```

5. **Partial month reporting**: Current month uses today's date as end, not month end.
