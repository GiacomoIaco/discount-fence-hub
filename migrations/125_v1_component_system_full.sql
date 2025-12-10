-- ============================================
-- V1 Component System - Full Setup
-- Creates all tables and views needed for ComponentConfiguratorPage
-- ============================================

-- ============================================
-- 1. COMPONENT DEFINITIONS
-- Master list of all components with fence type associations
-- ============================================
CREATE TABLE IF NOT EXISTS component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  fence_types TEXT[] NOT NULL DEFAULT '{}',
  default_category TEXT,
  default_sub_category TEXT,
  filter_attribute TEXT,
  filter_values TEXT[],
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_select" ON component_definitions;
DROP POLICY IF EXISTS "cd_all" ON component_definitions;
CREATE POLICY "cd_select" ON component_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cd_all" ON component_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. FENCE TYPE COMPONENT CONFIG
-- Per fence-type configuration of components
-- ============================================
CREATE TABLE IF NOT EXISTS fence_type_component_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron')),
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  filter_attribute TEXT,
  filter_values TEXT[],
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fence_type, component_id)
);

ALTER TABLE fence_type_component_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ftcc_select" ON fence_type_component_config;
DROP POLICY IF EXISTS "ftcc_all" ON fence_type_component_config;
CREATE POLICY "ftcc_select" ON fence_type_component_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "ftcc_all" ON fence_type_component_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. COMPONENT MATERIAL ELIGIBILITY
-- Rules defining which materials are eligible for each component
-- ============================================
CREATE TABLE IF NOT EXISTS component_material_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron')),
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('category', 'subcategory', 'specific')),
  material_category TEXT,
  material_subcategory TEXT,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  attribute_filter JSONB,
  min_length_ft DECIMAL(10,2),
  max_length_ft DECIMAL(10,2),
  notes TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE component_material_eligibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cme_select" ON component_material_eligibility;
