# BU / QBO Class Normalization Plan

## Overview

This document outlines the plan to normalize and clarify the Business Unit, Location, and QBO Class concepts throughout the application.

**Goal:** Create clear separation between:
- **Location** = Geographic market (Austin, San Antonio, Houston)
- **BU Type** = Organizational unit (Residential, Builders, Commercial)
- **QBO Class** = QuickBooks accounting class (derived from Location + BU Type)
- **Labor Code** = Internal code for labor rate lookup (ATX-RES, ATX-HB)

---

## Current State Summary

| Table | Rows | Current Purpose |
|-------|------|-----------------|
| `qbo_classes` | 19 | QuickBooks P&L classes (synced) |
| `business_units` | 6 | Labor rate groupings (ATX-RES, etc.) |
| `geographies` | 4 | Legacy labor rate zones (TO DELETE) |
| `labor_codes` | 29 | Labor activity definitions |
| `labor_rates` | 170 | Junction: labor_code × business_unit = rate |
| `clients` | 62 | Has `business_unit` enum, no location |
| `communities` | 354 | Has `geography_id` FK |
| `territories` | 4 | Has `business_unit_id` FK |
| `crews` | 1 | Has `business_unit_id` FK |

---

## Phase 0: Preparation (Non-Destructive)

### 0.1 Create `locations` Table
```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- 'ATX', 'SA', 'HOU'
  name VARCHAR(100) NOT NULL,        -- 'Austin', 'San Antonio', 'Houston'
  state VARCHAR(2) DEFAULT 'TX',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed from existing business_units.location
INSERT INTO locations (code, name, state) VALUES
  ('ATX', 'Austin', 'TX'),
  ('SA', 'San Antonio', 'TX'),
  ('HOU', 'Houston', 'TX');
```

### 0.2 Add Columns to `qbo_classes`
```sql
ALTER TABLE qbo_classes
  ADD COLUMN bu_type VARCHAR(20),       -- 'residential', 'builders', 'commercial'
  ADD COLUMN location_code VARCHAR(10), -- 'ATX', 'SA', 'HOU', NULL for Commercial
  ADD COLUMN labor_code VARCHAR(20);    -- 'ATX-RES', 'ATX-HB', 'COM', etc.
```

### 0.3 Populate `qbo_classes` New Columns
```sql
-- Map QBO Classes to their components
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'ATX', labor_code = 'ATX-RES'
  WHERE name = 'Austin Residential';
UPDATE qbo_classes SET bu_type = 'builders', location_code = 'ATX', labor_code = 'ATX-HB'
  WHERE name = 'Austin Builder';
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'SA', labor_code = 'SA-RES'
  WHERE name = 'San Antonio Residential';
UPDATE qbo_classes SET bu_type = 'builders', location_code = 'SA', labor_code = 'SA-HB'
  WHERE name = 'San Antonio Builder';
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'HOU', labor_code = 'HOU-RES'
  WHERE name = 'Houston Residential';
UPDATE qbo_classes SET bu_type = 'builders', location_code = 'HOU', labor_code = 'HOU-HB'
  WHERE name = 'Houston Builder';
UPDATE qbo_classes SET bu_type = 'commercial', location_code = NULL, labor_code = 'COM'
  WHERE name = 'Commercial';
```

### 0.4 Add `default_location` to `clients`
```sql
ALTER TABLE clients
  ADD COLUMN default_location VARCHAR(10); -- 'ATX', 'SA', 'HOU'

-- NOTE: Will need manual population or UI update for existing clients
```

---

## Phase 1: Update Territories

### 1.1 Add New Columns to `territories`
```sql
ALTER TABLE territories
  ADD COLUMN location_code VARCHAR(10),
  ADD COLUMN disabled_qbo_class_ids TEXT[] DEFAULT '{}';

-- Add FK constraint
ALTER TABLE territories
  ADD CONSTRAINT fk_territories_location
  FOREIGN KEY (location_code) REFERENCES locations(code);
```

### 1.2 Migrate Existing Territory Data
```sql
-- Map existing business_unit_id to location_code
UPDATE territories t
SET location_code = bu.location
FROM business_units bu
WHERE t.business_unit_id = bu.id;
```

### 1.3 Drop Old FK (After verification)
```sql
-- Only after confirming location_code is populated correctly
ALTER TABLE territories DROP COLUMN business_unit_id;
```

---

## Phase 2: Update Communities

### 2.1 Add `location_code` to Communities
```sql
ALTER TABLE communities
  ADD COLUMN location_code VARCHAR(10);

-- Migrate from geographies
UPDATE communities c
SET location_code = CASE g.code
  WHEN 'AUS' THEN 'ATX'
  WHEN 'SAT' THEN 'SA'
  WHEN 'HOU' THEN 'HOU'
  WHEN 'DFW' THEN 'DFW'
  ELSE NULL
END
FROM geographies g
WHERE c.geography_id = g.id;
```

### 2.2 Drop `geography_id` (After verification)
```sql
ALTER TABLE communities DROP COLUMN geography_id;
```

---

## Phase 3: Update Crews

### 3.1 Add `location_code` to Crews
```sql
ALTER TABLE crews
  ADD COLUMN location_code VARCHAR(10);

-- Migrate from business_units
UPDATE crews c
SET location_code = bu.location
FROM business_units bu
WHERE c.business_unit_id = bu.id;
```

### 3.2 Drop Old FK (After verification)
```sql
ALTER TABLE crews DROP COLUMN business_unit_id;
```

---

## Phase 4: Update Transactions (Requests, Quotes, Jobs)

### 4.1 Ensure `qbo_class_id` Exists
```sql
-- Check if columns exist, add if missing
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);
```

