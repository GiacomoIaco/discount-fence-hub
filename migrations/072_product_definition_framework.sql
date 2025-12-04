-- ============================================
-- Migration: Product Definition Framework
-- Purpose: Smart Hybrid architecture for BOM Calculator v2
-- Supports any fence product type with data-driven structure
-- and code-based calculations
-- ============================================

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

CREATE INDEX idx_materials_component_uses ON materials USING GIN(component_uses);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON product_types
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_product_styles_updated_at
  BEFORE UPDATE ON product_styles
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_formula_parameters_updated_at
  BEFORE UPDATE ON formula_parameters
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_component_formulas_updated_at
  BEFORE UPDATE ON component_formulas
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_product_rules_updated_at
  BEFORE UPDATE ON product_rules
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_product_labor_rules_updated_at
  BEFORE UPDATE ON product_labor_rules
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_product_skus_updated_at
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
INSERT INTO component_definitions (code, name, description, unit_type, display_order) VALUES
  ('post', 'Post', 'Vertical support structure set in concrete or surface mounted', 'Each', 1),
  ('picket', 'Picket', 'Vertical boards that make up the fence face (wood vertical)', 'Each', 2),
  ('rail', 'Rail', 'Horizontal support boards that pickets attach to', 'Each', 3),
  ('cap', 'Cap Board', 'Horizontal board along top of fence for finished look', 'Each', 4),
  ('trim', 'Trim Board', 'Vertical trim boards on posts for finished look', 'Each', 5),
  ('rot-board', 'Rot Board', 'Bottom board to protect pickets from ground moisture', 'Each', 6),
  ('steel-post-cap', 'Steel Post Cap', 'Cap for steel posts (dome or plug style)', 'Each', 7),
  ('bracket', 'Rail Bracket', 'Metal bracket to attach rails to steel posts', 'Each', 8),
  ('horizontal-board', 'Horizontal Board', 'Horizontal boards for horizontal fence styles', 'Each', 9),
  ('nailer', 'Nailer', 'Support piece for horizontal boards between posts', 'Each', 10),
  ('vertical-trim', 'Vertical Trim', 'Vertical trim for horizontal fences at posts', 'Each', 11),
  ('panel', 'Iron Panel', 'Pre-fabricated iron fence panel', 'Each', 12),
  ('iron-post-cap', 'Iron Post Cap', 'Decorative cap for iron fence posts', 'Each', 13),
  ('tension-wire', 'Tension Wire', 'Wire along bottom of chain link fence', 'Linear Feet', 14),
  ('mesh', 'Chain Link Mesh', 'Woven wire mesh fabric (sold in rolls)', 'Roll', 15),
  ('top-rail', 'Top Rail', 'Horizontal rail along top of chain link fence', 'Each', 16),
  ('tension-bar', 'Tension Bar', 'Vertical bar at terminal posts for chain link', 'Each', 17),
  ('ties', 'Wire Ties', 'Ties to attach mesh to posts and rails', 'Each', 18)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
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

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'exposed', 'Exposed Horizontal', 'Horizontal boards with posts visible on one side', 3
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

INSERT INTO product_styles (product_type_id, code, name, description, display_order)
SELECT id, 'iron-rail', 'Iron Rail (Decorative)', 'Decorative iron railing, typically shorter height (36-40 inches)', 3
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
VALUES (NULL, NULL, NULL, 'default_waste_factor', 1.025, 'Default 2.5% waste factor for materials');

-- Wood Vertical: Good Neighbor parameters
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, NULL, 'post_spacing', 7.71, 'Good Neighbor uses tighter spacing (92.5 inches)'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor';

INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.1, 'Good Neighbor needs 10% more pickets for both sides'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor';

-- Wood Vertical: Good Neighbor Builder (same as Good Neighbor)
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, NULL, 'post_spacing', 7.71, 'Good Neighbor Builder uses same tighter spacing'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor-builder';

INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.1, 'Good Neighbor Builder needs 10% more pickets'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'good-neighbor-builder';

-- Wood Vertical: Board on Board parameters
INSERT INTO formula_parameters (product_type_id, product_style_id, component_id, parameter_key, parameter_value, description)
SELECT pt.id, ps.id, cd.id, 'picket_multiplier', 1.14, 'Board on Board needs 14% more pickets due to overlap'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical' AND ps.code = 'board-on-board';

-- ============================================
-- SEED DATA: COMPONENT FORMULAS (Documentation)
-- ============================================

-- Wood Vertical: Post formula
INSERT INTO component_formulas (product_type_id, product_style_id, component_id, plain_english, formula_text, variables_used, notes)
SELECT pt.id, NULL, cd.id,
  'Number of sections plus 1. A section is the fence length divided by post spacing (8ft default, 7.71ft for Good Neighbor). Round up sections. Add extra posts for multiple fence lines: 1 extra for every 2 lines beyond 2.',
  'ceil(net_length / post_spacing) + 1 + ceil(max(lines - 2, 0) / 2)',
  ARRAY['net_length', 'post_spacing', 'lines'],
  'Post spacing varies by style. Gate posts handled separately.'
FROM product_types pt
JOIN component_definitions cd ON cd.code = 'post'
WHERE pt.code = 'wood-vertical';

-- Wood Vertical: Picket formula (Standard)
INSERT INTO component_formulas (product_type_id, product_style_id, component_id, plain_english, formula_text, variables_used, notes)
SELECT pt.id, ps.id, cd.id,
  'Convert fence length to inches, divide by picket width (actual width, e.g., 5.5 inches for 1x6), multiply by 2.5% waste factor. Round up.',
  'ceil((net_length * 12 / picket_width) * 1.025)',
  ARRAY['net_length', 'picket_width'],
  'Picket width comes from the selected picket material actual_width.'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical';

-- Wood Vertical: Picket formula (Good Neighbor)
INSERT INTO component_formulas (product_type_id, product_style_id, component_id, plain_english, formula_text, variables_used, notes)
SELECT pt.id, ps.id, cd.id,
  'Same as standard picket calculation, but multiply by 1.1 (10% more) because pickets alternate on both sides of the fence.',
  'ceil((net_length * 12 / picket_width) * 1.025 * 1.1)',
  ARRAY['net_length', 'picket_width'],
  'The 10% extra accounts for pickets on both sides.'
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor'
JOIN component_definitions cd ON cd.code = 'picket'
WHERE pt.code = 'wood-vertical';

-- Wood Vertical: Rail formula
INSERT INTO component_formulas (product_type_id, product_style_id, component_id, plain_english, formula_text, variables_used, notes)
SELECT pt.id, NULL, cd.id,
  'Number of sections (posts minus 1) multiplied by rails per section. 6ft fence typically has 2 rails, 8ft fence has 3-4 rails.',
  '(posts - 1) * rail_count',
  ARRAY['posts', 'rail_count'],
  'Rail count is stored in SKU config. Standard rail length is 8ft to match post spacing.'
FROM product_types pt
JOIN component_definitions cd ON cd.code = 'rail'
WHERE pt.code = 'wood-vertical';

-- Wood Vertical: Bracket formula (steel posts only)
INSERT INTO component_formulas (product_type_id, product_style_id, component_id, plain_english, formula_text, variables_used, notes)
SELECT pt.id, NULL, cd.id,
  'One bracket per rail per post. Only needed for steel posts.',
  'posts * rail_count',
  ARRAY['posts', 'rail_count'],
  'Only calculated when post_type is STEEL.'
FROM product_types pt
JOIN component_definitions cd ON cd.code = 'bracket'
WHERE pt.code = 'wood-vertical';

-- ============================================
-- SEED DATA: PRODUCT RULES
-- ============================================

