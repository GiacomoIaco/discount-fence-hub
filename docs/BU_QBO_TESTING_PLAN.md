# BU / QBO Class Normalization - Testing Plan

## Overview

This document outlines the testing strategy for validating the BU/QBO normalization migration.

---

## Pre-Migration Baseline Tests

Before any changes, document current behavior:

### T-000: Baseline Data Capture
```sql
-- Run and save results before migration
SELECT COUNT(*) as client_count FROM clients;
SELECT COUNT(*) as community_count FROM communities;
SELECT COUNT(*) as territory_count FROM territories;
SELECT COUNT(*) as crew_count FROM crews;
SELECT COUNT(*) as labor_rate_count FROM labor_rates;

-- Capture sample data
SELECT id, name, business_unit, default_qbo_class_id FROM clients LIMIT 10;
SELECT id, name, geography_id FROM communities LIMIT 10;
SELECT id, name, code, business_unit_id FROM territories;
SELECT id, name, code, business_unit_id FROM crews;
```

---

## Phase 0 Tests: Preparation

### T-001: Locations Table Created
| Test | Expected | Status |
|------|----------|--------|
| `locations` table exists | Table created | [ ] |
| Has 3 rows (ATX, SA, HOU) | 3 rows | [ ] |
| Codes are unique | No duplicates | [ ] |

```sql
SELECT * FROM locations ORDER BY code;
-- Expected: ATX/Austin, HOU/Houston, SA/San Antonio
```

### T-002: QBO Classes Enhanced
| Test | Expected | Status |
|------|----------|--------|
| `bu_type` column exists | Column added | [ ] |
| `location_code` column exists | Column added | [ ] |
| `labor_code` column exists | Column added | [ ] |
| Austin Residential mapped correctly | bu_type='residential', location_code='ATX', labor_code='ATX-RES' | [ ] |
| Austin Builder mapped correctly | bu_type='builders', location_code='ATX', labor_code='ATX-HB' | [ ] |
| Commercial mapped correctly | bu_type='commercial', location_code=NULL, labor_code='COM' | [ ] |

```sql
SELECT id, name, bu_type, location_code, labor_code
FROM qbo_classes
WHERE is_selectable = true
ORDER BY name;
```

### T-003: Clients Have Location Column
| Test | Expected | Status |
|------|----------|--------|
| `default_location` column exists | Column added | [ ] |
| Existing clients not broken | All 62 clients accessible | [ ] |

```sql
SELECT COUNT(*) FROM clients;
SELECT id, name, business_unit, default_location FROM clients LIMIT 5;
```

### T-004: Existing Features Still Work
| Test | Expected | Status |
|------|----------|--------|
| Client Hub loads | Page renders | [ ] |
| Client list displays | 62 clients shown | [ ] |
| Client editor opens | Modal works | [ ] |
| BOM Calculator loads | Page renders | [ ] |
| Labor Rates page loads | 170 rates shown | [ ] |
| Territory list displays | 4 territories shown | [ ] |

---

## Phase 1 Tests: Territories

### T-101: Territory Migration
| Test | Expected | Status |
|------|----------|--------|
| `location_code` column exists | Column added | [ ] |
| `disabled_qbo_class_ids` column exists | Column added | [ ] |
| All territories have location_code | No NULLs | [ ] |
| Location codes are valid | All match locations.code | [ ] |

```sql
SELECT
  t.id, t.name, t.code,
  t.location_code,
  t.disabled_qbo_class_ids,
  t.business_unit_id -- Should be NULL after migration
FROM territories t;
```

### T-102: Territory Functionality
| Test | Expected | Status |
|------|----------|--------|
| Territory list loads | All territories shown | [ ] |
| Territory editor opens | Modal works | [ ] |
| Can edit territory location | Saves correctly | [ ] |
| Can disable QBO class for territory | Array updates | [ ] |
| Territory filtering by location works | Correct results | [ ] |

### T-103: Territory → Request Flow
| Test | Expected | Status |
|------|----------|--------|
| ZIP code detects correct territory | Matches ZIP list | [ ] |
| Territory suggests correct reps | Based on location | [ ] |