### 4.2 Update Existing Transactions
```sql
-- For requests with business_unit_id, map to qbo_class_id
-- (Only if business_unit_id column exists on these tables)
```

---

## Phase 5: Update FSM Team Profiles

### 5.1 Add Location to Team Profiles
```sql
ALTER TABLE fsm_team_profiles
  ADD COLUMN primary_location VARCHAR(10),
  ADD COLUMN secondary_locations VARCHAR(10)[] DEFAULT '{}';
```

---

## Phase 6: Deprecate Old Tables

### 6.1 Drop `geographies` Table
```sql
-- Only after all references removed
DROP TABLE IF EXISTS geographies;
```

### 6.2 Keep `business_units` Table
```sql
-- DO NOT DELETE - still used by labor_rates
-- But rename for clarity?
-- ALTER TABLE business_units RENAME TO labor_rate_codes;
```

---

## Code Changes Required

### Types to Update

| File | Changes |
|------|---------|
| `src/features/client_hub/types.ts` | Add `default_location` to Client, remove Geography references |
| `src/features/fsm/types.ts` | Update Territory to use `location_code`, add `disabled_qbo_class_ids` |
| `src/features/fsm/types.ts` | Update Crew to use `location_code` |

### Hooks to Update

| File | Changes |
|------|---------|
| `src/features/client_hub/hooks/useClients.ts` | Remove geography joins, add location handling |
| `src/features/client_hub/hooks/useCommunities.ts` | Replace geography_id with location_code |
| `src/features/fsm/hooks/useTerritories.ts` | Replace business_unit_id with location_code |
| `src/features/fsm/hooks/useCrews.ts` | Replace business_unit_id with location_code |
| `src/features/settings/hooks/useBusinessUnits.ts` | Keep for labor rates page only |

### Components to Update

| File | Changes |
|------|---------|
| `src/features/client_hub/components/ClientEditorModal.tsx` | Add Location dropdown |
| `src/features/client_hub/components/CommunityEditorModal.tsx` | Replace Geography with Location |
| `src/features/client_hub/components/GeographiesList.tsx` | DELETE this file |
| `src/features/fsm/components/TerritoryEditorModal.tsx` | Replace BU with Location + disabled QBO classes |
| `src/features/fsm/components/CrewEditorModal.tsx` | Replace BU with Location |
| `src/features/fsm/components/RequestEditorModal.tsx` | Ensure QBO Class derivation |
| `src/features/fsm/pages/RequestEditorPage.tsx` | Ensure QBO Class derivation |

### Pages to Update

| File | Changes |
|------|---------|
| `src/features/client_hub/ClientHub.tsx` | Remove Geographies tab |
| `src/features/bom_calculator/pages/LaborRatesPage.tsx` | Keep using business_units for rates |

---

## New Components to Create

| Component | Purpose |
|-----------|---------|
| `LocationSelector` | Dropdown for selecting location (ATX, SA, HOU) |
| `QboClassSelector` | Dropdown showing derived QBO Class with override option |
| `LocationsList` | Settings page for managing locations |

---

## Database Views to Create

### `v_qbo_classes_with_details`
```sql
CREATE VIEW v_qbo_classes_with_details AS
SELECT
  qc.id,
  qc.name,
  qc.bu_type,
  qc.location_code,
  qc.labor_code,
  l.name as location_name,
  qc.is_selectable
FROM qbo_classes qc
LEFT JOIN locations l ON qc.location_code = l.code
WHERE qc.is_active = true;
```

### `v_labor_rates_by_qbo_class`
```sql
CREATE VIEW v_labor_rates_by_qbo_class AS
SELECT
  qc.id as qbo_class_id,
  qc.name as qbo_class_name,
  lc.labor_sku,
  lc.description,
  lr.rate
FROM qbo_classes qc
JOIN business_units bu ON qc.labor_code = bu.code
JOIN labor_rates lr ON bu.id = lr.business_unit_id
JOIN labor_codes lc ON lr.labor_code_id = lc.id
WHERE qc.is_active = true;
```

---

## Rollback Plan

Each phase should be independently rollbackable:

### Phase 0 Rollback
```sql
ALTER TABLE qbo_classes DROP COLUMN bu_type, DROP COLUMN location_code, DROP COLUMN labor_code;
ALTER TABLE clients DROP COLUMN default_location;
DROP TABLE locations;
```

### Phase 1 Rollback
```sql
ALTER TABLE territories ADD COLUMN business_unit_id UUID;
-- Restore from backup
ALTER TABLE territories DROP COLUMN location_code, DROP COLUMN disabled_qbo_class_ids;
```

(Similar for other phases)

---

## Migration Order

```
Week 1: Phase 0 (Preparation)
  ├── Create locations table
  ├── Add columns to qbo_classes
  ├── Add default_location to clients
  └── TEST: All existing features still work

Week 2: Phase 1-2 (Territories & Communities)
  ├── Migrate territories to location_code
  ├── Migrate communities to location_code
  └── TEST: Territory/Community features work

Week 3: Phase 3-4 (Crews & Transactions)
  ├── Migrate crews to location_code
  ├── Ensure transactions have qbo_class_id
  └── TEST: Crew assignment, Request/Quote/Job creation

Week 4: Phase 5-6 (Cleanup)
  ├── Update FSM team profiles
  ├── Drop geographies table
  ├── Update UI components
  └── FULL REGRESSION TEST
```

---

## Success Criteria

1. All clients can have a default location set
2. QBO Class is automatically derived from BU Type + Location
3. Territories are filtered by Location (not BU)
4. Territories can be disabled for specific QBO Classes
5. Labor rates work correctly via QBO Class → labor_code → business_units
6. All transactions (Request, Quote, Job) have qbo_class_id
7. Geographies table is removed
8. No breaking changes to BOM Calculator labor rate lookups
