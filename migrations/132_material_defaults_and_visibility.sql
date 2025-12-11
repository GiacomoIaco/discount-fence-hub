-- ============================================
-- Migration 132: Material Defaults & Component Visibility
-- ============================================
-- Adds:
-- 1. is_default flag to component_material_eligibility_v2
-- 2. visibility_conditions to product_type_components_v2
-- ============================================

-- 1. Add is_default to material eligibility
-- Only ONE material per component+attribute combo should be default
ALTER TABLE component_material_eligibility_v2
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN component_material_eligibility_v2.is_default IS
  'If true, this material is pre-selected in SKU builder for this component';

-- 2. Add is_default to labor eligibility as well
ALTER TABLE component_labor_eligibility
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN component_labor_eligibility.is_default IS
  'If true, this labor code is pre-selected for this component';

-- 3. Add visibility_conditions to product_type_components_v2
-- Example: {"post_type": ["STEEL", "GALVANIZED"]} means component only shows for those post types
ALTER TABLE product_type_components_v2
ADD COLUMN IF NOT EXISTS visibility_conditions JSONB;

COMMENT ON COLUMN product_type_components_v2.visibility_conditions IS
  'JSON conditions for when this component is visible in SKU builder. Example: {"post_type": ["STEEL"]} means only show for steel posts. Null = always visible.';

-- 4. Update the view to include visibility_conditions
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
  ptc.filter_variable_id,
  pv.variable_code AS filter_variable_code,
  pv.variable_name AS filter_variable_name,
  pv.allowed_values AS filter_variable_values,
  ptc.visibility_conditions,
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
LEFT JOIN product_variables_v2 pv
  ON pv.id = ptc.filter_variable_id
WHERE pt.is_active = true
  AND ct.is_active = true
ORDER BY pt.display_order, COALESCE(ptc.display_order, 999), ct.display_order;

GRANT SELECT ON v_product_type_components_full TO authenticated;

-- ============================================
-- SUMMARY
-- ============================================
-- Added: is_default to component_material_eligibility_v2
-- Added: is_default to component_labor_eligibility
-- Added: visibility_conditions to product_type_components_v2
-- Updated: v_product_type_components_full view with visibility_conditions
