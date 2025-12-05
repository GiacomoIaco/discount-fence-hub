-- ============================================
-- Migration 080: Component Material Eligibility
-- ============================================
-- Defines which materials are available for each component
-- at the PRODUCT TYPE level (not per-SKU)
-- This feeds the SKU Builder dropdowns

-- ============================================
-- 1. Component Material Eligibility Table
-- ============================================
-- Links components to eligible materials for each fence type
-- Can specify: all materials in a category, a subcategory, or specific materials

CREATE TABLE component_material_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron')),
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,

  -- Selection mode: 'category', 'subcategory', 'specific'
  selection_mode TEXT NOT NULL DEFAULT 'category' CHECK (selection_mode IN ('category', 'subcategory', 'specific')),

  -- For category/subcategory mode
  material_category TEXT,
  material_subcategory TEXT,

  -- For specific material mode
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,

  -- Additional filters (applied on top of category/subcategory)
  min_length_ft DECIMAL(10,2),
  max_length_ft DECIMAL(10,2),

  -- Metadata
  notes TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique rules
  UNIQUE NULLS NOT DISTINCT (fence_type, component_id, material_category, material_subcategory, material_id)
);

-- Indexes
CREATE INDEX idx_cme_fence_component ON component_material_eligibility(fence_type, component_id);
CREATE INDEX idx_cme_material ON component_material_eligibility(material_id) WHERE material_id IS NOT NULL;

-- ============================================
-- 2. RLS Policies
-- ============================================
ALTER TABLE component_material_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cme_select" ON component_material_eligibility
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cme_all" ON component_material_eligibility
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. View: Expanded Eligible Materials
-- ============================================
-- Expands the rules into actual material list for easy querying
CREATE VIEW v_component_eligible_materials AS
WITH expanded_rules AS (
  -- Category-based rules: get all materials in that category
  SELECT
    cme.fence_type,
    cme.component_id,
    cd.code AS component_code,
    cd.name AS component_name,
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
SELECT DISTINCT ON (fence_type, component_id, material_id)
  fence_type,
  component_id,
  component_code,
  component_name,
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
ORDER BY fence_type, component_id, material_id, display_order;

GRANT SELECT ON v_component_eligible_materials TO authenticated;

-- ============================================
-- 4. Seed Default Rules (based on current SKU Builder logic)
-- ============================================

-- Get component IDs
DO $$
DECLARE
  v_post_id UUID;
  v_picket_id UUID;
  v_rail_id UUID;
  v_cap_id UUID;
  v_trim_id UUID;
  v_rot_board_id UUID;
  v_board_id UUID;
  v_nailer_id UUID;
  v_vertical_trim_id UUID;
  v_panel_id UUID;
  v_bracket_id UUID;
BEGIN
  SELECT id INTO v_post_id FROM component_definitions WHERE code = 'post';
  SELECT id INTO v_picket_id FROM component_definitions WHERE code = 'picket';
  SELECT id INTO v_rail_id FROM component_definitions WHERE code = 'rail';
  SELECT id INTO v_cap_id FROM component_definitions WHERE code = 'cap';
  SELECT id INTO v_trim_id FROM component_definitions WHERE code = 'trim';
  SELECT id INTO v_rot_board_id FROM component_definitions WHERE code = 'rot_board';
  SELECT id INTO v_board_id FROM component_definitions WHERE code = 'board';
  SELECT id INTO v_nailer_id FROM component_definitions WHERE code = 'nailer';
  SELECT id INTO v_vertical_trim_id FROM component_definitions WHERE code = 'vertical_trim';
  SELECT id INTO v_panel_id FROM component_definitions WHERE code = 'panel';
  SELECT id INTO v_bracket_id FROM component_definitions WHERE code = 'bracket';

  -- ========== WOOD VERTICAL ==========
  -- Posts: Wood and Steel subcategories
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES
    ('wood_vertical', v_post_id, 'subcategory', '01-Post', 'Wood', 'Wood posts for wood fences'),
    ('wood_vertical', v_post_id, 'subcategory', '01-Post', 'Steel', 'Steel posts for wood fences');

  -- Pickets: All pickets
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('wood_vertical', v_picket_id, 'category', '02-Pickets', 'All picket materials');

  -- Rails: All rails
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('wood_vertical', v_rail_id, 'category', '03-Rails', 'All rail materials');

  -- Cap: Cap subcategory
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('wood_vertical', v_cap_id, 'subcategory', '04-Cap/Trim', 'Cap', 'Cap materials');

  -- Trim: Trim subcategory
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('wood_vertical', v_trim_id, 'subcategory', '04-Cap/Trim', 'Trim', 'Trim materials');

  -- Rot Board: Rot board category
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('wood_vertical', v_rot_board_id, 'category', '05-Rot Board', 'Rot board materials');

  -- ========== WOOD HORIZONTAL ==========
  -- Posts: Wood and Steel
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES
    ('wood_horizontal', v_post_id, 'subcategory', '01-Post', 'Wood', 'Wood posts'),
    ('wood_horizontal', v_post_id, 'subcategory', '01-Post', 'Steel', 'Steel posts');

  -- Boards: Horizontal boards
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('wood_horizontal', v_board_id, 'category', '07-Horizontal Boards', 'Horizontal board materials');

  -- Nailer: Rails category (nailers use rail materials)
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('wood_horizontal', v_nailer_id, 'category', '03-Rails', 'Nailer materials');

  -- Cap
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('wood_horizontal', v_cap_id, 'subcategory', '04-Cap/Trim', 'Cap', 'Cap materials');

  -- Vertical Trim
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('wood_horizontal', v_vertical_trim_id, 'subcategory', '04-Cap/Trim', 'Trim', 'Vertical trim materials');

  -- ========== IRON ==========
  -- Posts: Iron posts
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('iron', v_post_id, 'subcategory', '01-Post', 'Iron', 'Iron fence posts');

  -- Panels
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, material_subcategory, notes)
  VALUES ('iron', v_panel_id, 'subcategory', '09-Iron', 'Panel', 'Iron panels');

  -- Brackets: Hardware
  INSERT INTO component_material_eligibility (fence_type, component_id, selection_mode, material_category, notes)
  VALUES ('iron', v_bracket_id, 'category', '08-Hardware', 'Brackets and hardware');

END $$;
