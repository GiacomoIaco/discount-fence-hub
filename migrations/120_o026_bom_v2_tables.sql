-- ============================================
-- Migration 120: O-026 BOM Calculator V2 Tables
-- ============================================
-- Creates new formula-based architecture for BOM Calculator V2
-- Drops abandoned experiment tables from migrations 072-079
--
-- V1 tables (UNTOUCHED): wood_vertical_products, wood_horizontal_products,
--                        iron_products, custom_products, bom_projects
-- Shared tables (READ): materials, labor_codes, labor_rates, components,
--                       component_material_eligibility
-- ============================================

-- ============================================
-- PART 1: DROP ABANDONED V2 EXPERIMENT TABLES
-- These were created in migrations 072-079 but never used
-- ============================================

-- Drop views first
DROP VIEW IF EXISTS v_component_eligible_materials_v2 CASCADE;

-- Drop _v2 suffix tables (from 079d rename)
DROP TABLE IF EXISTS sku_components_v2 CASCADE;
DROP TABLE IF EXISTS component_material_rules_v2 CASCADE;
DROP TABLE IF EXISTS component_formulas_v2 CASCADE;
DROP TABLE IF EXISTS formula_parameters_v2 CASCADE;
DROP TABLE IF EXISTS product_type_components_v2 CASCADE;
DROP TABLE IF EXISTS component_definitions_v2 CASCADE;

-- Drop non-suffix tables (from 072-073)
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

-- Drop from 074
DROP TABLE IF EXISTS component_material_rules CASCADE;

-- ============================================
-- PART 2: CREATE NEW V2 TABLES
-- ============================================

-- 2.1 Product Types
CREATE TABLE product_types_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'wood_vertical', 'iron'
  name TEXT NOT NULL,                     -- 'Wood Vertical'
  description TEXT,
  default_post_spacing DECIMAL(10,2),     -- 8.0 feet
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE product_types_v2 IS 'O-026: Main fence product categories';

-- 2.2 Product Styles
CREATE TABLE product_styles_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                     -- 'good_neighbor'
  name TEXT NOT NULL,                     -- 'Good Neighbor'
  description TEXT,
  formula_adjustments JSONB DEFAULT '{}', -- {"post_spacing": 7.71, "picket_multiplier": 1.11}
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, code)
);

COMMENT ON TABLE product_styles_v2 IS 'O-026: Style variations with formula adjustments';

-- 2.3 Product Variables
CREATE TABLE product_variables_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  variable_code TEXT NOT NULL,            -- 'rail_count', 'board_width'
  variable_name TEXT NOT NULL,            -- 'Rail Count'
  variable_type TEXT NOT NULL DEFAULT 'integer', -- 'integer', 'decimal', 'select'
  default_value TEXT,
  allowed_values TEXT[],                  -- For select: ['2', '3', '4']
  unit TEXT,                              -- 'ft', 'in', NULL
  is_required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, variable_code)
);

COMMENT ON TABLE product_variables_v2 IS 'O-026: Input variables per product type for SKU Builder';

-- 2.4 Component Types
CREATE TABLE component_types_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'post', 'picket', 'rail'
  name TEXT NOT NULL,                     -- 'Post'
  description TEXT,
  unit_type TEXT NOT NULL DEFAULT 'Each', -- 'Each', 'Linear Feet', 'Box'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE component_types_v2 IS 'O-026: Master list of fence components';

-- 2.5 Formula Templates (THE CORE TABLE)
CREATE TABLE formula_templates_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  product_style_id UUID REFERENCES product_styles_v2(id) ON DELETE CASCADE, -- NULL = all styles
  component_type_id UUID NOT NULL REFERENCES component_types_v2(id) ON DELETE CASCADE,

  -- The executable formula
  formula TEXT NOT NULL,
  -- Examples:
  -- 'ROUNDUP([Quantity]/[post_spacing])+1'
  -- '[Quantity]*12/[picket.width_inches]*1.025*[picket_multiplier]'

  -- Rounding control
  rounding_level TEXT NOT NULL DEFAULT 'sku' CHECK (rounding_level IN ('sku', 'project', 'none')),

  -- Documentation
  plain_english TEXT,
  notes TEXT,

  -- Priority for style overrides (higher wins)
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE NULLS NOT DISTINCT (product_type_id, product_style_id, component_type_id)
);

