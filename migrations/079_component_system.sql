-- ============================================
-- Migration 079: Component System
-- ============================================
-- Allows SKUs to define which material components they use,
-- with filtering rules and defaults for each component.

-- ============================================
-- 1. Component Definitions
-- ============================================
-- Master list of all possible material components
CREATE TABLE IF NOT EXISTS component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Component identity
  code TEXT NOT NULL UNIQUE, -- 'post', 'picket', 'rail', 'cap', etc.
  name TEXT NOT NULL, -- 'Post Material', 'Picket Material'
  description TEXT,

  -- Which fence types can use this component
  fence_types TEXT[] NOT NULL DEFAULT '{}', -- ['wood_vertical', 'wood_horizontal', 'iron']

  -- Default filtering (can be overridden per SKU)
  default_category TEXT, -- Material category to filter by (e.g., '01-Post')
  default_sub_category TEXT, -- Optional sub-category filter

  -- Display options
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SKU Component Configuration
-- ============================================
-- Per-SKU configuration of which components to show and their filters
CREATE TABLE IF NOT EXISTS sku_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to product (polymorphic - use one of these)
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron', 'custom')),
  product_id UUID NOT NULL, -- ID from the respective product table

  -- Component reference
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,

  -- Filter configuration (JSON for flexibility)
  filter_config JSONB DEFAULT '{}',
  -- Example: {"category": "01-Post", "min_length": 8, "max_length": 10, "sub_category": "Wood 4x4"}

  -- Default material for this SKU + component
  default_material_id UUID REFERENCES materials(id),

  -- Override the component name for this SKU
  display_name TEXT,

  -- Display/behavior options
  display_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,

  -- Conditional visibility (JSON rule)
  visibility_rule JSONB,
  -- Example: {"when": "post_type", "equals": "STEEL", "then": "hide"}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique component per product
  UNIQUE(fence_type, product_id, component_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sku_components_product ON sku_components(fence_type, product_id);
CREATE INDEX IF NOT EXISTS idx_sku_components_component ON sku_components(component_id);

-- ============================================
-- 3. Seed Component Definitions
-- ============================================
INSERT INTO component_definitions (code, name, description, fence_types, default_category, display_order, is_required) VALUES
  -- Universal components
  ('post', 'Post Material', 'Posts for fence structure', ARRAY['wood_vertical', 'wood_horizontal', 'iron'], '01-Post', 10, true),
  ('cap', 'Cap Material', 'Cap trim for posts', ARRAY['wood_vertical', 'wood_horizontal'], '04-Cap/Trim', 60, false),

  -- Wood Vertical specific
  ('picket', 'Picket Material', 'Vertical picket boards', ARRAY['wood_vertical'], '02-Pickets', 20, true),
  ('rail', 'Rail Material', 'Horizontal rails', ARRAY['wood_vertical', 'iron'], '03-Rails', 30, true),
  ('trim', 'Trim Material', 'Trim boards', ARRAY['wood_vertical'], '04-Cap/Trim', 50, false),
  ('rot_board', 'Rot Board', 'Bottom rot board', ARRAY['wood_vertical'], '05-Rot Board', 40, false),

  -- Wood Horizontal specific
  ('board', 'Board Material', 'Horizontal fence boards', ARRAY['wood_horizontal'], '07-Horizontal Boards', 20, true),
  ('nailer', 'Nailer Material', 'Nailer strips', ARRAY['wood_horizontal'], '03-Rails', 30, false),
  ('vertical_trim', 'Vertical Trim', 'Vertical trim covering posts', ARRAY['wood_horizontal'], '04-Cap/Trim', 50, false),

  -- Iron specific
  ('panel', 'Panel Material', 'Pre-fabricated iron panels', ARRAY['iron'], '09-Iron', 20, false),
  ('bracket', 'Bracket Material', 'Panel mounting brackets', ARRAY['iron'], '08-Hardware', 40, false),
  ('iron_picket', 'Picket Material', 'Iron pickets for custom panels', ARRAY['iron'], '09-Iron', 25, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 4. RLS Policies
-- ============================================
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_components ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Authenticated users can view component definitions"
  ON component_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view sku components"
  ON sku_components FOR SELECT
  TO authenticated
  USING (true);

-- Write access for authenticated users
CREATE POLICY "Authenticated users can manage component definitions"
  ON component_definitions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage sku components"
  ON sku_components FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. Helper Function: Get Materials for Component
-- ============================================
-- Returns materials filtered by component configuration
CREATE OR REPLACE FUNCTION get_component_materials(
  p_component_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_fence_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  material_sku TEXT,
  material_name TEXT,
  category TEXT,
  sub_category TEXT,
  unit_cost DECIMAL,
  unit_type TEXT,
  length_ft DECIMAL,
  actual_width DECIMAL,
  is_default BOOLEAN
) AS $$
DECLARE
  v_config JSONB;
  v_category TEXT;
  v_sub_category TEXT;
  v_min_length DECIMAL;
  v_max_length DECIMAL;
  v_default_material_id UUID;
BEGIN
  -- Get component definition defaults
  SELECT cd.default_category, cd.default_sub_category
  INTO v_category, v_sub_category
  FROM component_definitions cd
  WHERE cd.id = p_component_id;

  -- Override with SKU-specific config if provided
  IF p_product_id IS NOT NULL AND p_fence_type IS NOT NULL THEN
    SELECT
      sc.filter_config,
      sc.default_material_id
    INTO v_config, v_default_material_id
    FROM sku_components sc
    WHERE sc.product_id = p_product_id
      AND sc.fence_type = p_fence_type
      AND sc.component_id = p_component_id;

    IF v_config IS NOT NULL THEN
      v_category := COALESCE(v_config->>'category', v_category);
      v_sub_category := COALESCE(v_config->>'sub_category', v_sub_category);
      v_min_length := (v_config->>'min_length')::DECIMAL;
      v_max_length := (v_config->>'max_length')::DECIMAL;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.material_sku,
    m.material_name,
    m.category,
    m.sub_category,
    m.unit_cost,
    m.unit_type,
    m.length_ft,
    m.actual_width,
    (m.id = v_default_material_id) AS is_default
  FROM materials m
  WHERE m.status = 'Active'
    AND (v_category IS NULL OR m.category = v_category)
    AND (v_sub_category IS NULL OR m.sub_category = v_sub_category)
    AND (v_min_length IS NULL OR m.length_ft >= v_min_length)
    AND (v_max_length IS NULL OR m.length_ft <= v_max_length)
  ORDER BY m.material_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. View: SKU Components with Details
-- ============================================
CREATE OR REPLACE VIEW sku_components_view AS
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
