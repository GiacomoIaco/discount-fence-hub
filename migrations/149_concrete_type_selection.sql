-- ============================================
-- Migration 149: Concrete Type Selection
-- ============================================
-- Adds support for selecting between:
-- - 3-part system (CTS sand, CTP portland, CTQ quickrock)
-- - Yellow bags (CTY)
-- - Red bags (CTR)
--
-- Uses the [concrete_type] variable passed from SKU Builder
-- to conditionally calculate the appropriate concrete formula.
-- ============================================

-- 1. Add component types for yellow and red bags
INSERT INTO component_types_v2 (code, name, unit_type, display_order)
VALUES
  ('concrete_yellow', 'Yellow Bag Concrete', 'Bag', 85),
  ('concrete_red', 'Red Bag Concrete', 'Bag', 86)
ON CONFLICT (code) DO NOTHING;

-- 2. Get IDs for formula insertion
DO $$
DECLARE
  v_wood_vertical_id UUID;
  v_wood_horizontal_id UUID;
  v_iron_id UUID;
  v_concrete_yellow_id UUID;
  v_concrete_red_id UUID;
  v_concrete_sand_id UUID;
  v_concrete_portland_id UUID;
  v_concrete_quickrock_id UUID;
BEGIN
  -- Get product type IDs
  SELECT id INTO v_wood_vertical_id FROM product_types_v2 WHERE code = 'wood-vertical';
  SELECT id INTO v_wood_horizontal_id FROM product_types_v2 WHERE code = 'wood-horizontal';
  SELECT id INTO v_iron_id FROM product_types_v2 WHERE code = 'iron';

  -- Get component type IDs
  SELECT id INTO v_concrete_yellow_id FROM component_types_v2 WHERE code = 'concrete_yellow';
  SELECT id INTO v_concrete_red_id FROM component_types_v2 WHERE code = 'concrete_red';
  SELECT id INTO v_concrete_sand_id FROM component_types_v2 WHERE code = 'concrete_sand';
  SELECT id INTO v_concrete_portland_id FROM component_types_v2 WHERE code = 'concrete_portland';
  SELECT id INTO v_concrete_quickrock_id FROM component_types_v2 WHERE code = 'concrete_quickrock';

  -- 3. Add yellow bag formulas (posts * 0.65) for all product types
  IF v_concrete_yellow_id IS NOT NULL THEN
    -- Wood Vertical
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_wood_vertical_id, NULL, v_concrete_yellow_id, '[post_qty]*0.65', 'project', 'Yellow bags = posts * 0.65', 'Used when concrete_type = yellow-bags')
    ON CONFLICT DO NOTHING;

    -- Wood Horizontal
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_wood_horizontal_id, NULL, v_concrete_yellow_id, '[post_qty]*0.65', 'project', 'Yellow bags = posts * 0.65', 'Used when concrete_type = yellow-bags')
    ON CONFLICT DO NOTHING;

    -- Iron
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_iron_id, NULL, v_concrete_yellow_id, '[post_qty]*0.65', 'project', 'Yellow bags = posts * 0.65', 'Used when concrete_type = yellow-bags')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Added yellow bag formulas';
  END IF;

  -- 4. Add red bag formulas (posts * 1) for all product types
  IF v_concrete_red_id IS NOT NULL THEN
    -- Wood Vertical
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_wood_vertical_id, NULL, v_concrete_red_id, '[post_qty]*1', 'project', 'Red bags = posts * 1', 'Used when concrete_type = red-bags')
    ON CONFLICT DO NOTHING;

    -- Wood Horizontal
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_wood_horizontal_id, NULL, v_concrete_red_id, '[post_qty]*1', 'project', 'Red bags = posts * 1', 'Used when concrete_type = red-bags')
    ON CONFLICT DO NOTHING;

    -- Iron
    INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
    VALUES (v_iron_id, NULL, v_concrete_red_id, '[post_qty]*1', 'project', 'Red bags = posts * 1', 'Used when concrete_type = red-bags')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Added red bag formulas';
  END IF;

END $$;

-- 5. Add visibility conditions for concrete components
-- These conditions control when each concrete component is shown in the SKU Builder

-- First check if visibility_condition column exists
DO $$
BEGIN
  -- Set visibility conditions on component_types_v2 if the column exists
  -- concrete_sand, portland, quickrock: show when concrete_type == '3-part'
  -- concrete_yellow: show when concrete_type == 'yellow-bags'
  -- concrete_red: show when concrete_type == 'red-bags'

  UPDATE component_types_v2
  SET visibility_condition = '[concrete_type] == "3-part"'
  WHERE code IN ('concrete_sand', 'concrete_portland', 'concrete_quickrock');

  UPDATE component_types_v2
  SET visibility_condition = '[concrete_type] == "yellow-bags"'
  WHERE code = 'concrete_yellow';

  UPDATE component_types_v2
  SET visibility_condition = '[concrete_type] == "red-bags"'
  WHERE code = 'concrete_red';

  RAISE NOTICE 'Set visibility conditions for concrete components';
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'visibility_condition column does not exist - skipping';
END $$;

-- 6. Assign concrete components to product types
-- Add concrete_yellow and concrete_red to wood-vertical, wood-horizontal, iron
DO $$
DECLARE
  v_wood_vertical_id UUID;
  v_wood_horizontal_id UUID;
  v_iron_id UUID;
  v_concrete_yellow_id UUID;
  v_concrete_red_id UUID;
BEGIN
  SELECT id INTO v_wood_vertical_id FROM product_types_v2 WHERE code = 'wood-vertical';
  SELECT id INTO v_wood_horizontal_id FROM product_types_v2 WHERE code = 'wood-horizontal';
  SELECT id INTO v_iron_id FROM product_types_v2 WHERE code = 'iron';
  SELECT id INTO v_concrete_yellow_id FROM component_types_v2 WHERE code = 'concrete_yellow';
  SELECT id INTO v_concrete_red_id FROM component_types_v2 WHERE code = 'concrete_red';

  -- Add to product_type_components_v2 if table exists
  IF v_concrete_yellow_id IS NOT NULL THEN
    INSERT INTO product_type_components_v2 (product_type_id, component_type_id, is_optional, display_order)
    VALUES
      (v_wood_vertical_id, v_concrete_yellow_id, true, 85),
      (v_wood_horizontal_id, v_concrete_yellow_id, true, 85),
      (v_iron_id, v_concrete_yellow_id, true, 85)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_concrete_red_id IS NOT NULL THEN
    INSERT INTO product_type_components_v2 (product_type_id, component_type_id, is_optional, display_order)
    VALUES
      (v_wood_vertical_id, v_concrete_red_id, true, 86),
      (v_wood_horizontal_id, v_concrete_red_id, true, 86),
      (v_iron_id, v_concrete_red_id, true, 86)
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Assigned concrete components to product types';
END $$;
