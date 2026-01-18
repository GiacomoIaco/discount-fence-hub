# Jobber API Sync Implementation Plan

## Goal
Replace CSV-based Residential Analytics dashboard with live API data, using webhooks for real-time updates.

## Current State (Jan 2025)

| Entity | Count | Notes |
|--------|-------|-------|
| Quotes | 10,528 | Synced from 2024+ |
| Jobs | 4,250 | Synced from 2024+ |
| Requests | 2,000 | Capped during testing - need full sync |
| Opportunities | 7,565 | Computed from quotes |
| Opps with Salesperson | 1,322 | Linked through requests |

### Issues Identified
1. `/analytics/residential` page uses CSV table (`jobber_residential_opportunities`) not API table (`jobber_api_opportunities`)
2. Requests sync was capped at 2,000 for testing
3. Webhooks not implemented - requires manual sync
4. Migration numbering conflicts (247-250 duplicate existing CSV migrations)

---

## Implementation Phases

### Phase 1: Complete Historical Sync
**Goal:** Get all historical data from Jobber API

- [ ] Run full requests sync (remove 100-page cap)
- [ ] Verify total request count matches expectations
- [ ] Recompute opportunities with full salesperson linkage
- [ ] Validate data completeness vs CSV counts

**Estimated requests:** 5,000-8,000 based on quote count

### Phase 2: Switch Dashboard to API Data
**Goal:** Wire `/analytics/residential` to use API tables

- [ ] Review field mapping between CSV and API tables
- [ ] Update components to use `useApiResidentialMetrics` hooks
- [ ] Ensure all metrics calculate correctly:
  - Win rate
  - Speed to quote buckets
  - Revenue buckets
  - Salesperson breakdown
  - Cycle time analysis
- [ ] Test all filters work with API data
- [ ] Keep CSV dashboard as fallback at separate URL

**Key files to update:**
- `src/features/analytics/components/jobber/residential/tabs/*.tsx`
- `src/features/analytics/hooks/jobber/residential/useResidentialOpportunities.ts`

### Phase 3: Webhooks for Real-time Updates
**Goal:** Near real-time data updates without full sync

**Webhook Events to Register:**
| Event | Action |
|-------|--------|
| `quote.created` | Upsert to `jobber_api_quotes` |
| `quote.changed` | Upsert to `jobber_api_quotes` |
| `quote.deleted` | Soft delete or remove |
| `job.created` | Upsert to `jobber_api_jobs` |
| `job.completed` | Update job status |
| `request.created` | Upsert to `jobber_api_requests` |

**Implementation:**
- [ ] Create `netlify/functions/jobber-webhook.ts` handler
- [ ] Verify webhook signature (HMAC)
- [ ] Register webhooks via Jobber API
- [ ] Handle each event type with appropriate upsert
- [ ] Trigger opportunity recompute on relevant changes

**Jobber Webhook Docs:** https://developer.getjobber.com/docs/using_jobbers_api/webhooks

### Phase 4: Scheduled Sync Fallback
**Goal:** Safety net to catch any missed webhooks

- [ ] Create weekly full sync via Netlify scheduled function
- [ ] Run every Sunday at 2am CT (low traffic)
- [ ] Add data validation: compare API counts vs expected
- [ ] Alert if significant discrepancy detected

**Cron schedule:** `0 8 * * 0` (8am UTC = 2am CT on Sundays)

---

## Data Architecture

```
Jobber API
    │
    ├── Webhooks (real-time) ────────────────────┐
    │                                            │
    └── Scheduled Sync (weekly fallback) ────────┤
                                                 │
                                                 ▼
                            ┌────────────────────────────────────┐
                            │         Supabase Tables            │
                            ├────────────────────────────────────┤
                            │ jobber_api_requests                │
                            │   - salesperson (from assessment)  │
                            │   - lead_source                    │
                            │   - assessment dates               │
                            │                                    │
                            │ jobber_api_quotes                  │
                            │   - request_jobber_id (FK)         │
                            │   - amounts, dates, status         │
                            │                                    │
                            │ jobber_api_jobs                    │
                            │   - quote_jobber_id (FK)           │
                            │   - schedule, completion dates     │
                            │                                    │
                            │ jobber_api_opportunities           │
                            │   - Computed aggregation           │
                            │   - salesperson (from request)     │
                            │   - metrics buckets                │
                            └────────────────────────────────────┘
                                                 │
                                                 ▼
                            ┌────────────────────────────────────┐
                            │    /analytics/residential          │
                            │    (Live API Dashboard)            │
                            └────────────────────────────────────┘
```

---

## Migration Cleanup

Current conflicts to resolve:
| My Migration | Conflicts With | Action |
|--------------|----------------|--------|
| 247_add_salesperson_to_requests.sql | 247_fix_opportunity_value_normalization.sql | Rename to 259 |
| 248_add_salesperson_to_compute.sql | 248_fix_warranty_rpc_and_add_trends.sql | Rename to 260 |
| 249*.sql (a,b,c,d) | 249_use_median_for_cycle_times.sql | Rename to 261* |
| 250_update_sync_status.sql | 250b_fix_warranty_all_time.sql | Rename to 262 |

---

## Success Criteria

- [ ] All requests synced (expected 5,000+)
- [ ] Opportunities computed with salesperson coverage > 80%
- [ ] Dashboard metrics match CSV dashboard (within 5% tolerance)
- [ ] Webhooks receiving events and updating data
- [ ] Weekly sync running as fallback
- [ ] No manual intervention needed for data freshness

---

## Notes

- Discount field is synced (`amounts.discountAmount`) but not yet used in dashboard
- Jobber API rate limit: 10,000 points, 500/sec restore
- Background functions have 15-minute timeout
- Keep CSV dashboard at `/analytics/residential-csv` as fallback
