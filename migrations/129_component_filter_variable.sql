-- ============================================
-- Migration 129: Component Filter Variable
-- ============================================
-- Adds filter_variable_id to product_type_components_v2
-- Allows each component to optionally be filtered by a variable
-- e.g., Post filtered by post_type (WOOD, STEEL)
-- ============================================

-- Add filter_variable_id column
ALTER TABLE product_type_components_v2
ADD COLUMN IF NOT EXISTS filter_variable_id UUID REFERENCES product_variables_v2(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN product_type_components_v2.filter_variable_id IS
  'Optional: Variable to use for subgrouping in Material/Labor assignment. If null, component has no subgrouping.';

-- Update the view to include filter variable info
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
-- Seed: Set Post component to filter by post_type for Wood Vertical
-- ============================================
UPDATE product_type_components_v2 ptc
SET filter_variable_id = (
  SELECT pv.id
  FROM product_variables_v2 pv
  WHERE pv.product_type_id = ptc.product_type_id
    AND pv.variable_code = 'post_type'
  LIMIT 1
)
WHERE ptc.component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'post'
)
AND ptc.product_type_id IN (
  SELECT id FROM product_types_v2 WHERE code IN ('wood-vertical', 'wood-horizontal')
);

-- ============================================
-- SUMMARY
-- ============================================
-- Added: filter_variable_id column to product_type_components_v2
-- Updated: v_product_type_components_full view with filter variable info
-- Seeded: Post component linked to post_type variable for wood fence types