DROP POLICY IF EXISTS "cme_all" ON component_material_eligibility;
CREATE POLICY "cme_select" ON component_material_eligibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "cme_all" ON component_material_eligibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4. SEED COMPONENT DEFINITIONS
-- ============================================
INSERT INTO component_definitions (code, name, description, fence_types, default_category, display_order, is_required) VALUES
  ('post', 'Post', 'Posts for fence structure', ARRAY['wood_vertical', 'wood_horizontal', 'iron'], '01-Post', 10, true),
  ('picket', 'Picket', 'Vertical picket boards', ARRAY['wood_vertical'], '02-Pickets', 20, true),
  ('rail', 'Rail', 'Horizontal rails', ARRAY['wood_vertical', 'iron'], '03-Rails', 30, true),
  ('cap', 'Cap', 'Cap trim for posts', ARRAY['wood_vertical', 'wood_horizontal'], '04-Cap/Trim', 60, false),
  ('trim', 'Trim', 'Trim boards', ARRAY['wood_vertical'], '04-Cap/Trim', 50, false),
  ('rot_board', 'Rot Board', 'Bottom rot board', ARRAY['wood_vertical'], '05-Rot Board', 40, false),
  ('steel_post_cap', 'Steel Post Cap', 'Cap for steel posts', ARRAY['wood_vertical', 'wood_horizontal'], '08-Hardware', 70, false),
  ('bracket', 'Bracket', 'Metal bracket for steel posts', ARRAY['wood_vertical', 'wood_horizontal', 'iron'], '08-Hardware', 80, false),
  ('nails_picket', 'Picket Nails', 'Nails for pickets', ARRAY['wood_vertical'], '08-Hardware', 90, false),
  ('nails_frame', 'Frame Nails', 'Nails for framing', ARRAY['wood_vertical', 'wood_horizontal'], '08-Hardware', 91, false),
  ('board', 'Horizontal Board', 'Horizontal fence boards', ARRAY['wood_horizontal'], '07-Horizontal Boards', 20, true),
  ('nailer', 'Nailer', 'Nailer strips', ARRAY['wood_horizontal'], '03-Rails', 30, false),
  ('vertical_trim', 'Vertical Trim', 'Vertical trim covering posts', ARRAY['wood_horizontal'], '04-Cap/Trim', 50, false),
  ('panel', 'Panel', 'Pre-fabricated iron panels', ARRAY['iron'], '09-Iron', 20, false),
  ('iron_post_cap', 'Iron Post Cap', 'Decorative cap for iron posts', ARRAY['iron'], '08-Hardware', 70, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  fence_types = EXCLUDED.fence_types,
  default_category = EXCLUDED.default_category,
  display_order = EXCLUDED.display_order,
  is_required = EXCLUDED.is_required;

-- ============================================
-- 5. POPULATE FENCE TYPE COMPONENT CONFIG
-- ============================================
-- Wood Vertical components
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'wood_vertical', id,
  CASE WHEN code = 'post' THEN 'post_type' ELSE NULL END,
  CASE WHEN code = 'post' THEN ARRAY['WOOD', 'STEEL'] ELSE NULL END,
  display_order
FROM component_definitions
WHERE is_active = true AND 'wood_vertical' = ANY(fence_types)
ON CONFLICT (fence_type, component_id) DO UPDATE SET
  filter_attribute = EXCLUDED.filter_attribute,
  filter_values = EXCLUDED.filter_values,
  display_order = EXCLUDED.display_order;

-- Wood Horizontal components
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'wood_horizontal', id,
  CASE WHEN code = 'post' THEN 'post_type' ELSE NULL END,
  CASE WHEN code = 'post' THEN ARRAY['WOOD', 'STEEL'] ELSE NULL END,
  display_order
FROM component_definitions
WHERE is_active = true AND 'wood_horizontal' = ANY(fence_types)
ON CONFLICT (fence_type, component_id) DO UPDATE SET
  filter_attribute = EXCLUDED.filter_attribute,
  filter_values = EXCLUDED.filter_values,
  display_order = EXCLUDED.display_order;

-- Iron components
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'iron', id, NULL, NULL, display_order
FROM component_definitions
WHERE is_active = true AND 'iron' = ANY(fence_types)
ON CONFLICT (fence_type, component_id) DO UPDATE SET
  filter_attribute = EXCLUDED.filter_attribute,
  filter_values = EXCLUDED.filter_values,
  display_order = EXCLUDED.display_order;

-- ============================================
-- 6. CREATE VIEWS
-- ============================================
DROP VIEW IF EXISTS v_fence_type_components CASCADE;
CREATE VIEW v_fence_type_components AS
SELECT
  ftcc.fence_type,
  ftcc.component_id,
  cd.code AS component_code,
  cd.name AS component_name,
  cd.description AS component_description,
  cd.default_category,
  cd.default_sub_category,
  cd.is_required,
  ftcc.filter_attribute,
  ftcc.filter_values,
  ftcc.display_order,
  ftcc.is_visible
FROM fence_type_component_config ftcc
JOIN component_definitions cd ON cd.id = ftcc.component_id
WHERE cd.is_active = true AND ftcc.is_visible = true
ORDER BY ftcc.fence_type, ftcc.display_order;

GRANT SELECT ON v_fence_type_components TO authenticated;

DROP VIEW IF EXISTS v_component_eligible_materials CASCADE;
CREATE VIEW v_component_eligible_materials AS
WITH expanded_rules AS (
  -- Category-based rules
  SELECT
    cme.fence_type,
    cme.component_id,
    cd.code AS component_code,
    cd.name AS component_name,
    cd.filter_attribute,
    cd.filter_values,
    cme.attribute_filter,
    m.id AS material_id,
    m.material_sku,
    m.material_name,
    m.category,
    m.sub_category,
    m.unit_cost,
    m.length_ft,
    m.actual_width,
    cme.display_order,
    cme.selection_mode
  FROM component_material_eligibility cme
  JOIN component_definitions cd ON cd.id = cme.component_id
  JOIN materials m ON m.status = 'Active'
    AND m.category = cme.material_category
    AND (cme.material_subcategory IS NULL OR m.sub_category = cme.material_subcategory)
    AND (cme.min_length_ft IS NULL OR m.length_ft >= cme.min_length_ft)
    AND (cme.max_length_ft IS NULL OR m.length_ft <= cme.max_length_ft)
  WHERE cme.selection_mode IN ('category', 'subcategory')
    AND cme.is_active = true
    AND cd.is_active = true

  UNION

  -- Specific material rules
  SELECT
    cme.fence_type,
    cme.component_id,
    cd.code AS component_code,
    cd.name AS component_name,
    cd.filter_attribute,
    cd.filter_values,
    cme.attribute_filter,
    m.id AS material_id,
    m.material_sku,
    m.material_name,
    m.category,
    m.sub_category,
    m.unit_cost,
    m.length_ft,
    m.actual_width,
    cme.display_order,
    cme.selection_mode
  FROM component_material_eligibility cme
  JOIN component_definitions cd ON cd.id = cme.component_id
  JOIN materials m ON m.id = cme.material_id AND m.status = 'Active'
  WHERE cme.selection_mode = 'specific'
    AND cme.is_active = true
    AND cd.is_active = true
)
SELECT DISTINCT ON (fence_type, component_id, COALESCE(attribute_filter::text, ''), material_id)
  fence_type,
  component_id,
  component_code,
  component_name,
  filter_attribute,
  filter_values,
  attribute_filter,
  material_id,
  material_sku,
  material_name,
  category,
  sub_category,
  unit_cost,
  length_ft,
  actual_width,
  display_order,
  selection_mode
FROM expanded_rules
ORDER BY fence_type, component_id, COALESCE(attribute_filter::text, ''), material_id, display_order;

GRANT SELECT ON v_component_eligible_materials TO authenticated;

-- ============================================
-- 7. SEED INITIAL MATERIAL ELIGIBILITY RULES
-- Add category-based rules for main components
-- ============================================
-- Wood Vertical - Post (category based)
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_vertical', id, 'category', '01-Post', 1
FROM component_definitions WHERE code = 'post'
ON CONFLICT DO NOTHING;

-- Wood Vertical - Picket
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_vertical', id, 'category', '02-Pickets', 1
FROM component_definitions WHERE code = 'picket'
ON CONFLICT DO NOTHING;

-- Wood Vertical - Rail
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_vertical', id, 'category', '03-Rails', 1
FROM component_definitions WHERE code = 'rail'
ON CONFLICT DO NOTHING;

-- Wood Vertical - Cap
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_vertical', id, 'category', '04-Cap/Trim', 1
FROM component_definitions WHERE code = 'cap'
ON CONFLICT DO NOTHING;

-- Wood Horizontal - Post
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_horizontal', id, 'category', '01-Post', 1
FROM component_definitions WHERE code = 'post'
ON CONFLICT DO NOTHING;

-- Wood Horizontal - Board
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'wood_horizontal', id, 'category', '07-Horizontal Boards', 1
FROM component_definitions WHERE code = 'board'
ON CONFLICT DO NOTHING;

-- Iron - Post
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'iron', id, 'category', '01-Post', 1
FROM component_definitions WHERE code = 'post'
ON CONFLICT DO NOTHING;

-- Iron - Panel
INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, display_order)
SELECT 'iron', id, 'category', '09-Iron', 1
FROM component_definitions WHERE code = 'panel'
ON CONFLICT DO NOTHING;
