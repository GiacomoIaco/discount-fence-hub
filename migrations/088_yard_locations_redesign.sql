-- Migration: 088_yard_locations_redesign.sql
-- Description: Redesign yard stocking areas as physical warehouse locations
-- Phase 3.1.1 - Stocking Areas with Slots and SKU Assignments

-- ============================================
-- 1. CLEAN UP PREVIOUS AUTO-SEEDED DATA
-- ============================================

-- Remove category-based area assignments from materials
UPDATE materials SET default_area_id = NULL WHERE default_area_id IS NOT NULL;

-- Delete the auto-seeded global areas (we'll let users create their own)
DELETE FROM yard_areas WHERE yard_id IS NULL;

-- ============================================
-- 2. YARD SLOTS TABLE (bins/spots within areas)
-- ============================================

CREATE TABLE IF NOT EXISTS yard_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES yard_areas(id) ON DELETE CASCADE,
  slot_code TEXT NOT NULL, -- '#1', '#2', 'Bin A', etc.
  slot_name TEXT, -- Optional friendly name
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(area_id, slot_code)
);

COMMENT ON TABLE yard_slots IS 'Physical slots/bins within a yard area for organizing materials';
COMMENT ON COLUMN yard_slots.slot_code IS 'Short identifier like #1, #2, Bin A';
COMMENT ON COLUMN yard_slots.slot_name IS 'Optional descriptive name';

CREATE INDEX IF NOT EXISTS idx_yard_slots_area ON yard_slots(area_id);

-- ============================================
-- 3. MATERIAL LOCATION ASSIGNMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS material_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES yard_areas(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES yard_slots(id) ON DELETE SET NULL, -- NULL = assigned to area but no specific slot
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Each material can only be in one location per yard
  UNIQUE(material_id, area_id)
);

COMMENT ON TABLE material_locations IS 'Maps materials/SKUs to physical locations in the yard';
COMMENT ON COLUMN material_locations.slot_id IS 'Specific slot within area, NULL if just area-level assignment';

CREATE INDEX IF NOT EXISTS idx_material_locations_material ON material_locations(material_id);
CREATE INDEX IF NOT EXISTS idx_material_locations_area ON material_locations(area_id);
CREATE INDEX IF NOT EXISTS idx_material_locations_slot ON material_locations(slot_id);

-- ============================================
-- 4. VIEW FOR EASY MATERIAL LOCATION LOOKUP
-- ============================================

CREATE OR REPLACE VIEW v_material_locations AS
SELECT
  ml.id AS location_id,
  m.id AS material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  ya.id AS area_id,
  ya.area_code,
  ya.area_name,
  ya.color_hex,
  ya.color_name,
  ya.yard_id,
  ys.id AS slot_id,
  ys.slot_code,
  ys.slot_name,
  -- Combined location string for display
  CASE
    WHEN ys.slot_code IS NOT NULL THEN ya.area_name || ' → ' || ys.slot_code
    ELSE ya.area_name
  END AS location_display
FROM material_locations ml
JOIN materials m ON m.id = ml.material_id
JOIN yard_areas ya ON ya.id = ml.area_id
LEFT JOIN yard_slots ys ON ys.id = ml.slot_id
WHERE ya.is_active = true;

COMMENT ON VIEW v_material_locations IS 'Denormalized view of material locations for easy lookup';

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE yard_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_locations ENABLE ROW LEVEL SECURITY;

-- Yard Slots policies
CREATE POLICY "Allow authenticated read yard_slots"
ON yard_slots FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated manage yard_slots"
ON yard_slots FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Material Locations policies
CREATE POLICY "Allow authenticated read material_locations"
ON material_locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated manage material_locations"
ON material_locations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 6. UPDATE TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_yard_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER yard_slots_updated_at
  BEFORE UPDATE ON yard_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_yard_slots_updated_at();

CREATE OR REPLACE FUNCTION update_material_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER material_locations_updated_at
  BEFORE UPDATE ON material_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_material_locations_updated_at();
