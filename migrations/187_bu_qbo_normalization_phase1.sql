-- Migration 187: BU/QBO Normalization - Phase 1 (Territories)
-- Updates territories to use location_code instead of business_unit_id
-- and adds ability to disable specific QBO classes per territory.

-- ============================================================
-- 1.1 Add new columns to territories
-- ============================================================
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS disabled_qbo_class_ids TEXT[] DEFAULT '{}';

-- ============================================================
-- 1.2 Migrate existing territory data
-- Map business_unit_id → location_code via business_units.location
-- ============================================================
UPDATE territories t
SET location_code = bu.location
FROM business_units bu
WHERE t.business_unit_id = bu.id
  AND t.location_code IS NULL;

-- ============================================================
-- 1.3 Add FK constraint to locations table
-- ============================================================
-- Note: Only add if locations table exists and has data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_territories_location'
  ) THEN
    ALTER TABLE territories
      ADD CONSTRAINT fk_territories_location
      FOREIGN KEY (location_code) REFERENCES locations(code);
  END IF;
END $$;

-- ============================================================
-- 1.4 Create index for location_code lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_territories_location_code
  ON territories(location_code);

-- ============================================================
-- 1.5 Create view for territories with location details
-- ============================================================
CREATE OR REPLACE VIEW v_territories_with_location AS
SELECT
  t.id,
  t.name,
  t.code,
  t.location_code,
  t.disabled_qbo_class_ids,
  t.zip_codes,
  t.geometry,
  t.business_unit_id, -- Keep for backward compatibility during transition
  l.name as location_name,
  l.state as location_state
FROM territories t
LEFT JOIN locations l ON t.location_code = l.code;

-- ============================================================
-- Note: DO NOT drop business_unit_id column yet
-- We keep it for backward compatibility until all code is updated
-- ============================================================

-- ============================================================
-- Verification queries (run manually to verify)
-- ============================================================
-- SELECT id, name, code, location_code, business_unit_id, disabled_qbo_class_ids
-- FROM territories ORDER BY name;
--
-- SELECT * FROM v_territories_with_location;