COMMENT ON TABLE formula_templates_v2 IS 'O-026: Executable formulas replacing FenceCalculator.ts';
COMMENT ON COLUMN formula_templates_v2.rounding_level IS 'sku=round per SKU, project=aggregate then round, none=keep decimals';

-- 2.6 SKU Catalog (Unified)
CREATE TABLE sku_catalog_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code TEXT UNIQUE NOT NULL,          -- 'A01', 'H01', 'I01'
  sku_name TEXT NOT NULL,                 -- "6' Ver 1x6 : 2R : WOOD Post"

  product_type_id UUID NOT NULL REFERENCES product_types_v2(id),
  product_style_id UUID NOT NULL REFERENCES product_styles_v2(id),

  height INTEGER NOT NULL,                -- feet
  post_type TEXT NOT NULL CHECK (post_type IN ('WOOD', 'STEEL')),

  -- Product-specific variables (JSONB)
  variables JSONB DEFAULT '{}',
  -- {"rail_count": 2, "post_spacing": 8}

  -- Component-to-material mappings (JSONB)
  components JSONB DEFAULT '{}',
  -- {"post": "PS13", "picket": "P601", "rail": "R201"}

  -- Custom formula overrides (optional)
  custom_formulas JSONB DEFAULT NULL,

  -- Cached costs
  standard_material_cost DECIMAL(10,2),
  standard_labor_cost DECIMAL(10,2),
  standard_cost_per_foot DECIMAL(10,2),
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Service Titan
  service_titan_id TEXT,

  product_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sku_catalog_v2 IS 'O-026: Unified SKU table with JSONB for variables/components';

-- 2.7 BOM Projects V2
CREATE TABLE bom_projects_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  customer_name TEXT,

  -- Project inputs
  net_length DECIMAL(10,2) NOT NULL,
  number_of_lines INTEGER DEFAULT 1,
  number_of_gates INTEGER DEFAULT 0,

  -- Selected SKU
  sku_id UUID REFERENCES sku_catalog_v2(id),

  -- Calculated results (JSONB)
  materials_result JSONB,
  labor_result JSONB,

  -- Totals
  total_material_cost DECIMAL(10,2),
  total_labor_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),

  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bom_projects_v2 IS 'O-026: V2 project storage (separate from V1)';

-- ============================================
-- PART 3: ADD MATERIAL DIMENSION COLUMNS
-- ============================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS width_inches DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS length_feet DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS qty_per_unit INTEGER;

COMMENT ON COLUMN materials.width_inches IS 'Material width in inches (e.g., 5.5 for 1x6 actual)';
COMMENT ON COLUMN materials.length_feet IS 'Material length in feet (e.g., 6, 8)';
COMMENT ON COLUMN materials.qty_per_unit IS 'Quantity per unit (e.g., 300 nails per coil)';

-- ============================================
-- PART 4: INDEXES
-- ============================================

