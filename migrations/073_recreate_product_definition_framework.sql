-- ============================================
-- Migration: Recreate Product Definition Framework
-- Purpose: Drop and recreate v2 tables cleanly
-- ============================================

-- Drop existing tables if they exist (in dependency order)
DROP TABLE IF EXISTS sku_components CASCADE;
DROP TABLE IF EXISTS product_skus CASCADE;
DROP TABLE IF EXISTS product_labor_rules CASCADE;
DROP TABLE IF EXISTS product_rules CASCADE;
DROP TABLE IF EXISTS component_formulas CASCADE;
DROP TABLE IF EXISTS formula_parameters CASCADE;
DROP TABLE IF EXISTS product_type_components CASCADE;
DROP TABLE IF EXISTS component_definitions CASCADE;
DROP TABLE IF EXISTS product_styles CASCADE;
DROP TABLE IF EXISTS product_types CASCADE;

-- ============================================
-- 1. PRODUCT TYPES
-- The main fence categories (Wood Vertical, Iron, Chain Link, etc.)
-- ============================================
CREATE TABLE product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'wood-vertical', 'chain-link'
  name TEXT NOT NULL,                     -- 'Wood Vertical Fence'
  description TEXT,                       -- For documentation/AI reference
  default_post_spacing DECIMAL(10,2),     -- 8.0 (feet)
  calculator_class TEXT NOT NULL,         -- 'WoodVerticalCalculator'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_types IS 'Main fence product categories. Each type has its own calculator class.';
COMMENT ON COLUMN product_types.calculator_class IS 'TypeScript class name that handles calculations for this type';

-- ============================================
-- 2. PRODUCT STYLES
-- Variations within a product type (Standard, Good Neighbor, etc.)
-- ============================================
CREATE TABLE product_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                     -- 'good-neighbor'
  name TEXT NOT NULL,                     -- 'Good Neighbor'
  description TEXT,                       -- 'Finished both sides, alternating pickets'
  default_components JSONB,               -- Optional default component settings
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, code)
);

COMMENT ON TABLE product_styles IS 'Style variations within a product type. Styles may have different formulas/parameters.';

-- ============================================
-- 3. COMPONENT DEFINITIONS
-- Master list of all possible components (Post, Picket, Rail, Panel, etc.)
-- ============================================
CREATE TABLE component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'post', 'picket', 'mesh'
  name TEXT NOT NULL,                     -- 'Post'
  description TEXT,                       -- 'Vertical support structure set in concrete'
  category TEXT,                          -- 'primary', 'optional', 'accessory'
  calculation_type TEXT,                  -- 'formula', 'lookup', 'fixed'
  unit_type TEXT NOT NULL DEFAULT 'Each', -- 'Each', 'Linear Feet', 'Roll'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE component_definitions IS 'Master list of all fence components across all product types.';

-- ============================================
-- 4. PRODUCT TYPE COMPONENTS
-- Junction: Which components does each product type use?
-- ============================================
CREATE TABLE product_type_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,      -- Must have a material assigned
  description TEXT,                       -- 'The main vertical boards'
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, component_id)
);

COMMENT ON TABLE product_type_components IS 'Defines which components each product type uses.';

-- ============================================
-- 5. FORMULA PARAMETERS
-- Configurable values used by calculator classes
-- ============================================
CREATE TABLE formula_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles(id) ON DELETE CASCADE,
  component_id UUID REFERENCES component_definitions(id) ON DELETE CASCADE,
  parameter_key TEXT NOT NULL,            -- 'waste_factor', 'picket_multiplier', 'post_spacing'
  parameter_value DECIMAL(10,4) NOT NULL, -- 1.025, 1.1, 7.71
  description TEXT,                       -- 'Good Neighbor needs 10% more pickets'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique per scope (null-safe)
  UNIQUE NULLS NOT DISTINCT (product_type_id, product_style_id, component_id, parameter_key)
);

COMMENT ON TABLE formula_parameters IS 'Configurable calculation parameters. Calculator reads these at runtime.';
COMMENT ON COLUMN formula_parameters.parameter_key IS 'Parameter name used in calculator code';

