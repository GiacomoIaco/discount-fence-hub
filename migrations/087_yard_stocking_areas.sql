-- Migration: 087_yard_stocking_areas.sql
-- Description: Add stocking areas with colors for yard organization
-- Phase 3.1.1 of BOM Calculator HUB Roadmap

-- ============================================
-- 1. YARD AREAS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS yard_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id UUID REFERENCES yards(id) ON DELETE CASCADE, -- NULL = global area (applies to all yards)
  area_code TEXT NOT NULL, -- 'POSTS', 'PICKETS', 'HARDWARE', etc.
  area_name TEXT NOT NULL, -- 'Posts & Rails', 'Pickets & Boards', etc.
  color_hex TEXT NOT NULL DEFAULT '#6B7280', -- Hex color code
  color_name TEXT NOT NULL DEFAULT 'Gray', -- Human readable color name
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(yard_id, area_code)
);

-- Comments
COMMENT ON TABLE yard_areas IS 'Stocking areas/sections in the yard for organizing materials';
COMMENT ON COLUMN yard_areas.yard_id IS 'NULL for global areas that apply to all yards';
COMMENT ON COLUMN yard_areas.area_code IS 'Short code for the area (POSTS, PICKETS, etc)';
COMMENT ON COLUMN yard_areas.color_hex IS 'Hex color code for visual identification';

-- Index
CREATE INDEX IF NOT EXISTS idx_yard_areas_yard ON yard_areas(yard_id);
CREATE INDEX IF NOT EXISTS idx_yard_areas_active ON yard_areas(is_active) WHERE is_active = true;

-- ============================================
-- 2. LINK SPOTS TO AREAS
-- ============================================

-- Add area_id to yard_spots
ALTER TABLE yard_spots
ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES yard_areas(id) ON DELETE SET NULL;

COMMENT ON COLUMN yard_spots.area_id IS 'The stocking area this spot belongs to';

CREATE INDEX IF NOT EXISTS idx_yard_spots_area ON yard_spots(area_id);

-- ============================================
-- 3. LINK MATERIALS TO DEFAULT AREAS
-- ============================================

-- Add default_area_id to materials for auto-assignment on pick lists
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS default_area_id UUID REFERENCES yard_areas(id) ON DELETE SET NULL;

COMMENT ON COLUMN materials.default_area_id IS 'Default stocking area for this material (used in pick list grouping)';

CREATE INDEX IF NOT EXISTS idx_materials_default_area ON materials(default_area_id);

-- ============================================
-- 4. SEED DEFAULT GLOBAL AREAS
-- ============================================

INSERT INTO yard_areas (yard_id, area_code, area_name, color_hex, color_name, description, display_order) VALUES
  (NULL, 'POSTS', 'Posts & Rails', '#DC2626', 'Red', 'Wood and steel posts, rails', 1),
  (NULL, 'PICKETS', 'Pickets & Boards', '#2563EB', 'Blue', 'Pickets, fence boards, panels', 2),
  (NULL, 'HARDWARE', 'Hardware', '#7C3AED', 'Purple', 'Brackets, screws, nails, caps', 3),
  (NULL, 'CONCRETE', 'Concrete', '#CA8A04', 'Yellow', 'Concrete bags, mix', 4),
  (NULL, 'IRON', 'Iron & Metal', '#4B5563', 'Gray', 'Iron panels, metal components', 5),
  (NULL, 'MISC', 'Miscellaneous', '#059669', 'Green', 'Other materials', 6)
ON CONFLICT (yard_id, area_code) DO NOTHING;

-- ============================================
-- 5. UPDATE MATERIALS WITH DEFAULT AREAS
-- ============================================

-- Map material categories to default areas
DO $$
DECLARE
  area_posts UUID;
  area_pickets UUID;
  area_hardware UUID;
  area_concrete UUID;
  area_iron UUID;
BEGIN
  -- Get area IDs
  SELECT id INTO area_posts FROM yard_areas WHERE area_code = 'POSTS' AND yard_id IS NULL;
  SELECT id INTO area_pickets FROM yard_areas WHERE area_code = 'PICKETS' AND yard_id IS NULL;
  SELECT id INTO area_hardware FROM yard_areas WHERE area_code = 'HARDWARE' AND yard_id IS NULL;
  SELECT id INTO area_concrete FROM yard_areas WHERE area_code = 'CONCRETE' AND yard_id IS NULL;
  SELECT id INTO area_iron FROM yard_areas WHERE area_code = 'IRON' AND yard_id IS NULL;

  -- Update materials based on category
  UPDATE materials SET default_area_id = area_posts
  WHERE category ILIKE '%post%' OR category ILIKE '%rail%';

  UPDATE materials SET default_area_id = area_pickets
  WHERE category ILIKE '%picket%' OR category ILIKE '%board%' OR category ILIKE '%panel%';

  UPDATE materials SET default_area_id = area_hardware
  WHERE category ILIKE '%hardware%' OR category ILIKE '%screw%' OR category ILIKE '%nail%'
     OR category ILIKE '%bracket%' OR category ILIKE '%cap%';

  UPDATE materials SET default_area_id = area_concrete
  WHERE category ILIKE '%concrete%';

  UPDATE materials SET default_area_id = area_iron
  WHERE category ILIKE '%iron%' OR category ILIKE '%metal%';
END $$;

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE yard_areas ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read areas
CREATE POLICY "Allow authenticated read yard_areas"
ON yard_areas FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to manage areas (admin check could be added)
CREATE POLICY "Allow authenticated manage yard_areas"
ON yard_areas FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
