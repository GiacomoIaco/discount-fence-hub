-- ============================================
-- Migration 127: Product Type Manager Schema Enhancements
-- ============================================
-- Supports the enhanced Product Type Manager workflow:
-- 1. Variables with global value pool
-- 2. Component selection per product type
-- 3. Labor components support
-- 4. Remove default_post_spacing from product types
-- ============================================

-- ============================================
-- 1. GLOBAL VARIABLE VALUE OPTIONS
-- Allows sharing variable values across product types
-- e.g., post_type = ['WOOD', 'STEEL', 'GALVANIZED', 'BLACK']
-- ============================================
CREATE TABLE IF NOT EXISTS variable_value_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_code TEXT NOT NULL,
  value TEXT NOT NULL,
  display_label TEXT,  -- Optional friendly label
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variable_code, value)
);

ALTER TABLE variable_value_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vvo_select" ON variable_value_options;
DROP POLICY IF EXISTS "vvo_all" ON variable_value_options;
CREATE POLICY "vvo_select" ON variable_value_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "vvo_all" ON variable_value_options FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed initial values for post_type
INSERT INTO variable_value_options (variable_code, value, display_label, display_order) VALUES
  ('post_type', 'WOOD', 'Wood Post', 1),
  ('post_type', 'STEEL', 'Steel Post', 2),
  ('post_type', 'GALVANIZED', 'Galvanized Post', 3),
  ('post_type', 'BLACK', 'Black Post', 4),
  ('post_type', 'ALUMINUM', 'Aluminum Post', 5)
ON CONFLICT (variable_code, value) DO NOTHING;

-- Seed height values
INSERT INTO variable_value_options (variable_code, value, display_label, display_order) VALUES
  ('height', '4', '4 ft', 1),
  ('height', '5', '5 ft', 2),
  ('height', '6', '6 ft', 3),
  ('height', '7', '7 ft', 4),
  ('height', '8', '8 ft', 5),
  ('height', '10', '10 ft', 6)
ON CONFLICT (variable_code, value) DO NOTHING;

-- ============================================
-- 2. PRODUCT TYPE COMPONENTS JUNCTION TABLE
-- Tracks which components are used by each product type
-- ============================================
CREATE TABLE IF NOT EXISTS product_type_components_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  component_type_id UUID NOT NULL REFERENCES component_types_v2(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,  -- For formula execution sequence
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, component_type_id)
);

ALTER TABLE product_type_components_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ptc_select" ON product_type_components_v2;
DROP POLICY IF EXISTS "ptc_all" ON product_type_components_v2;
CREATE POLICY "ptc_select" ON product_type_components_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "ptc_all" ON product_type_components_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3. ADD is_labor FLAG TO COMPONENT TYPES
-- Distinguishes material components from labor components
-- ============================================
ALTER TABLE component_types_v2 ADD COLUMN IF NOT EXISTS is_labor BOOLEAN DEFAULT false;

-- ============================================
-- 4. COMPONENT LABOR ELIGIBILITY
-- Maps labor components to labor codes with variable-based filters
-- Similar to component_material_eligibility but for labor
-- ============================================
CREATE TABLE IF NOT EXISTS component_labor_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  component_type_id UUID NOT NULL REFERENCES component_types_v2(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id) ON DELETE CASCADE,
  attribute_filter JSONB,  -- e.g., {"post_type": "WOOD", "height_max": 6}
  quantity_formula TEXT,   -- Optional: defaults to [Quantity] if null
  notes TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE component_labor_eligibility ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cle_select" ON component_labor_eligibility;
DROP POLICY IF EXISTS "cle_all" ON component_labor_eligibility;
CREATE POLICY "cle_select" ON component_labor_eligibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "cle_all" ON component_labor_eligibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 5. SEED PRODUCT TYPE COMPONENTS
-- Based on existing formula_templates_v2 data
-- ============================================

-- Wood Vertical components
INSERT INTO product_type_components_v2 (product_type_id, component_type_id, display_order)
SELECT DISTINCT pt.id, ct.id,
  CASE ct.code
    WHEN 'post' THEN 1
    WHEN 'picket' THEN 2
    WHEN 'rail' THEN 3
    WHEN 'cap' THEN 4
    WHEN 'trim' THEN 5
    WHEN 'rot_board' THEN 6
    WHEN 'bracket' THEN 7
    WHEN 'steel_post_cap' THEN 8
    WHEN 'nails_picket' THEN 9
    WHEN 'nails_frame' THEN 10
    ELSE 99
  END
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical'
  AND ct.code IN ('post', 'picket', 'rail', 'cap', 'trim', 'rot_board', 'bracket', 'steel_post_cap', 'nails_picket', 'nails_frame')
