-- Migration 143: Set visibility conditions for post-type-specific components
-- This ensures steel_post_cap only shows when post_type = STEEL, etc.

-- Set visibility_conditions for steel_post_cap - only visible for STEEL posts
UPDATE product_type_components_v2
SET visibility_conditions = '{"post_type": ["STEEL"]}'::jsonb
WHERE component_type_id IN (
  SELECT id FROM component_types_v2 WHERE code = 'steel_post_cap'
)
AND visibility_conditions IS NULL;

-- Verify the update
SELECT
  pt.name as product_type,
  ct.code as component_code,
  ct.name as component_name,
  ptc.visibility_conditions
FROM product_type_components_v2 ptc
JOIN product_types_v2 pt ON ptc.product_type_id = pt.id
JOIN component_types_v2 ct ON ptc.component_type_id = ct.id
WHERE ct.code = 'steel_post_cap';

-- Note: If you have iron_post_cap that should only show for iron product types,
-- that's handled by product type assignment rather than visibility_conditions

COMMENT ON TABLE product_type_components_v2 IS 'Component assignments to product types with visibility conditions. visibility_conditions JSONB controls when a component appears in SKU Builder based on variable values (e.g., {"post_type": ["STEEL"]} means component only shows when post_type variable is STEEL).';