CREATE INDEX idx_product_styles_v2_type ON product_styles_v2(product_type_id);
CREATE INDEX idx_product_variables_v2_type ON product_variables_v2(product_type_id);
CREATE INDEX idx_formula_templates_v2_type ON formula_templates_v2(product_type_id);
CREATE INDEX idx_formula_templates_v2_style ON formula_templates_v2(product_style_id);
CREATE INDEX idx_formula_templates_v2_component ON formula_templates_v2(component_type_id);
CREATE INDEX idx_sku_catalog_v2_type ON sku_catalog_v2(product_type_id);
CREATE INDEX idx_sku_catalog_v2_style ON sku_catalog_v2(product_style_id);
CREATE INDEX idx_sku_catalog_v2_active ON sku_catalog_v2(is_active) WHERE is_active = true;
CREATE INDEX idx_sku_catalog_v2_variables ON sku_catalog_v2 USING GIN(variables);
CREATE INDEX idx_sku_catalog_v2_components ON sku_catalog_v2 USING GIN(components);
CREATE INDEX idx_bom_projects_v2_created_by ON bom_projects_v2(created_by);
CREATE INDEX idx_bom_projects_v2_status ON bom_projects_v2(status);

-- ============================================
-- PART 5: TRIGGERS
-- ============================================

CREATE TRIGGER update_product_types_v2_updated_at
  BEFORE UPDATE ON product_types_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_product_styles_v2_updated_at
  BEFORE UPDATE ON product_styles_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_formula_templates_v2_updated_at
  BEFORE UPDATE ON formula_templates_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_sku_catalog_v2_updated_at
  BEFORE UPDATE ON sku_catalog_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_bom_projects_v2_updated_at
  BEFORE UPDATE ON bom_projects_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- PART 6: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE product_types_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_styles_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variables_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_types_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_templates_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_catalog_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_projects_v2 ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated
CREATE POLICY "read_product_types_v2" ON product_types_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_styles_v2" ON product_styles_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_variables_v2" ON product_variables_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_component_types_v2" ON component_types_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_formula_templates_v2" ON formula_templates_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_sku_catalog_v2" ON sku_catalog_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_bom_projects_v2" ON bom_projects_v2 FOR SELECT TO authenticated USING (true);

-- Write access for authenticated (app layer restricts to admin)
CREATE POLICY "write_product_types_v2" ON product_types_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_styles_v2" ON product_styles_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_variables_v2" ON product_variables_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_component_types_v2" ON component_types_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_formula_templates_v2" ON formula_templates_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_sku_catalog_v2" ON sku_catalog_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_bom_projects_v2" ON bom_projects_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- PART 7: SEED DATA - COMPONENT TYPES
-- ============================================

INSERT INTO component_types_v2 (code, name, description, unit_type, display_order) VALUES
  ('post', 'Post', 'Vertical support structure', 'Each', 1),
  ('picket', 'Picket', 'Vertical boards for wood vertical fences', 'Each', 2),
  ('rail', 'Rail', 'Horizontal support boards', 'Each', 3),
  ('cap', 'Cap Board', 'Horizontal board along top of fence', 'Each', 4),
  ('trim', 'Trim Board', 'Vertical trim boards on posts', 'Each', 5),
  ('rot_board', 'Rot Board', 'Bottom board protecting from moisture', 'Each', 6),
  ('steel_post_cap', 'Steel Post Cap', 'Cap for steel posts', 'Each', 7),
  ('bracket', 'Rail Bracket', 'Metal bracket for steel posts', 'Each', 8),
  ('nails_picket', 'Picket Nails', 'Nails for attaching pickets', 'Coil', 9),
  ('nails_frame', 'Frame Nails', 'Nails for rails and structure', 'Box', 10),
  ('board', 'Horizontal Board', 'Horizontal boards for horizontal fences', 'Each', 11),
  ('nailer', 'Nailer', 'Support for horizontal boards', 'Each', 12),
  ('vertical_trim', 'Vertical Trim', 'Trim for horizontal fences', 'Each', 13),
  ('panel', 'Iron Panel', 'Pre-fabricated iron fence panel', 'Each', 14),
  ('iron_post_cap', 'Iron Post Cap', 'Decorative cap for iron posts', 'Each', 15),
  ('concrete_sand', 'Concrete Sand', '3-part concrete sand', 'Yard', 16),
  ('concrete_portland', 'Portland Cement', '3-part portland cement', 'Bag', 17),
  ('concrete_quickrock', 'QuickRock', '3-part quickrock', 'Bag', 18)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_type = EXCLUDED.unit_type,
  display_order = EXCLUDED.display_order;

