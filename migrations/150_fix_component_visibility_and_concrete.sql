-- ============================================
-- Migration 150: Fix Component Visibility & Concrete System
-- ============================================
-- Issues:
-- 1. Bracket shows for WOOD posts (should only show for STEEL)
-- 2. Concrete appears as multiple components instead of one with options
-- 3. Lag screws only needed for STEEL posts
--
-- Solution:
-- 1. Add visibility_conditions to bracket for STEEL-only
-- 2. Add visibility_conditions to lag_screws for STEEL-only
-- 3. Remove separate concrete_yellow/concrete_red components
-- 4. Create a concrete_type variable that controls formula selection
-- ============================================

-- 1. Set visibility_conditions for bracket - only visible for STEEL posts
UPDATE product_type_components_v2
SET visibility_conditions = '{"post_type": ["STEEL"]}'::jsonb
WHERE component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'bracket'
)
AND (visibility_conditions IS NULL OR visibility_conditions = '{}'::jsonb);

-- 2. Set visibility_conditions for lag_screws - only visible for STEEL posts
UPDATE product_type_components_v2
SET visibility_conditions = '{"post_type": ["STEEL"]}'::jsonb
WHERE component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'lag_screws'
)
AND (visibility_conditions IS NULL OR visibility_conditions = '{}'::jsonb);

-- 3. Set visibility_conditions for self_tapping_screws - only visible for STEEL posts
UPDATE product_type_components_v2
SET visibility_conditions = '{"post_type": ["STEEL"]}'::jsonb
WHERE component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'self_tapping_screws'
)
AND (visibility_conditions IS NULL OR visibility_conditions = '{}'::jsonb);

-- 4. Set visibility_conditions for concrete_yellow - only when concrete_type = 'yellow-bags'
UPDATE product_type_components_v2
SET visibility_conditions = '{"concrete_type": ["yellow-bags"]}'::jsonb
WHERE component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'concrete_yellow'
);

-- 5. Set visibility_conditions for concrete_red - only when concrete_type = 'red-bags'
UPDATE product_type_components_v2
SET visibility_conditions = '{"concrete_type": ["red-bags"]}'::jsonb
WHERE component_type_id = (
  SELECT id FROM component_types_v2 WHERE code = 'concrete_red'
);

-- 7. Add concrete_type variable to wood-vertical and wood-horizontal product types
DO $$
DECLARE
  v_wood_vertical_id UUID;
  v_wood_horizontal_id UUID;
  v_iron_id UUID;
BEGIN
  SELECT id INTO v_wood_vertical_id FROM product_types_v2 WHERE code = 'wood-vertical';
  SELECT id INTO v_wood_horizontal_id FROM product_types_v2 WHERE code = 'wood-horizontal';
  SELECT id INTO v_iron_id FROM product_types_v2 WHERE code = 'iron';

  -- Add concrete_type variable to wood-vertical
  INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, display_order)
  VALUES (v_wood_vertical_id, 'concrete_type', 'Concrete Type', 'select', '3-part', ARRAY['3-part', 'yellow-bags', 'red-bags'], 50)
  ON CONFLICT DO NOTHING;

  -- Add concrete_type variable to wood-horizontal
  INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, display_order)
  VALUES (v_wood_horizontal_id, 'concrete_type', 'Concrete Type', 'select', '3-part', ARRAY['3-part', 'yellow-bags', 'red-bags'], 50)
  ON CONFLICT DO NOTHING;

  -- Add concrete_type variable to iron
  INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, display_order)
  VALUES (v_iron_id, 'concrete_type', 'Concrete Type', 'select', '3-part', ARRAY['3-part', 'yellow-bags', 'red-bags'], 50)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Added concrete_type variable to all product types';
END $$;

-- 8. Update concrete component visibility based on concrete_type variable
-- concrete_sand, portland, quickrock: only show when concrete_type = '3-part'
UPDATE product_type_components_v2
SET visibility_conditions = '{"concrete_type": ["3-part"]}'::jsonb
WHERE component_type_id IN (
  SELECT id FROM component_types_v2
  WHERE code IN ('concrete_sand', 'concrete_portland', 'concrete_quickrock')
);

-- 9. Verify the changes
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Updated visibility conditions:';
  FOR rec IN
    SELECT ct.code, pt.code as product_type, ptc.visibility_conditions
    FROM product_type_components_v2 ptc
    JOIN component_types_v2 ct ON ptc.component_type_id = ct.id
    JOIN product_types_v2 pt ON ptc.product_type_id = pt.id
    WHERE ptc.visibility_conditions IS NOT NULL
    ORDER BY ct.code
  LOOP
    RAISE NOTICE '  % (%) - %', rec.code, rec.product_type, rec.visibility_conditions;
  END LOOP;
END $$;
