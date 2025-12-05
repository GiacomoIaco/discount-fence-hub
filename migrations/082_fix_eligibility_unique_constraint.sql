-- ============================================
-- Migration 082: Fix Eligibility Unique Constraint
-- ============================================
-- Adds attribute_filter to the unique constraint
-- so we can have different rules for different attribute values

-- Drop the old constraint
ALTER TABLE component_material_eligibility
DROP CONSTRAINT IF EXISTS component_material_eligibility_fence_type_component_id_mate_key;

-- Create new constraint that includes attribute_filter
ALTER TABLE component_material_eligibility
ADD CONSTRAINT component_material_eligibility_unique
UNIQUE NULLS NOT DISTINCT (fence_type, component_id, material_category, material_subcategory, material_id, attribute_filter);

-- Also need to handle the case where we're adding specific materials
-- The constraint should allow:
-- 1. Category rule: (wood_vertical, post_id, '01-Post', NULL, NULL, {"post_type": "WOOD"})
-- 2. Specific material: (wood_vertical, post_id, NULL, NULL, material_id, {"post_type": "WOOD"})
