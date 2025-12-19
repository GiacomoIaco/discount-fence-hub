-- Migration 189: BU/QBO Normalization - Phase 3 (Crews)
-- Updates crews to use location_code instead of business_unit_id

-- ============================================================
-- 3.1 Add location_code column to crews
-- ============================================================
ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(10);

-- ============================================================
-- 3.2 Migrate existing business_unit_id to location_code
-- Map via business_units.location
-- ============================================================
UPDATE crews c
SET location_code = bu.location
FROM business_units bu
WHERE c.business_unit_id = bu.id
  AND c.location_code IS NULL;

-- ============================================================
-- 3.3 Add FK constraint to locations table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_crews_location'
  ) THEN
    ALTER TABLE crews
      ADD CONSTRAINT fk_crews_location
      FOREIGN KEY (location_code) REFERENCES locations(code);
  END IF;
END $$;

-- ============================================================
-- 3.4 Create index for location_code lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crews_location_code
  ON crews(location_code);

-- ============================================================
-- Note: DO NOT drop business_unit_id column yet
-- We keep it for backward compatibility until all code is updated
-- ============================================================

-- ============================================================
-- Verification queries (run manually)
-- ============================================================
-- SELECT id, name, code, business_unit_id, location_code FROM crews;
