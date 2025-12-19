-- Migration 188: BU/QBO Normalization - Phase 2 (Communities)
-- Updates communities to use location_code instead of geography_id

-- ============================================================
-- 2.1 Add location_code column to communities
-- ============================================================
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(10);

-- ============================================================
-- 2.2 Migrate existing geography_id to location_code
-- Map geography codes to location codes:
--   AUS → ATX
--   SAT → SA
--   HOU → HOU
--   DFW → (no mapping, leave as null for now)
-- ============================================================
UPDATE communities c
SET location_code = CASE g.code
  WHEN 'AUS' THEN 'ATX'
  WHEN 'SAT' THEN 'SA'
  WHEN 'HOU' THEN 'HOU'
  ELSE NULL
END
FROM geographies g
WHERE c.geography_id = g.id
  AND c.location_code IS NULL;

-- ============================================================
-- 2.3 Add FK constraint to locations table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_communities_location'
  ) THEN
    ALTER TABLE communities
      ADD CONSTRAINT fk_communities_location
      FOREIGN KEY (location_code) REFERENCES locations(code);
  END IF;
END $$;

-- ============================================================
-- 2.4 Create index for location_code lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communities_location_code
  ON communities(location_code);

-- ============================================================
-- Note: DO NOT drop geography_id column yet
-- We keep it for backward compatibility until all code is updated
-- The geographies table will be dropped in Phase 6 (cleanup)
-- ============================================================

-- ============================================================
-- Verification queries (run manually)
-- ============================================================
-- SELECT id, name, geography_id, location_code FROM communities WHERE geography_id IS NOT NULL;
-- SELECT location_code, COUNT(*) FROM communities GROUP BY location_code;