-- ============================================
-- 6. COMPONENT FORMULAS (Documentation)
-- Plain English + formula text for reference (NOT executed)
-- ============================================
CREATE TABLE component_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  plain_english TEXT NOT NULL,            -- Human readable explanation
  formula_text TEXT,                      -- 'ceil(net_length / spacing) + 1'
  variables_used TEXT[],                  -- ['net_length', 'post_spacing', 'lines']
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (product_type_id, product_style_id, component_id)
);

COMMENT ON TABLE component_formulas IS 'Documentation of formulas. Plain English for team reference, formula_text for developers.';

-- ============================================
-- 7. PRODUCT RULES
-- Business rules: constraints, material matching, conditional components
-- ============================================
CREATE TABLE product_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,                -- 'constraint', 'material_match', 'conditional_component', 'derived_value'
  name TEXT NOT NULL,                     -- 'Rail count for 8ft fence'
  plain_english TEXT NOT NULL,            -- '8-foot fences must have 3 or 4 rails'
  condition_json JSONB NOT NULL DEFAULT '{}',  -- {"height": 8}
  action_json JSONB NOT NULL,             -- {"field": "rail_count", "allowed": [3, 4]}
  error_message TEXT,                     -- For constraint violations
  priority INTEGER DEFAULT 0,             -- Higher = evaluated first
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_rules IS 'Business rules evaluated by RuleEngine. Includes constraints, material matching, conditional components.';

-- ============================================
-- 8. PRODUCT LABOR RULES
-- Which labor codes apply under what conditions
-- ============================================
CREATE TABLE product_labor_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- 'Nail-up for 6ft wood post'
  plain_english TEXT NOT NULL,            -- 'Nail-up labor for fences up to 6ft with wood posts'
  condition_json JSONB DEFAULT '{}',      -- {"height": {"max": 6}, "post_type": "WOOD"}
  quantity_formula TEXT NOT NULL DEFAULT 'net_length',  -- 'net_length', 'gates', 'posts'
  is_base_labor BOOLEAN DEFAULT false,    -- Always included for this type
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_labor_rules IS 'Maps labor codes to product types with conditions. Used by calculator to determine applicable labor.';

-- ============================================
-- 9. MATERIALS: Add component_uses column
-- ============================================
ALTER TABLE materials
ADD COLUMN IF NOT EXISTS component_uses TEXT[];

COMMENT ON COLUMN materials.component_uses IS 'Array of component codes this material can be used for, e.g., [''post'', ''picket'', ''vertical-trim'']';

-- ============================================
-- 10. PRODUCT SKUS (Unified)
-- Single table for ALL product types (replaces wood_vertical_products, etc.)
-- ============================================
CREATE TABLE product_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code TEXT UNIQUE NOT NULL,          -- 'A01', 'CL01'
  sku_name TEXT NOT NULL,                 -- '6'' Ver 1x6 : 2R : WOOD Post'

  -- Type & Style references
  product_type_id UUID NOT NULL REFERENCES product_types(id),
  product_style_id UUID NOT NULL REFERENCES product_styles(id),

  -- Common specifications (all product types have these)
  height INTEGER NOT NULL,                -- feet
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),
  post_spacing DECIMAL(10,2),             -- NULL = use style/type default

  -- Type-specific config (flexible JSON for rail_count, board_width, panel_width, etc.)
  config_json JSONB DEFAULT '{}',

  -- Cached costs (updated when SKU is saved/recalculated)
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_skus IS 'Unified SKU table for all product types. Replaces wood_vertical_products, wood_horizontal_products, iron_products.';
COMMENT ON COLUMN product_skus.config_json IS 'Type-specific configuration: rail_count, board_width, panel_width, etc.';

-- ============================================
-- 11. SKU COMPONENTS
-- Junction: Which material is assigned to each component for each SKU
-- ============================================
CREATE TABLE sku_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES component_definitions(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sku_id, component_id)
);

COMMENT ON TABLE sku_components IS 'Maps materials to components for each SKU. E.g., SKU A01 uses PS13 for post, P601 for picket.';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_product_styles_type ON product_styles(product_type_id);
CREATE INDEX idx_product_styles_active ON product_styles(is_active) WHERE is_active = true;

CREATE INDEX idx_product_type_components_type ON product_type_components(product_type_id);
CREATE INDEX idx_product_type_components_component ON product_type_components(component_id);

CREATE INDEX idx_formula_parameters_type ON formula_parameters(product_type_id);
CREATE INDEX idx_formula_parameters_style ON formula_parameters(product_style_id);
CREATE INDEX idx_formula_parameters_component ON formula_parameters(component_id);