---

## Phase 2 Tests: Communities

### T-201: Community Migration
| Test | Expected | Status |
|------|----------|--------|
| `location_code` column exists | Column added | [ ] |
| All communities with geography have location | Mapped correctly | [ ] |
| geography_id column removed | Column dropped | [ ] |

```sql
SELECT
  c.id, c.name,
  c.location_code,
  c.geography_id -- Should not exist after migration
FROM communities c
LIMIT 10;
```

### T-202: Community Functionality
| Test | Expected | Status |
|------|----------|--------|
| Community list loads | 354 communities shown | [ ] |
| Community editor opens | Modal works | [ ] |
| Can set community location | Saves correctly | [ ] |
| Community detail page loads | All data shown | [ ] |

---

## Phase 3 Tests: Crews

### T-301: Crew Migration
| Test | Expected | Status |
|------|----------|--------|
| `location_code` column exists | Column added | [ ] |
| All crews with BU have location | Mapped correctly | [ ] |
| business_unit_id column removed | Column dropped | [ ] |

```sql
SELECT
  c.id, c.name, c.code,
  c.location_code,
  c.business_unit_id -- Should not exist after migration
FROM crews c;
```

### T-301: Crew Functionality
| Test | Expected | Status |
|------|----------|--------|
| Crew list loads | All crews shown | [ ] |
| Crew editor opens | Modal works | [ ] |
| Can set crew location | Saves correctly | [ ] |
| Crew assignment in jobs works | Filters by location | [ ] |

---

## Phase 4 Tests: Transactions

### T-401: QBO Class on Transactions
| Test | Expected | Status |
|------|----------|--------|
| service_requests has qbo_class_id | Column exists | [ ] |
| quotes has qbo_class_id | Column exists | [ ] |
| jobs has qbo_class_id | Column exists | [ ] |

### T-402: QBO Class Derivation
| Test | Expected | Status |
|------|----------|--------|
| New request inherits client QBO class | Auto-populated | [ ] |
| Can override QBO class on request | Override works | [ ] |
| QBO class persists to quote | Inherited correctly | [ ] |
| QBO class persists to job | Inherited correctly | [ ] |

**Test Scenario:**
1. Create client: BU=builders, Location=ATX
2. Verify default_qbo_class_id = "Austin Builder" (id: 588453)
3. Create request for this client
4. Verify request.qbo_class_id = "588453"
5. Convert to quote
6. Verify quote.qbo_class_id = "588453"

---

## Phase 5 Tests: Labor Rates

### T-501: Labor Rate Lookup via QBO Class
| Test | Expected | Status |
|------|----------|--------|
| Can get labor_code from qbo_class | Returns ATX-RES, etc. | [ ] |
| Can lookup rates via labor_code | Returns correct rates | [ ] |
| BOM Calculator still works | Prices calculate correctly | [ ] |

```sql
-- New query path
SELECT
  qc.name as qbo_class,
  qc.labor_code,
  lc.labor_sku,
  lc.description,
  lr.rate
FROM qbo_classes qc
JOIN business_units bu ON qc.labor_code = bu.code
JOIN labor_rates lr ON bu.id = lr.business_unit_id
JOIN labor_codes lc ON lr.labor_code_id = lc.id
WHERE qc.name = 'Austin Residential'
LIMIT 5;
```

### T-502: BOM Calculator Regression
| Test | Expected | Status |
|------|----------|--------|
| SKU Catalog loads | All SKUs shown | [ ] |
| SKU Builder calculates prices | Correct totals | [ ] |
| Project Calculator works | Correct labor costs | [ ] |
| Labor Rates page works | All 170 rates editable | [ ] |

---

## Phase 6 Tests: Cleanup

### T-601: Geographies Removed
| Test | Expected | Status |
|------|----------|--------|
| geographies table dropped | Table doesn't exist | [ ] |
| GeographiesList component removed | File deleted | [ ] |
| No references to geography_id | No errors | [ ] |

