-- Migration 186: BU/QBO Normalization - Phase 0 (Preparation)
-- This is a non-destructive phase that adds new tables and columns
-- without modifying or removing existing functionality.

-- ============================================================
-- 0.1 Create locations table
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- 'ATX', 'SA', 'HOU'
  name VARCHAR(100) NOT NULL,        -- 'Austin', 'San Antonio', 'Houston'
  state VARCHAR(2) DEFAULT 'TX',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial locations
INSERT INTO locations (code, name, state) VALUES
  ('ATX', 'Austin', 'TX'),
  ('SA', 'San Antonio', 'TX'),
  ('HOU', 'Houston', 'TX')
ON CONFLICT (code) DO NOTHING;

-- RLS for locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_read_all" ON locations
  FOR SELECT USING (true);

CREATE POLICY "locations_write_authenticated" ON locations
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 0.2 Add new columns to qbo_classes
-- ============================================================
ALTER TABLE qbo_classes
  ADD COLUMN IF NOT EXISTS bu_type VARCHAR(20),       -- 'residential', 'builders', 'commercial'
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(10), -- 'ATX', 'SA', 'HOU', NULL for Commercial
  ADD COLUMN IF NOT EXISTS labor_code VARCHAR(20);    -- 'ATX-RES', 'ATX-HB', 'COM', etc.

-- ============================================================
-- 0.3 Populate qbo_classes new columns based on name patterns
-- ============================================================

-- Austin mappings
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'ATX', labor_code = 'ATX-RES'
  WHERE name = 'Austin Residential' AND bu_type IS NULL;

UPDATE qbo_classes SET bu_type = 'builders', location_code = 'ATX', labor_code = 'ATX-HB'
  WHERE name = 'Austin Builder' AND bu_type IS NULL;

-- San Antonio mappings
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'SA', labor_code = 'SA-RES'
  WHERE name = 'San Antonio Residential' AND bu_type IS NULL;

UPDATE qbo_classes SET bu_type = 'builders', location_code = 'SA', labor_code = 'SA-HB'
  WHERE name = 'San Antonio Builder' AND bu_type IS NULL;

-- Houston mappings
UPDATE qbo_classes SET bu_type = 'residential', location_code = 'HOU', labor_code = 'HOU-RES'
  WHERE name = 'Houston Residential' AND bu_type IS NULL;

UPDATE qbo_classes SET bu_type = 'builders', location_code = 'HOU', labor_code = 'HOU-HB'
  WHERE name = 'Houston Builder' AND bu_type IS NULL;

-- Commercial (no location - single QBO class)
UPDATE qbo_classes SET bu_type = 'commercial', location_code = NULL, labor_code = 'COM'
  WHERE name = 'Commercial' AND bu_type IS NULL;

-- ============================================================
-- 0.4 Add default_location to clients
-- ============================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS default_location VARCHAR(10);

-- Add FK constraint (optional, can be added later)
-- ALTER TABLE clients
--   ADD CONSTRAINT fk_clients_location
--   FOREIGN KEY (default_location) REFERENCES locations(code);

-- ============================================================
-- 0.5 Create view for QBO Classes with details
-- ============================================================
CREATE OR REPLACE VIEW v_qbo_classes_with_details AS
SELECT
  qc.id,
  qc.name,
  qc.bu_type,
  qc.location_code,
  qc.labor_code,
  l.name as location_name,
  qc.is_selectable,
  qc.is_active
FROM qbo_classes qc
LEFT JOIN locations l ON qc.location_code = l.code;

-- ============================================================
-- Verification queries (run manually to verify)
-- ============================================================
-- SELECT * FROM locations ORDER BY code;
-- SELECT id, name, bu_type, location_code, labor_code FROM qbo_classes WHERE bu_type IS NOT NULL;
-- SELECT COUNT(*) FROM clients;