CREATE INDEX idx_component_formulas_type ON component_formulas(product_type_id);
CREATE INDEX idx_component_formulas_style ON component_formulas(product_style_id);

CREATE INDEX idx_product_rules_type ON product_rules(product_type_id);
CREATE INDEX idx_product_rules_style ON product_rules(product_style_id);
CREATE INDEX idx_product_rules_active ON product_rules(is_active) WHERE is_active = true;

CREATE INDEX idx_product_labor_rules_type ON product_labor_rules(product_type_id);
CREATE INDEX idx_product_labor_rules_labor ON product_labor_rules(labor_code_id);
CREATE INDEX idx_product_labor_rules_active ON product_labor_rules(is_active) WHERE is_active = true;

CREATE INDEX idx_product_skus_type ON product_skus(product_type_id);
CREATE INDEX idx_product_skus_style ON product_skus(product_style_id);
CREATE INDEX idx_product_skus_active ON product_skus(is_active) WHERE is_active = true;
CREATE INDEX idx_product_skus_code ON product_skus(sku_code);

CREATE INDEX idx_sku_components_sku ON sku_components(sku_id);
CREATE INDEX idx_sku_components_material ON sku_components(material_id);

CREATE INDEX IF NOT EXISTS idx_materials_component_uses ON materials USING GIN(component_uses);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_product_styles_updated_at
  BEFORE UPDATE ON product_styles
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_formula_parameters_updated_at
  BEFORE UPDATE ON formula_parameters
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_component_formulas_updated_at
  BEFORE UPDATE ON component_formulas
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_product_rules_updated_at
  BEFORE UPDATE ON product_rules
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_product_labor_rules_updated_at
  BEFORE UPDATE ON product_labor_rules
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE OR REPLACE TRIGGER update_product_skus_updated_at
  BEFORE UPDATE ON product_skus
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_type_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_labor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_components ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "read_product_types" ON product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_styles" ON product_styles FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_component_definitions" ON component_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_type_components" ON product_type_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_formula_parameters" ON formula_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_component_formulas" ON component_formulas FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_rules" ON product_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_labor_rules" ON product_labor_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_skus" ON product_skus FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_sku_components" ON sku_components FOR SELECT TO authenticated USING (true);

-- Write access for all authenticated users (restrict to admin in app layer)
CREATE POLICY "write_product_types" ON product_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_styles" ON product_styles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_component_definitions" ON component_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_type_components" ON product_type_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_formula_parameters" ON formula_parameters FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_component_formulas" ON component_formulas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_rules" ON product_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_labor_rules" ON product_labor_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_skus" ON product_skus FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_sku_components" ON sku_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA: COMPONENT DEFINITIONS
-- ============================================
INSERT INTO component_definitions (code, name, description, category, calculation_type, unit_type, display_order) VALUES
  ('post', 'Post', 'Vertical support structure set in concrete or surface mounted', 'primary', 'formula', 'Each', 1),
  ('picket', 'Picket', 'Vertical boards that make up the fence face (wood vertical)', 'primary', 'formula', 'Each', 2),
  ('rail', 'Rail', 'Horizontal support boards that pickets attach to', 'primary', 'formula', 'Each', 3),
  ('cap', 'Cap Board', 'Horizontal board along top of fence for finished look', 'optional', 'formula', 'Each', 4),
  ('trim', 'Trim Board', 'Vertical trim boards on posts for finished look', 'optional', 'formula', 'Each', 5),
  ('rot-board', 'Rot Board', 'Bottom board to protect pickets from ground moisture', 'optional', 'formula', 'Each', 6),
  ('steel-post-cap', 'Steel Post Cap', 'Cap for steel posts (dome or plug style)', 'accessory', 'formula', 'Each', 7),
  ('bracket', 'Rail Bracket', 'Metal bracket to attach rails to steel posts', 'accessory', 'formula', 'Each', 8),
  ('horizontal-board', 'Horizontal Board', 'Horizontal boards for horizontal fence styles', 'primary', 'formula', 'Each', 9),
  ('nailer', 'Nailer', 'Support piece for horizontal boards between posts', 'primary', 'formula', 'Each', 10),
  ('vertical-trim', 'Vertical Trim', 'Vertical trim for horizontal fences at posts', 'optional', 'formula', 'Each', 11),
  ('panel', 'Iron Panel', 'Pre-fabricated iron fence panel', 'primary', 'formula', 'Each', 12),
  ('iron-post-cap', 'Iron Post Cap', 'Decorative cap for iron fence posts', 'accessory', 'lookup', 'Each', 13),
  ('tension-wire', 'Tension Wire', 'Wire along bottom of chain link fence', 'primary', 'formula', 'Linear Feet', 14),
  ('mesh', 'Chain Link Mesh', 'Woven wire mesh fabric (sold in rolls)', 'primary', 'formula', 'Roll', 15),
  ('top-rail', 'Top Rail', 'Horizontal rail along top of chain link fence', 'primary', 'formula', 'Each', 16),
  ('tension-bar', 'Tension Bar', 'Vertical bar at terminal posts for chain link', 'accessory', 'formula', 'Each', 17),
  ('ties', 'Wire Ties', 'Ties to attach mesh to posts and rails', 'accessory', 'formula', 'Each', 18)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  calculation_type = EXCLUDED.calculation_type,
  unit_type = EXCLUDED.unit_type,
  display_order = EXCLUDED.display_order;

