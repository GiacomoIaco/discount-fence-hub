# Jobber API Residential Analytics - Lessons Learned

This document captures key insights and lessons learned while building and fixing the residential analytics dashboard that uses Jobber API data.

---

## Table of Contents
1. [Data Model & Relationships](#data-model--relationships)
2. [Opportunity Normalization](#opportunity-normalization)
3. [Column Naming Conventions](#column-naming-conventions)
4. [Win Rate Calculations](#win-rate-calculations)
5. [Cycle Time Metrics](#cycle-time-metrics)
6. [Performance Considerations](#performance-considerations)
7. [Common Pitfalls](#common-pitfalls)
8. [Data Sync Gaps](#data-sync-gaps)

---

## Data Model & Relationships

### Core Tables
```
jobber_api_requests    → Assessment/lead intake
jobber_api_quotes      → Quote proposals
jobber_api_jobs        → Scheduled work
jobber_api_opportunities → Computed aggregation (not synced directly)
```

### Relationship Flow
```
Request → Quote(s) → Job(s) → Invoice(s)
   ↓         ↓          ↓
   └─────────┴──────────┴──→ Opportunity (computed)
```

### Key Foreign Keys
| From Table | Field | To Table | Field |
|------------|-------|----------|-------|
| `jobs` | `quote_jobber_id` | `quotes` | `jobber_id` |
| `requests` | `quote_jobber_ids[]` | `quotes` | `jobber_id` |
| `opportunities` | `quote_jobber_ids[]` | `quotes` | `jobber_id` |

---

## Opportunity Normalization

### How Opportunities Are Grouped
Opportunities are **computed** from quotes, grouped by **client name + property address**:

```sql
opportunity_key = LOWER(TRIM(client_name)) || '|' ||
                  LOWER(REGEXP_REPLACE(service_street, '[^a-z0-9]', '', 'gi'))
```

### Why This Matters
- **Same client, different properties** = **separate opportunities**
- A client with 3 properties gets 3 separate opportunity records
- This prevents over-counting and allows accurate property-level analytics

### Example
| Client | Property | Opportunity Key |
|--------|----------|-----------------|
| John Smith | 123 Main St | `john smith|123mainst` |
| John Smith | 456 Oak Ave | `john smith|456oakave` |

---

## Column Naming Conventions

### Request Table (`jobber_api_requests`)
| Expected Name | Actual Column | Purpose |
|---------------|---------------|---------|
| `created_date` | `created_at_jobber` | When request was created in Jobber |
| `assessment_date` | `assessment_start_at` | Scheduled assessment time |
| `assessment_completed` | `assessment_completed_at` | When assessment was done |
| `converted_to_quote` | `quote_jobber_ids` (array) | Linked quotes |

### Quote Table (`jobber_api_quotes`)
| Column | Purpose |
|--------|---------|
| `jobber_id` | Unique Jobber identifier (base64 encoded) |
| `sent_at` | When quote was sent to customer |
| `converted_at` | When quote was accepted |
| `status` | `'draft'`, `'sent'`, `'converted'`, `'archived'` |

### Job Table (`jobber_api_jobs`)
| Column | Purpose |
|--------|---------|
| `quote_jobber_id` | Links to parent quote |
| `scheduled_start_at` | When job is scheduled |
| `completed_at` | When job was marked complete |
| `closed_at` | When job was closed (invoiced) |

---

## Win Rate Calculations

### Two Types of Win Rate

#### 1. Overall Win Rate (Recommended)
```sql
win_rate = won / total
```
- **Use this for dashboards** - reflects reality
- Many lost opportunities are never formally recorded as "lost"
- Shows ~35% win rate (realistic)

#### 2. Closed Win Rate
```sql
closed_win_rate = won / (won + lost)
```
- Only includes opportunities explicitly marked won or lost
- Shows ~75% (misleadingly high)
- Useful for "of deals we tracked to completion, what % won?"

### Status Flag Logic
```sql
-- An opportunity is WON if any quote was converted
is_won = BOOL_OR(quote.status = 'converted')

-- An opportunity is LOST if any quote was archived AND none converted
is_lost = BOOL_OR(quote.status = 'archived') AND NOT BOOL_OR(quote.status = 'converted')

-- An opportunity is PENDING if neither won nor lost
is_pending = NOT is_won AND NOT is_lost
```

---

## Cycle Time Metrics

### Timeline
```
Request    Assessment    Quote Sent    Accepted    Scheduled    Closed
Created       ↓              ↓            ↓            ↓           ↓
   │          │              │            │            │           │
   ├──────────┤              │            │            │           │
   │ Days to Assessment      │            │            │           │
   │                         │            │            │           │
   ├─────────────────────────┤            │            │           │
   │      Days to Quote                   │            │           │
   │                                      │            │           │
   │                         ├────────────┤            │           │
   │                         │ Days to Decision        │           │
   │                                      │            │           │
   │                                      ├────────────┤           │
   │                                      │ Days to Schedule       │
   │                                                   │           │
   │                                                   ├───────────┤
   │                                                   │ Days to Close
   │                                                               │
   ├───────────────────────────────────────────────────────────────┤
   │                    Total Cycle Days                           │
```

### Calculations
| Metric | Formula | Source |
|--------|---------|--------|
| Days to Quote | `first_sent_date - assessment_date` | Quote + Request |
| Days to Decision | `won_date - first_sent_date` | Quote |
| Days to Schedule | `scheduled_date - won_date` | Job |
| Days to Close | `closed_date - scheduled_date` | Job |
| Total Cycle | `closed_date - assessment_date` | Request + Job |

### Data Dependencies
- **Days to Quote** requires: `assessment_date` (from request linkage)
- **Days to Schedule/Close** requires: `scheduled_date`, `closed_date` (from job linkage)
- **Total Cycle** requires: both request AND job linkage

---

## Performance Considerations

### Problem: Function Timeouts
The `compute_api_opportunities()` function was timing out because it:
1. Truncates and rebuilds all opportunities
2. Runs complex JOINs across large tables
3. Updates job linkage using array containment (`@>`)

### Solution: Separate the Updates
```sql
-- BAD: All in one function (times out)
CREATE FUNCTION compute_api_opportunities() AS $$
  -- Insert opportunities
  -- Update job linkage (THIS TIMES OUT)
  -- Update cycle times
$$;

-- GOOD: Run linkage separately
CREATE FUNCTION compute_api_opportunities() AS $$
  -- Insert opportunities only
$$;

-- Then run job linkage as separate migration/script
UPDATE opportunities SET job_data = ...
FROM (SELECT ... JOIN jobs ...) sub;
```

### Efficient Job Linkage Query
```sql
-- Use JOIN with ANY() instead of @> for better performance
UPDATE jobber_api_opportunities o
SET scheduled_date = agg.scheduled_date, ...
FROM (
    SELECT o2.id, MIN(j.scheduled_start_at::DATE) AS scheduled_date
    FROM jobber_api_opportunities o2
    JOIN jobber_api_jobs j ON j.quote_jobber_id = ANY(o2.quote_jobber_ids)
    GROUP BY o2.id
) agg
WHERE o.id = agg.opp_id;
```

---

## Common Pitfalls

### 1. Wrong Column Names
```sql
-- WRONG (column doesn't exist)
WHERE r.created_date >= p_start_date

-- RIGHT
WHERE r.created_at_jobber >= p_start_date
```

### 2. Bucket Name Mismatches
Frontend expects specific bucket names:
```javascript
// Frontend filter options
['1 quote', '2 quotes', '3 quotes', '4+ quotes']
```

```sql
-- WRONG (doesn't match frontend)
CASE WHEN quote_count = 1 THEN 'Single Quote' ...

-- RIGHT
CASE WHEN quote_count = 1 THEN '1 quote' ...
```

### 3. NULL Handling in Averages
```sql
-- WRONG: Returns NULL if any value is NULL
AVG(days_to_schedule)

-- RIGHT: Filter to only include non-NULL values
AVG(days_to_schedule) FILTER (WHERE days_to_schedule IS NOT NULL)
```

### 4. Division by Zero
```sql
-- WRONG: Can throw error
100.0 * won / total

-- RIGHT: Handle zero denominator
CASE WHEN total = 0 THEN 0 ELSE 100.0 * won / total END
-- or
100.0 * won / NULLIF(total, 0)
```

---

## Data Sync Gaps

### Known Gaps in Current Sync

| Data | Status | Impact |
|------|--------|--------|
| Request → Quote linkage | **Not populated** | `converted_to_quote` always 0 |
| Quote `sent_at` | Populated | Used for cycle times |
| Job `scheduled_start_at` | Populated | Used for Days to Schedule |
| Job `closed_at` | Partially populated | Some jobs never closed |

### Request → Quote Linkage Issue
The `quote_jobber_ids` field in `jobber_api_requests` is not being populated during sync. This means:
- Cannot track request → quote conversion rate accurately
- Must use other methods to estimate conversion

### Recommendation
Update the Jobber sync process to:
1. When syncing quotes, check for matching requests (by client + property)
2. Update `jobber_api_requests.quote_jobber_ids` with matched quote IDs

---

## Quick Reference

### Key Migrations
| Migration | Purpose |
|-----------|---------|
| `245_jobber_api_residential.sql` | Initial API functions |
| `265_fix_api_is_lost_logic.sql` | Fix is_lost calculation |
| `270_fix_api_metrics_formulas.sql` | Win rate, multi-quote, total value |
| `271_fix_request_and_job_linkage.sql` | Request column names, job linkage |

### Key Functions
| Function | Purpose |
|----------|---------|
| `compute_api_opportunities()` | Rebuild opportunities from quotes |
| `get_api_residential_funnel_metrics()` | Main dashboard metrics |
| `get_api_residential_salesperson_metrics()` | Per-salesperson breakdown |
| `get_api_residential_request_metrics()` | Request/assessment metrics |

### Coverage Stats (as of Jan 2026)
- Total opportunities: 7,565
- With salesperson: 81%
- With assessment_date: 82%
- Won opps with job linkage: 97%
