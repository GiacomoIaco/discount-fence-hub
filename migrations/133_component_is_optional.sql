-- ============================================
-- Migration 133: Add is_optional to product_type_components_v2
-- ============================================
-- Allows marking components as optional in SKU Builder
-- Optional components show even with 1 material option
-- Required components auto-select and grey out when only 1 option
-- ============================================

-- 1. Add is_optional column
ALTER TABLE product_type_components_v2
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false;

COMMENT ON COLUMN product_type_components_v2.is_optional IS
  'If true, component is optional in SKU builder (user can skip). If false, component is required.';

-- 2. Update the view to include is_optional
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
  ptc.is_optional,
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
-- Added: is_optional to product_type_components_v2
-- Updated: v_product_type_components_full view with is_optional
