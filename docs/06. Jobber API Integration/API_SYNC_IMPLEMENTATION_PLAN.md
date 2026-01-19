# Jobber API Sync Implementation Plan

## Goal
Replace CSV-based Residential Analytics dashboard with live API data, using webhooks for real-time updates.

## Current State (Jan 2026)

| Entity | Count | Notes |
|--------|-------|-------|
| Quotes | 10,528 | Synced from 2024+ |
| Jobs | 4,250 | Synced from 2024+ |
| Requests | 10,328 | ✓ Full sync completed |
| Opportunities | 7,565 | Computed from quotes |
| **Opps with Salesperson** | **6,148 (81.3%)** | ✓ Above 80% target |

### Phase 1 Completed (Jan 19, 2026)
- Full requests sync completed (10,328 requests)
- Salesperson coverage now 81.3% (up from 17.5%)
- Key fixes: reduced PAGE_SIZE to 35 (query cost was >10K), added token refresh

### Remaining Issues
1. `/analytics/residential` page uses CSV table (`jobber_residential_opportunities`) not API table (`jobber_api_opportunities`)
2. Webhooks not implemented - requires manual sync
3. Migration files need cleanup (duplicates 246*, 249*, 250*)

---

## Implementation Phases

### Phase 1: Complete Historical Sync ✓ COMPLETED
**Goal:** Get all historical data from Jobber API

- [x] Run full requests sync (removed cap, fixed query cost issue)
- [x] Verify total request count: 10,328 requests synced
- [x] Recompute opportunities with full salesperson linkage
- [x] Validate salesperson coverage: 81.3% (6,148/7,565)

**Actual requests synced:** 10,328

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

**Status:** Untracked migration files need cleanup. Next available migration: **259**

| File | Status | Action |
|------|--------|--------|
| 246_optimize_compute_opportunities.sql | Untracked | Delete or rename to 259 |
| 246b,c,d_*.sql | Untracked | Delete (step-by-step versions) |
| 248_add_salesperson_to_compute.sql | Applied via migrate:direct | Track or delete |
| 249_recompute_opportunities.sql | Untracked | Delete |
| 249a,b,c,d_*.sql | Applied via migrate:direct | Delete (one-time use) |
| 250_update_sync_status.sql | Untracked | Delete or rename to 259 |

---

## Success Criteria

- [x] All requests synced: 10,328 (expected 5,000+) ✓
- [x] Opportunities with salesperson coverage > 80%: 81.3% ✓
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