-- ============================================
-- PART 8: SEED DATA - PRODUCT TYPES
-- ============================================

INSERT INTO product_types_v2 (code, name, description, default_post_spacing, display_order) VALUES
  ('wood_vertical', 'Wood Vertical', 'Traditional vertical picket fence', 8.0, 1),
  ('wood_horizontal', 'Wood Horizontal', 'Modern horizontal board fence', 6.0, 2),
  ('iron', 'Iron', 'Ornamental iron/steel fence', 8.0, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_post_spacing = EXCLUDED.default_post_spacing;

-- ============================================
-- PART 9: SEED DATA - PRODUCT STYLES
-- ============================================

-- Wood Vertical Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard', 'Standard', 'Basic vertical picket fence', '{}', 1
FROM product_types_v2 WHERE code = 'wood_vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good_neighbor', 'Good Neighbor', 'Finished both sides',
  '{"post_spacing": 7.71, "picket_multiplier": 1.11}', 2
FROM product_types_v2 WHERE code = 'wood_vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good_neighbor_builder', 'Good Neighbor (Builder)', 'Good Neighbor for builders',
  '{"post_spacing": 7.71, "picket_multiplier": 1.11}', 3
FROM product_types_v2 WHERE code = 'wood_vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'board_on_board', 'Board on Board', 'Overlapping pickets',
  '{"picket_multiplier": 1.14}', 4
FROM product_types_v2 WHERE code = 'wood_vertical';

-- Wood Horizontal Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard', 'Standard', 'Basic horizontal fence', '{}', 1
FROM product_types_v2 WHERE code = 'wood_horizontal';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good_neighbor', 'Good Neighbor', 'Horizontal boards on both sides',
  '{"board_multiplier": 2}', 2
FROM product_types_v2 WHERE code = 'wood_horizontal';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'exposed', 'Exposed', 'Posts visible on one side', '{}', 3
FROM product_types_v2 WHERE code = 'wood_horizontal';

-- Iron Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard', 'Standard', 'Standard welded iron fence', '{}', 1
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'ameristar', 'Ameristar', 'Bracket system (no welding)', '{}', 2
FROM product_types_v2 WHERE code = 'iron';

-- ============================================
-- PART 10: SEED DATA - PRODUCT VARIABLES
-- ============================================

-- Wood Vertical Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'rail_count', 'Rail Count', 'select', '2', ARRAY['2', '3', '4'], true, 1
FROM product_types_v2 WHERE code = 'wood_vertical';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'decimal', '8', 'ft', true, 2
FROM product_types_v2 WHERE code = 'wood_vertical';

-- Wood Horizontal Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, unit, is_required, display_order)
SELECT id, 'board_count', 'Boards High', 'integer', NULL, NULL, true, 1
FROM product_types_v2 WHERE code = 'wood_horizontal';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'decimal', '6', 'ft', true, 2
FROM product_types_v2 WHERE code = 'wood_horizontal';

-- Iron Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, unit, is_required, display_order)
SELECT id, 'panel_width', 'Panel Width', 'decimal', '8', 'ft', true, 1
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'rails_per_panel', 'Rails Per Panel', 'select', '2', ARRAY['2', '3'], true, 2
FROM product_types_v2 WHERE code = 'iron';

-- ============================================
-- PART 11: PROJECT CODE SEQUENCE
-- ============================================

CREATE SEQUENCE IF NOT EXISTS bom_project_v2_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_bom_project_v2_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_code IS NULL THEN
    NEW.project_code := 'P2-' || LPAD(nextval('bom_project_v2_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_bom_project_v2_code
  BEFORE INSERT ON bom_projects_v2
  FOR EACH ROW
  EXECUTE FUNCTION generate_bom_project_v2_code();