-- Rule: 6ft fence uses 6ft pickets
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'material_match',
  'Match picket length to fence height (6ft)',
  '6-foot fences should use 6-foot pickets',
  '{"height": 6, "component": "picket"}',
  '{"filter_materials": {"length_ft": 6}}',
  10
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: 8ft fence uses 8ft pickets
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'material_match',
  'Match picket length to fence height (8ft)',
  '8-foot fences should use 8-foot pickets',
  '{"height": 8, "component": "picket"}',
  '{"filter_materials": {"length_ft": 8}}',
  10
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: 8ft fence requires 3 or 4 rails
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, error_message, priority)
SELECT pt.id, 'constraint',
  'Rail count for 8ft fence',
  '8-foot fences must have 3 or 4 rails for structural support',
  '{"height": 8}',
  '{"field": "rail_count", "allowed": [3, 4]}',
  '8-foot fences require 3 or 4 rails',
  20
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Steel post type requires steel post material
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'material_match',
  'Steel post type uses steel materials',
  'When post type is STEEL, only show steel post materials',
  '{"post_type": "STEEL", "component": "post"}',
  '{"filter_materials": {"sub_category": "Steel Post"}}',
  15
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Wood post type requires wood post material
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'material_match',
  'Wood post type uses wood materials',
  'When post type is WOOD, only show wood post materials',
  '{"post_type": "WOOD", "component": "post"}',
  '{"filter_materials": {"sub_category": "Wood 4x4"}}',
  15
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Steel post cap is PLUG when cap+trim present
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'derived_value',
  'Steel post cap type with cap and trim',
  'When using steel posts with both cap and trim, use plug-style post caps',
  '{"post_type": "STEEL", "has_component": ["cap", "trim"]}',
  '{"component": "steel-post-cap", "filter_materials": {"sub_category": "Plug"}}',
  10
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Steel post cap is DOME by default
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'derived_value',
  'Steel post cap type default',
  'When using steel posts without cap and trim, use dome-style post caps',
  '{"post_type": "STEEL"}',
  '{"component": "steel-post-cap", "filter_materials": {"sub_category": "Dome"}}',
  5
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Gate posts for wood post fences
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'conditional_component',
  'Gate posts for wood fences',
  'When using wood posts with gates, add 2 steel posts per gate and remove 1 wood post per gate',
  '{"post_type": "WOOD", "gates": {">": 0}}',
  '{"add": {"component": "post", "material_filter": {"sub_category": "Steel Post"}, "quantity": "gates * 2"}, "remove": {"component": "post", "quantity": "gates * 1"}}',
  25
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- Rule: Gate posts for steel post fences
INSERT INTO product_rules (product_type_id, rule_type, name, plain_english, condition_json, action_json, priority)
SELECT pt.id, 'conditional_component',
  'Gate posts for steel fences',
  'When using steel posts with gates, add 1 extra steel post per gate',
  '{"post_type": "STEEL", "gates": {">": 0}}',
  '{"add": {"component": "post", "quantity": "gates * 1"}}',
  25
FROM product_types pt WHERE pt.code = 'wood-vertical';

-- ============================================
-- SEED DATA: PRODUCT LABOR RULES
-- ============================================

-- W02: Set Post 8' OC (base labor for all wood vertical)
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Set Post labor',
  'Set posts 8 feet on center. Applies to all wood vertical fences. Charged per linear foot.',
  '{}',
  'net_length',
  true
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W02'
WHERE pt.code = 'wood-vertical';

-- W03: Nail Up 6ft with WOOD posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Nail-up 6ft wood post',
  'Nail-up labor for vertical fences up to 6 feet tall with wood posts. Charged per linear foot.',
  '{"height": {"max": 6}, "post_type": "WOOD"}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W03'
WHERE pt.code = 'wood-vertical';