ON CONFLICT (product_type_id, component_type_id) DO UPDATE SET display_order = EXCLUDED.display_order;

-- Wood Horizontal components
INSERT INTO product_type_components_v2 (product_type_id, component_type_id, display_order)
SELECT DISTINCT pt.id, ct.id,
  CASE ct.code
    WHEN 'post' THEN 1
    WHEN 'board' THEN 2
    WHEN 'nailer' THEN 3
    WHEN 'cap' THEN 4
    WHEN 'vertical_trim' THEN 5
    WHEN 'bracket' THEN 6
    WHEN 'steel_post_cap' THEN 7
    WHEN 'nails_picket' THEN 8
    WHEN 'nails_frame' THEN 9
    ELSE 99
  END
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal'
  AND ct.code IN ('post', 'board', 'nailer', 'cap', 'vertical_trim', 'bracket', 'steel_post_cap', 'nails_picket', 'nails_frame')
ON CONFLICT (product_type_id, component_type_id) DO UPDATE SET display_order = EXCLUDED.display_order;

-- Iron components
INSERT INTO product_type_components_v2 (product_type_id, component_type_id, display_order)
SELECT DISTINCT pt.id, ct.id,
  CASE ct.code
    WHEN 'post' THEN 1
    WHEN 'panel' THEN 2
    WHEN 'bracket' THEN 3
    WHEN 'iron_post_cap' THEN 4
    ELSE 99
  END
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron'
  AND ct.code IN ('post', 'panel', 'bracket', 'iron_post_cap')
ON CONFLICT (product_type_id, component_type_id) DO UPDATE SET display_order = EXCLUDED.display_order;

-- ============================================
-- 6. CREATE USEFUL VIEWS
-- ============================================

-- View: Components with product type assignment status
DROP VIEW IF EXISTS v_product_type_components_full;
CREATE VIEW v_product_type_components_full AS
SELECT
  pt.id AS product_type_id,
  pt.code AS product_type_code,
  pt.name AS product_type_name,
  ct.id AS component_type_id,
  ct.code AS component_code,
  ct.name AS component_name,
  ct.is_labor,
  ptc.id AS assignment_id,
  ptc.display_order,
  ptc.is_active AS is_assigned,
  EXISTS (
    SELECT 1 FROM formula_templates_v2 ft
    WHERE ft.product_type_id = pt.id
      AND ft.component_type_id = ct.id
      AND ft.is_active = true
  ) AS has_formula
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
LEFT JOIN product_type_components_v2 ptc
  ON ptc.product_type_id = pt.id
  AND ptc.component_type_id = ct.id
WHERE pt.is_active = true
  AND ct.is_active = true
ORDER BY pt.display_order, COALESCE(ptc.display_order, 999), ct.display_order;

GRANT SELECT ON v_product_type_components_full TO authenticated;

-- View: Variable values by product type
DROP VIEW IF EXISTS v_product_type_variable_values;
CREATE VIEW v_product_type_variable_values AS
SELECT
  pv.id AS variable_id,
  pv.product_type_id,
  pt.code AS product_type_code,
  pv.variable_code,
  pv.variable_name,
  pv.variable_type,
  pv.allowed_values AS selected_values,
  pv.default_value,
  pv.is_required,
  pv.display_order,
  vvo.all_values
FROM product_variables_v2 pv
JOIN product_types_v2 pt ON pt.id = pv.product_type_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
    'value', vvo.value,
    'label', COALESCE(vvo.display_label, vvo.value),
    'order', vvo.display_order
  ) ORDER BY vvo.display_order) AS all_values
  FROM variable_value_options vvo
  WHERE vvo.variable_code = pv.variable_code
    AND vvo.is_active = true
) vvo ON true
WHERE pt.is_active = true
ORDER BY pt.display_order, pv.display_order;

GRANT SELECT ON v_product_type_variable_values TO authenticated;

-- ============================================
-- 7. REMOVE default_post_spacing FROM product_types_v2
-- (It should be a variable, not a type attribute)
-- ============================================
-- Note: Commenting out to preserve data for now
-- ALTER TABLE product_types_v2 DROP COLUMN IF EXISTS default_post_spacing;

-- ============================================
-- SUMMARY
-- ============================================
-- New tables:
--   - variable_value_options: Global pool of variable values
--   - product_type_components_v2: Junction table for component assignment
--   - component_labor_eligibility: Labor code selection rules
-- Modified tables:
--   - component_types_v2: Added is_labor column
-- New views:
--   - v_product_type_components_full: Components with assignment status
--   - v_product_type_variable_values: Variables with global value options
