-- ============================================
-- Migration 162: Steel Post Cap Visibility Conditions
-- ============================================
-- Sets visibility_conditions so steel_post_cap only shows when post_type is STEEL

-- Update steel_post_cap component to only show for STEEL posts
-- Need to join with component_types_v2 to get the component_type_id
UPDATE product_type_components_v2 ptc
SET visibility_conditions = '{"post_type": ["STEEL"]}'::jsonb
FROM component_types_v2 ct
WHERE ptc.component_type_id = ct.id
  AND ct.code = 'steel_post_cap';

-- Verify the update
SELECT
  ct.code AS component_code,
  ct.name AS component_name,
  ptc.visibility_conditions,
  ptc.is_optional
FROM product_type_components_v2 ptc
JOIN component_types_v2 ct ON ct.id = ptc.component_type_id
WHERE ct.code = 'steel_post_cap';