-- W04: Nail Up 7-8ft with WOOD posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Nail-up 7-8ft wood post',
  'Nail-up labor for vertical fences 7 or 8 feet tall with wood posts. Charged per linear foot.',
  '{"height": {"min": 7}, "post_type": "WOOD"}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W04'
WHERE pt.code = 'wood-vertical';

-- M03: Nail Up 6ft with STEEL posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Nail-up 6ft steel post',
  'Nail-up labor for vertical fences up to 6 feet tall with steel posts. Charged per linear foot.',
  '{"height": {"max": 6}, "post_type": "STEEL"}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'M03'
WHERE pt.code = 'wood-vertical';

-- M04: Nail Up 7-8ft with STEEL posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Nail-up 7-8ft steel post',
  'Nail-up labor for vertical fences 7 or 8 feet tall with steel posts. Charged per linear foot.',
  '{"height": {"min": 7}, "post_type": "STEEL"}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'M04'
WHERE pt.code = 'wood-vertical';

-- W06: Good Neighbor Style with WOOD posts
INSERT INTO product_labor_rules (product_type_id, product_style_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, ps.id, lc.id,
  'Good Neighbor style labor (wood)',
  'Additional labor for Good Neighbor style with wood posts. Charged per linear foot.',
  '{"post_type": "WOOD"}',
  'net_length',
  false
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor'
JOIN labor_codes lc ON lc.labor_sku = 'W06'
WHERE pt.code = 'wood-vertical';

-- M06: Good Neighbor Style with STEEL posts
INSERT INTO product_labor_rules (product_type_id, product_style_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, ps.id, lc.id,
  'Good Neighbor style labor (steel)',
  'Additional labor for Good Neighbor style with steel posts. Charged per linear foot.',
  '{"post_type": "STEEL"}',
  'net_length',
  false
FROM product_types pt
JOIN product_styles ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor'
JOIN labor_codes lc ON lc.labor_sku = 'M06'
WHERE pt.code = 'wood-vertical';

-- W07: Cap and Trim with WOOD posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Cap and Trim labor (wood)',
  'Labor for installing cap and trim with wood posts. Charged per linear foot.',
  '{"post_type": "WOOD", "has_component": ["cap", "trim"]}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W07'
WHERE pt.code = 'wood-vertical';

-- M07: Cap and Trim with STEEL posts
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Cap and Trim labor (steel)',
  'Labor for installing cap and trim with steel posts. Charged per linear foot.',
  '{"post_type": "STEEL", "has_component": ["cap", "trim"]}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'M07'
WHERE pt.code = 'wood-vertical';

-- W09: Just Cap
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Cap only labor',
  'Labor for installing cap board only (no trim). Charged per linear foot.',
  '{"has_component": ["cap"], "not_has_component": ["trim"]}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W09'
WHERE pt.code = 'wood-vertical';

-- W08: Just Trim
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Trim only labor',
  'Labor for installing trim only (no cap). Charged per linear foot.',
  '{"has_component": ["trim"], "not_has_component": ["cap"]}',
  'net_length',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W08'
WHERE pt.code = 'wood-vertical';

-- W10: Gate 6ft
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Gate labor (6ft)',
  'Labor for building and hanging wood gate up to 6ft tall. Charged per gate.',
  '{"height": {"max": 6}, "gates": {">": 0}}',
  'gates',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W10'
WHERE pt.code = 'wood-vertical';

-- W11: Gate 8ft
INSERT INTO product_labor_rules (product_type_id, labor_code_id, name, plain_english, condition_json, quantity_formula, is_base_labor)
SELECT pt.id, lc.id,
  'Gate labor (8ft)',
  'Labor for building and hanging wood gate 7 or 8ft tall. Charged per gate.',
  '{"height": {"min": 7}, "gates": {">": 0}}',
  'gates',
  false
FROM product_types pt
JOIN labor_codes lc ON lc.labor_sku = 'W11'
WHERE pt.code = 'wood-vertical';
