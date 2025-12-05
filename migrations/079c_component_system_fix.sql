-- ============================================
-- Migration 079c: Component System Fix (CASCADE)
-- ============================================
-- Drops all related objects and recreates cleanly

-- Drop everything with CASCADE
DROP VIEW IF EXISTS sku_components_view CASCADE;
DROP VIEW IF EXISTS v_component_eligible_materials CASCADE;
DROP FUNCTION IF EXISTS get_component_materials(UUID, UUID, TEXT) CASCADE;
DROP TABLE IF EXISTS sku_components CASCADE;
DROP TABLE IF EXISTS component_material_rules CASCADE;
DROP TABLE IF EXISTS component_formulas CASCADE;
DROP TABLE IF EXISTS formula_parameters CASCADE;
DROP TABLE IF EXISTS product_type_components CASCADE;
DROP TABLE IF EXISTS component_definitions CASCADE;

-- ============================================
-- 1. Component Definitions
-- ============================================
CREATE TABLE component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  fence_types TEXT[] NOT NULL DEFAULT '{}',
  default_category TEXT,
  default_sub_category TEXT,
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SKU Component Configuration
-- ============================================
CREATE TABLE sku_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron', 'custom')),
  product_id UUID NOT NULL,
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,
  filter_config JSONB DEFAULT '{}',
  default_material_id UUID REFERENCES materials(id),
  display_name TEXT,
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  visibility_rule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fence_type, product_id, component_id)
);

-- Indexes
CREATE INDEX idx_sku_components_product ON sku_components(fence_type, product_id);
CREATE INDEX idx_sku_components_component ON sku_components(component_id);

-- ============================================
-- 3. Seed Component Definitions
-- ============================================
INSERT INTO component_definitions (code, name, description, fence_types, default_category, display_order, is_required) VALUES
  ('post', 'Post Material', 'Posts for fence structure', ARRAY['wood_vertical', 'wood_horizontal', 'iron'], '01-Post', 10, true),
  ('cap', 'Cap Material', 'Cap trim for posts', ARRAY['wood_vertical', 'wood_horizontal'], '04-Cap/Trim', 60, false),
  ('picket', 'Picket Material', 'Vertical picket boards', ARRAY['wood_vertical'], '02-Pickets', 20, true),
  ('rail', 'Rail Material', 'Horizontal rails', ARRAY['wood_vertical', 'iron'], '03-Rails', 30, true),
  ('trim', 'Trim Material', 'Trim boards', ARRAY['wood_vertical'], '04-Cap/Trim', 50, false),
  ('rot_board', 'Rot Board', 'Bottom rot board', ARRAY['wood_vertical'], '05-Rot Board', 40, false),
  ('board', 'Board Material', 'Horizontal fence boards', ARRAY['wood_horizontal'], '07-Horizontal Boards', 20, true),
  ('nailer', 'Nailer Material', 'Nailer strips', ARRAY['wood_horizontal'], '03-Rails', 30, false),
  ('vertical_trim', 'Vertical Trim', 'Vertical trim covering posts', ARRAY['wood_horizontal'], '04-Cap/Trim', 50, false),
  ('panel', 'Panel Material', 'Pre-fabricated iron panels', ARRAY['iron'], '09-Iron', 20, false),
  ('bracket', 'Bracket Material', 'Panel mounting brackets', ARRAY['iron'], '08-Hardware', 40, false),
  ('iron_picket', 'Picket Material', 'Iron pickets for custom panels', ARRAY['iron'], '09-Iron', 25, false);

-- ============================================
-- 4. RLS Policies
-- ============================================
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "component_definitions_select" ON component_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "component_definitions_all" ON component_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sku_components_select" ON sku_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "sku_components_all" ON sku_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 5. View: SKU Components with Details
-- ============================================
CREATE VIEW sku_components_view AS
SELECT
  sc.id,
  sc.fence_type,
  sc.product_id,
  sc.component_id,
  cd.code AS component_code,
  COALESCE(sc.display_name, cd.name) AS component_name,
  cd.description AS component_description,
  sc.filter_config,
  sc.default_material_id,
  m.material_sku AS default_material_sku,
  m.material_name AS default_material_name,
  sc.display_order,
  sc.is_required,
  sc.is_visible,
  sc.visibility_rule
FROM sku_components sc
JOIN component_definitions cd ON cd.id = sc.component_id
LEFT JOIN materials m ON m.id = sc.default_material_id
WHERE cd.is_active = true;

GRANT SELECT ON sku_components_view TO authenticated;
