-- ============================================
-- Migration 145: Fix V2 Formula Discrepancies
-- ============================================
-- Fixes identified by V1 vs V2 comparison script:
-- 1. RAIL formula: was posts×rails, should be sections×rails
-- 2. CAP formula: missing ROUNDUP
-- 3. TRIM formula: missing ROUNDUP
-- 4. Add missing concrete formulas for wood-vertical
-- 5. Fix nails_framing component code consistency
-- ============================================

-- Get wood-vertical product type ID
DO $$
DECLARE
  v_wood_vertical_id UUID;
  v_wood_horizontal_id UUID;
  v_iron_id UUID;
  v_rail_component_id UUID;
  v_cap_component_id UUID;
  v_trim_component_id UUID;
  v_concrete_sand_id UUID;
  v_concrete_portland_id UUID;
  v_concrete_quickrock_id UUID;
  v_nails_frame_id UUID;
BEGIN
  -- Get product type IDs
  SELECT id INTO v_wood_vertical_id FROM product_types_v2 WHERE code = 'wood-vertical';
  SELECT id INTO v_wood_horizontal_id FROM product_types_v2 WHERE code = 'wood-horizontal';
  SELECT id INTO v_iron_id FROM product_types_v2 WHERE code = 'iron';

  -- Get component type IDs
  SELECT id INTO v_rail_component_id FROM component_types_v2 WHERE code = 'rail';
  SELECT id INTO v_cap_component_id FROM component_types_v2 WHERE code = 'cap';
  SELECT id INTO v_trim_component_id FROM component_types_v2 WHERE code = 'trim';
  SELECT id INTO v_concrete_sand_id FROM component_types_v2 WHERE code = 'concrete_sand';
  SELECT id INTO v_concrete_portland_id FROM component_types_v2 WHERE code = 'concrete_portland';
  SELECT id INTO v_concrete_quickrock_id FROM component_types_v2 WHERE code = 'concrete_quickrock';
  SELECT id INTO v_nails_frame_id FROM component_types_v2 WHERE code = 'nails_framing';

  -- ============================================
  -- FIX 1: RAIL formula (CRITICAL)
  -- Was: [post_count]*[rail_count] (WRONG - posts × rails)
  -- Fix: ROUNDUP([Quantity]/[post_spacing])*[rail_count] (sections × rails)
  -- ============================================

  UPDATE formula_templates_v2
  SET formula = 'ROUNDUP([Quantity]/[post_spacing])*[rail_count]',
      plain_english = 'Rails = sections × rails per section',
      notes = 'Fixed: was incorrectly using post_count instead of sections'
  WHERE product_type_id = v_wood_vertical_id
    AND component_type_id = v_rail_component_id
    AND product_style_id IS NULL;

  RAISE NOTICE 'Fixed RAIL formula for wood-vertical';

  -- ============================================
  -- FIX 2: CAP formula (missing ROUNDUP)
  -- Was: [Quantity]/[cap.length_feet]
  -- Fix: ROUNDUP([Quantity]/[cap.length_feet])
  -- ============================================

  UPDATE formula_templates_v2
  SET formula = 'ROUNDUP([Quantity]/[cap.length_feet])'
  WHERE component_type_id = v_cap_component_id
    AND formula NOT LIKE 'ROUNDUP%';

  RAISE NOTICE 'Fixed CAP formulas - added ROUNDUP';

  -- ============================================
  -- FIX 3: TRIM formula (missing ROUNDUP)
  -- Was: [Quantity]/[trim.length_feet]
  -- Fix: ROUNDUP([Quantity]/[trim.length_feet])
  -- ============================================

  UPDATE formula_templates_v2
  SET formula = 'ROUNDUP([Quantity]/[trim.length_feet])'
  WHERE component_type_id = v_trim_component_id
    AND formula NOT LIKE 'ROUNDUP%';

  RAISE NOTICE 'Fixed TRIM formulas - added ROUNDUP';

  -- ============================================
  -- FIX 4: Add missing concrete formulas for wood-vertical
  -- These formulas exist in migration 121/126 but may not have linked correctly
  -- ============================================

  -- Delete any existing (to avoid duplicates)
  DELETE FROM formula_templates_v2
  WHERE product_type_id = v_wood_vertical_id
    AND component_type_id IN (v_concrete_sand_id, v_concrete_portland_id, v_concrete_quickrock_id);

  -- Concrete Sand (3-part system)
  IF v_concrete_sand_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (
      product_type_id, product_style_id, component_type_id,
      formula, rounding_level, plain_english, notes
    ) VALUES (
      v_wood_vertical_id, NULL, v_concrete_sand_id,
      '[post_count]/10',
      'project',
      'Sand bags = posts / 10',
      '3-part concrete system'
    );
    RAISE NOTICE 'Added concrete_sand formula';
  END IF;

  -- Concrete Portland
  IF v_concrete_portland_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (
      product_type_id, product_style_id, component_type_id,
      formula, rounding_level, plain_english, notes
    ) VALUES (
      v_wood_vertical_id, NULL, v_concrete_portland_id,
      '[post_count]/20',
      'project',
      'Portland cement bags = posts / 20',
      '3-part concrete system'
    );
    RAISE NOTICE 'Added concrete_portland formula';
  END IF;

  -- Concrete QuickRock
  IF v_concrete_quickrock_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (
      product_type_id, product_style_id, component_type_id,
      formula, rounding_level, plain_english, notes
    ) VALUES (
      v_wood_vertical_id, NULL, v_concrete_quickrock_id,
      '[post_count]*0.5',
      'project',
      'QuickRock bags = posts * 0.5',
      '3-part concrete system'
    );
    RAISE NOTICE 'Added concrete_quickrock formula';
  END IF;

  -- ============================================
  -- FIX 5: Add nails_frame as alias for nails_framing if missing
  -- ============================================

  -- Ensure nails_framing formula exists for wood-vertical
  IF NOT EXISTS (
    SELECT 1 FROM formula_templates_v2
    WHERE product_type_id = v_wood_vertical_id
      AND component_type_id = v_nails_frame_id
  ) AND v_nails_frame_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (
      product_type_id, product_style_id, component_type_id,
      formula, rounding_level, plain_english
    ) VALUES (
      v_wood_vertical_id, NULL, v_nails_frame_id,
      '([post_count]*[rail_count]*4)/28',
      'project',
      'Frame nail boxes = (posts * rails * 4 nails) / 28 per box'
    );
    RAISE NOTICE 'Added nails_framing formula';
  END IF;

  -- ============================================
  -- Also fix for wood-horizontal and iron if needed
  -- ============================================

  -- Add concrete for wood-horizontal
  IF v_wood_horizontal_id IS NOT NULL THEN
    DELETE FROM formula_templates_v2
    WHERE product_type_id = v_wood_horizontal_id
      AND component_type_id IN (v_concrete_sand_id, v_concrete_portland_id, v_concrete_quickrock_id);

    IF v_concrete_sand_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_wood_horizontal_id, NULL, v_concrete_sand_id, '[post_count]/10', 'project', 'Sand bags = posts / 10');
    END IF;
    IF v_concrete_portland_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_wood_horizontal_id, NULL, v_concrete_portland_id, '[post_count]/20', 'project', 'Portland = posts / 20');
    END IF;
    IF v_concrete_quickrock_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_wood_horizontal_id, NULL, v_concrete_quickrock_id, '[post_count]*0.5', 'project', 'QuickRock = posts * 0.5');
    END IF;
    RAISE NOTICE 'Added concrete formulas for wood-horizontal';
  END IF;

  -- Add concrete for iron
  IF v_iron_id IS NOT NULL THEN
    DELETE FROM formula_templates_v2
    WHERE product_type_id = v_iron_id
      AND component_type_id IN (v_concrete_sand_id, v_concrete_portland_id, v_concrete_quickrock_id);

    IF v_concrete_sand_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_iron_id, NULL, v_concrete_sand_id, '[post_count]/10', 'project', 'Sand bags = posts / 10');
    END IF;
    IF v_concrete_portland_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_iron_id, NULL, v_concrete_portland_id, '[post_count]/20', 'project', 'Portland = posts / 20');
    END IF;
    IF v_concrete_quickrock_id IS NOT NULL THEN
      INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
      VALUES (v_iron_id, NULL, v_concrete_quickrock_id, '[post_count]*0.5', 'project', 'QuickRock = posts * 0.5');
    END IF;
    RAISE NOTICE 'Added concrete formulas for iron';
  END IF;

END $$;

-- ============================================
-- Verification query (run manually to check)
-- ============================================
-- SELECT
--   pt.code as product_type,
--   ct.code as component,
--   ft.formula,
--   ft.rounding_level
-- FROM formula_templates_v2 ft
-- JOIN product_types_v2 pt ON ft.product_type_id = pt.id
-- JOIN component_types_v2 ct ON ft.component_type_id = ct.id
-- WHERE pt.code = 'wood-vertical'
-- ORDER BY ct.code;