### T-602: UI Updates Complete
| Test | Expected | Status |
|------|----------|--------|
| Client editor shows Location dropdown | UI updated | [ ] |
| Community editor shows Location dropdown | UI updated | [ ] |
| Territory editor shows Location + QBO toggles | UI updated | [ ] |
| Crew editor shows Location dropdown | UI updated | [ ] |
| Request editor derives QBO class | Auto-fills correctly | [ ] |

---

## Integration Tests

### IT-001: Full Client → Job Flow
```
1. Create new client
   - Set business_unit = 'builders'
   - Set default_location = 'ATX'
   - Verify default_qbo_class_id = 'Austin Builder' (588453)

2. Create community for client
   - Verify location inherited or selectable

3. Create request
   - Select client
   - Verify qbo_class_id auto-populated
   - Verify territory detected from ZIP

4. Convert to quote
   - Verify qbo_class_id inherited
   - Verify labor rates use ATX-HB rates

5. Convert to job
   - Verify qbo_class_id inherited
   - Assign crew (filtered by location)
```

### IT-002: Commercial Client Flow
```
1. Create new client
   - Set business_unit = 'commercial'
   - Location can be anything (or null)
   - Verify default_qbo_class_id = 'Commercial' (588439)

2. Create request
   - Verify qbo_class_id = Commercial regardless of location
```

### IT-003: Location Override Flow
```
1. Client: BU=builders, Location=ATX (default: Austin Builder)
2. Create request
3. Override qbo_class_id to 'San Antonio Builder'
4. Verify labor rates now use SA-HB
```

---

## Performance Tests

### PT-001: Query Performance
| Query | Max Time | Status |
|-------|----------|--------|
| Load all clients with QBO class | < 500ms | [ ] |
| Load all territories with location | < 200ms | [ ] |
| Labor rate lookup by QBO class | < 100ms | [ ] |
| BOM Calculator full recalc | < 2s | [ ] |

---

## Rollback Tests

### RT-001: Phase 0 Rollback
| Test | Expected | Status |
|------|----------|--------|
| Can drop new columns | No errors | [ ] |
| Can drop locations table | No errors | [ ] |
| Original features still work | No regression | [ ] |

---

## User Acceptance Tests

### UAT-001: Client Hub
- [ ] Can view all clients
- [ ] Can create client with Location
- [ ] Can edit client Location
- [ ] BU badge displays correctly
- [ ] QBO Class badge displays correctly

### UAT-002: Requests Hub
- [ ] Can create request
- [ ] QBO Class auto-fills from client
- [ ] Can override QBO Class
- [ ] Territory detection works

### UAT-003: BOM Calculator
- [ ] Labor rates display correctly
- [ ] Can edit labor rates
- [ ] SKU pricing uses correct rates
- [ ] Prices match pre-migration values

### UAT-004: Settings
- [ ] Can manage Locations
- [ ] Can manage Territories with Location
- [ ] Can disable QBO classes per Territory

---

## Sign-Off Checklist

| Phase | Dev Complete | QA Complete | UAT Complete | Production |
|-------|--------------|-------------|--------------|------------|
| Phase 0 | [ ] | [ ] | [ ] | [ ] |
| Phase 1 | [ ] | [ ] | [ ] | [ ] |
| Phase 2 | [ ] | [ ] | [ ] | [ ] |
| Phase 3 | [ ] | [ ] | [ ] | [ ] |
| Phase 4 | [ ] | [ ] | [ ] | [ ] |
| Phase 5 | [ ] | [ ] | [ ] | [ ] |
| Phase 6 | [ ] | [ ] | [ ] | [ ] |

---

## Test Data Requirements

### Before Migration
- [ ] Backup all tables
- [ ] Export current labor rates to CSV
- [ ] Document sample BOM calculations for comparison

### Test Accounts
- [ ] Client with BU=residential, no location
- [ ] Client with BU=builders, no location
- [ ] Client with BU=commercial
- [ ] Community with geography assigned
- [ ] Community without geography

---

## Notes

- Run all SQL tests against a **staging database first**
- Document any data anomalies found during migration
- Keep migration scripts idempotent (safe to run multiple times)
- Maintain ability to rollback at each phase
