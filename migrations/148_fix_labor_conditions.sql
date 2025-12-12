-- ============================================
-- Migration 148: Fix Labor Condition Formulas
-- ============================================
-- Issues found:
-- 1. Invalid syntax: '=>' should be '>=' or '>'
-- 2. Wrong height logic: W04/M04 for 7'+ should check >6 not =>6
-- 3. Inconsistent case: Some use 'Wood', others 'WOOD'
-- 4. No default nail_up code
-- ============================================

-- Fix condition syntax and logic for nail_up codes
-- W03: Wood Post, 6' and under
UPDATE labor_group_eligibility_v2
SET condition_formula = '[height] <= 6 AND [post_type] == "WOOD"'
WHERE labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W03');

-- W04: Wood Post, 7'+ (height > 6)
UPDATE labor_group_eligibility_v2
SET condition_formula = '[height] > 6 AND [post_type] == "WOOD"'
WHERE labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W04');

-- M03: Steel Post, 6' and under
UPDATE labor_group_eligibility_v2
SET condition_formula = '[height] <= 6 AND [post_type] == "STEEL"'
WHERE labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'M03');

-- M04: Steel Post, 7'+ (height > 6)
UPDATE labor_group_eligibility_v2
SET condition_formula = '[height] > 6 AND [post_type] == "STEEL"'
WHERE labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'M04');

-- Set W03 as default nail_up code (most common scenario)
UPDATE labor_group_eligibility_v2
SET is_default = true
WHERE labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W03');

-- Verify
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Updated nail_up conditions:';
  FOR rec IN
    SELECT lc.labor_sku, lge.condition_formula, lge.is_default
    FROM labor_group_eligibility_v2 lge
    JOIN labor_codes lc ON lge.labor_code_id = lc.id
    JOIN labor_groups_v2 lg ON lge.labor_group_id = lg.id
    WHERE lg.code = 'nail_up'
  LOOP
    RAISE NOTICE '  % - % (default: %)', rec.labor_sku, rec.condition_formula, rec.is_default;
  END LOOP;
END $$;
