-- ============================================
-- Migration: Component Material Rules
-- Purpose: Define which materials (by category/subcategory) are eligible for each component
-- ============================================

-- ============================================
-- 1. COMPONENT MATERIAL RULES TABLE
-- Maps components to material categories/subcategories
-- ============================================
CREATE TABLE IF NOT EXISTS component_material_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: can be global, per product type, or per style
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles(id) ON DELETE CASCADE,

  -- Which component this rule applies to
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,

  -- Material filter (at least one must be specified)
  material_category TEXT,           -- e.g., '01-Post'
  material_subcategory TEXT,        -- e.g., 'Wood 4x4', 'Steel Post'

  -- Optional: specific material (for edge cases)
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,

  -- Rule metadata
  is_default BOOLEAN DEFAULT false, -- Show this option pre-selected
  display_order INTEGER DEFAULT 0,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE component_material_rules IS 'Defines which materials are eligible for each component. Filter by category, subcategory, or specific material.';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_component_material_rules_component ON component_material_rules(component_id);
CREATE INDEX idx_component_material_rules_type ON component_material_rules(product_type_id);
CREATE INDEX idx_component_material_rules_style ON component_material_rules(product_style_id);
CREATE INDEX idx_component_material_rules_category ON component_material_rules(material_category);
CREATE INDEX idx_component_material_rules_subcategory ON component_material_rules(material_subcategory);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE component_material_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_component_material_rules" ON component_material_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_component_material_rules" ON component_material_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGER
-- ============================================
CREATE OR REPLACE TRIGGER update_component_material_rules_updated_at
  BEFORE UPDATE ON component_material_rules
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- SEED DATA: Wood Vertical Component-Material Rules
-- ============================================

-- POST component: Wood 4x4 and Steel Post subcategories
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Wood 4x4', true, 1, 'Standard wood posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'post';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Steel Post', false, 2, 'Steel posts (requires brackets)'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'post';

-- PICKET component: All 1x4, 1x6, 1x8 picket subcategories
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-02 1x6 Pickets', true, 1, 'Standard 1x6 pickets'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'picket';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-01 1x4 Pickets', false, 2, '1x4 pickets'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'picket';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-03 1x8 Boards', false, 3, '1x8 boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'picket';

-- RAIL component: 2x4 Rails
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '2x4 Rails', true, 1, 'Standard 2x4 rails'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'rail';

-- CAP component: Cap subcategory
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Cap', true, 1, 'Cap boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'cap';

-- TRIM component: Trim subcategory (also 1x6 pickets can be used as trim)
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Trim', true, 1, 'Dedicated trim boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'trim';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-02 1x6 Pickets', false, 2, '1x6 pickets used as vertical trim'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'trim';

-- ROT-BOARD component: Uses same picket materials
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-02 1x6 Pickets', true, 1, '1x6 used as rot board'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'rot-board';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-01 1x4 Pickets', false, 2, '1x4 used as rot board'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'rot-board';

-- BRACKET component: Brackets subcategory
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Brackets', true, 1, 'Rail brackets for steel posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'bracket';

-- STEEL-POST-CAP component: Dome and Plug
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Dome', true, 1, 'Dome caps (use when cap/trim is present)'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'steel-post-cap';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Plug', false, 2, 'Plug caps (use when no cap/trim)'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-vertical' AND cd.code = 'steel-post-cap';

-- ============================================
-- SEED DATA: Wood Horizontal Component-Material Rules
-- ============================================

-- POST component (same as wood vertical)
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Wood 4x4', true, 1, 'Standard wood posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'post';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Steel Post', false, 2, 'Steel posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'post';

-- HORIZONTAL-BOARD component: Uses picket materials
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-02 1x6 Pickets', true, 1, '1x6 horizontal boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'horizontal-board';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-03 1x8 Boards', false, 2, '1x8 horizontal boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'horizontal-board';

-- NAILER component
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Nailer', true, 1, '2x2 nailers'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'nailer';

-- CAP component (same as wood vertical)
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Cap', true, 1, 'Cap boards'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'cap';

-- VERTICAL-TRIM component
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Trim', true, 1, 'Vertical trim at posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'vertical-trim';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '02-02 1x6 Pickets', false, 2, '1x6 used as vertical trim'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'wood-horizontal' AND cd.code = 'vertical-trim';

-- ============================================
-- SEED DATA: Iron Component-Material Rules
-- ============================================

-- POST component: Iron posts
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Iron Squared Post', true, 1, 'Iron squared posts'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'post';

-- PANEL component: Iron panels by height
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '2 Rail F/F', true, 1, '2-rail flat/flat panels'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'panel';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '3 Rail  F/P', false, 2, '3-rail flat/pointed panels'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'panel';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Ameristar', false, 3, 'Ameristar panels'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'panel';

-- BRACKET component (for Ameristar style)
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, 'Brackets', true, 1, 'Ameristar brackets'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'bracket';

-- IRON-POST-CAP component
INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '2.5x2.5', false, 1, '2.5x2.5 post caps'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'iron-post-cap';

INSERT INTO component_material_rules (product_type_id, component_id, material_subcategory, is_default, display_order, notes)
SELECT pt.id, cd.id, '3x3', false, 2, '3x3 post caps'
FROM product_types pt, component_definitions cd
WHERE pt.code = 'iron' AND cd.code = 'iron-post-cap';

-- ============================================
-- HELPER VIEW: Get eligible materials for a component
-- ============================================
CREATE OR REPLACE VIEW v_component_eligible_materials AS
SELECT
  cmr.id as rule_id,
  cmr.product_type_id,
  cmr.product_style_id,
  cmr.component_id,
  cd.code as component_code,
  cd.name as component_name,
  m.id as material_id,
  m.material_sku,
  m.material_name,
  m.category as material_category,
  m.sub_category as material_subcategory,
  m.unit_cost,
  m.unit_type,
  m.length_ft,
  m.actual_width,
  cmr.is_default,
  cmr.display_order,
  cmr.notes as rule_notes
FROM component_material_rules cmr
JOIN component_definitions cd ON cd.id = cmr.component_id
JOIN materials m ON
  m.status = 'Active' AND
  (
    -- Match by specific material
    (cmr.material_id IS NOT NULL AND m.id = cmr.material_id)
    OR
    -- Match by subcategory
    (cmr.material_subcategory IS NOT NULL AND m.sub_category = cmr.material_subcategory)
    OR
    -- Match by category (when no subcategory specified)
    (cmr.material_subcategory IS NULL AND cmr.material_category IS NOT NULL AND m.category = cmr.material_category)
  )
ORDER BY cmr.product_type_id, cd.display_order, cmr.display_order, m.material_name;