-- ============================================
-- SEED DATA: PRODUCT TYPES
-- ============================================
INSERT INTO product_types (code, name, description, default_post_spacing, calculator_class, display_order) VALUES
  ('wood-vertical', 'Wood Vertical Fence', 'Traditional vertical picket fence with posts, rails, and vertical pickets. Most common residential fence type.', 8.0, 'WoodVerticalCalculator', 1),
  ('wood-horizontal', 'Wood Horizontal Fence', 'Modern horizontal board fence. Boards run horizontally between posts.', 6.0, 'WoodHorizontalCalculator', 2),
  ('iron', 'Iron Fence', 'Ornamental iron/steel fence with welded or bracketed panels.', 8.0, 'IronCalculator', 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_post_spacing = EXCLUDED.default_post_spacing,
  calculator_class = EXCLUDED.calculator_class,
  display_order = EXCLUDED.display_order;

-- ============================================
-- SEED DATA: PRODUCT STYLES
-- ============================================

-- Wood Vertical Styles
INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'standard', 'Standard', 'Basic vertical picket fence with pickets on one side', 1
FROM product_types WHERE code = 'wood-vertical'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'good-neighbor', 'Good Neighbor', 'Finished on both sides with alternating pickets. Requires 10% more pickets and tighter post spacing (7.71ft).', 2
FROM product_types WHERE code = 'wood-vertical'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'good-neighbor-builder', 'Good Neighbor (Builder)', 'Good Neighbor style for home builder projects. Same construction as Good Neighbor.', 3
FROM product_types WHERE code = 'wood-vertical'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'board-on-board', 'Board on Board', 'Overlapping pickets for privacy. Requires 14% more pickets due to overlap.', 4
FROM product_types WHERE code = 'wood-vertical'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Wood Horizontal Styles
INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'standard', 'Standard Horizontal', 'Basic horizontal fence with boards on one side', 1
FROM product_types WHERE code = 'wood-horizontal'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'good-neighbor', 'Good Neighbor Horizontal', 'Horizontal boards on both sides of posts', 2
FROM product_types WHERE code = 'wood-horizontal'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Iron Styles
INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'standard-2rail', 'Standard 2 Rail', 'Standard welded iron fence with 2 horizontal rails', 1
FROM product_types WHERE code = 'iron'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'ameristar-3rail', 'Ameristar 3 Rail', 'Ameristar-style fence with 3 rails and bracket system (no welding)', 2
FROM product_types WHERE code = 'iron'
ON CONFLICT (product_type_id, code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================
-- SEED DATA: PRODUCT TYPE COMPONENTS
-- ============================================

-- Wood Vertical Components
INSERT INTO product_type_components (product_type_id, component_id, is_required, description, display_order)
SELECT pt.id, cd.id,
  CASE cd.code
    WHEN 'post' THEN true
    WHEN 'picket' THEN true
    WHEN 'rail' THEN true
    ELSE false
  END,
  CASE cd.code
    WHEN 'post' THEN 'Vertical posts set in concrete, typically 8ft apart'
    WHEN 'picket' THEN 'Vertical boards attached to rails'
    WHEN 'rail' THEN 'Horizontal supports between posts (2 for 6ft, 3-4 for 8ft)'
    WHEN 'cap' THEN 'Optional top cap board for finished look'
    WHEN 'trim' THEN 'Optional vertical trim on posts'
    WHEN 'rot-board' THEN 'Optional bottom board to protect from moisture'
    WHEN 'steel-post-cap' THEN 'Required for steel posts (dome or plug)'
    WHEN 'bracket' THEN 'Required for steel posts to attach rails'
  END,
  cd.display_order
FROM product_types pt
CROSS JOIN component_definitions cd
WHERE pt.code = 'wood-vertical'
  AND cd.code IN ('post', 'picket', 'rail', 'cap', 'trim', 'rot-board', 'steel-post-cap', 'bracket')
ON CONFLICT (product_type_id, component_id) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- Wood Horizontal Components
INSERT INTO product_type_components (product_type_id, component_id, is_required, description, display_order)
SELECT pt.id, cd.id,
  CASE cd.code
    WHEN 'post' THEN true
    WHEN 'horizontal-board' THEN true
    ELSE false
  END,
  CASE cd.code
    WHEN 'post' THEN 'Vertical posts, typically 6ft apart for horizontal'
    WHEN 'horizontal-board' THEN 'Horizontal boards running between posts'
    WHEN 'nailer' THEN 'Mid-span support for horizontal boards'
    WHEN 'cap' THEN 'Optional top cap board'
    WHEN 'vertical-trim' THEN 'Vertical trim at posts'
    WHEN 'steel-post-cap' THEN 'Required for steel posts'
  END,
  cd.display_order
FROM product_types pt
CROSS JOIN component_definitions cd
WHERE pt.code = 'wood-horizontal'
  AND cd.code IN ('post', 'horizontal-board', 'nailer', 'cap', 'vertical-trim', 'steel-post-cap')
ON CONFLICT (product_type_id, component_id) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- Iron Components
INSERT INTO product_type_components (product_type_id, component_id, is_required, description, display_order)
SELECT pt.id, cd.id,
  CASE cd.code
    WHEN 'post' THEN true
    WHEN 'panel' THEN true
    ELSE false
  END,
  CASE cd.code
    WHEN 'post' THEN 'Iron/steel posts, typically 8ft apart'
    WHEN 'panel' THEN 'Pre-fabricated iron fence panels'
    WHEN 'bracket' THEN 'Brackets for Ameristar-style (non-welded)'
    WHEN 'iron-post-cap' THEN 'Decorative post caps'
  END,
  cd.display_order
FROM product_types pt
CROSS JOIN component_definitions cd
WHERE pt.code = 'iron'
  AND cd.code IN ('post', 'panel', 'bracket', 'iron-post-cap')
ON CONFLICT (product_type_id, component_id) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- ============================================
-- SEED DATA: FORMULA PARAMETERS
-- ============================================

-- Global waste factor (applies to all types)
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
VALUES (NULL, NULL, NULL, 'default_waste_factor', 1.025, 'Default 2.5% waste factor for materials')
ON CONFLICT DO NOTHING;

-- Wood Vertical: Standard parameters (default 8ft spacing)
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, NULL, 'post_spacing', 8.0, 'Standard uses default 8ft spacing'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
WHERE pt.code = 'wood-vertical' AND ps.code = 'standard'
ON CONFLICT DO NOTHING;

-- Wood Vertical: Good Neighbor parameters
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, NULL, 'post_spacing', 7.71, 'Good Neighbor uses tighter spacing (92.5 inches)'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor'
ON CONFLICT DO NOTHING;

INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.1, 'Good Neighbor needs 10% more pickets for both sides'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor'
ON CONFLICT DO NOTHING;

-- Wood Vertical: Good Neighbor Builder (same as Good Neighbor)
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, NULL, 'post_spacing', 7.71, 'Good Neighbor Builder uses same tighter spacing'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor-builder'
ON CONFLICT DO NOTHING;

INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.1, 'Good Neighbor Builder needs 10% more pickets'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor-builder'
ON CONFLICT DO NOTHING;

-- Wood Vertical: Board on Board parameters
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.14, 'Board on Board needs 14% more pickets due to overlap'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'board-on-board'
ON CONFLICT DO NOTHING;
