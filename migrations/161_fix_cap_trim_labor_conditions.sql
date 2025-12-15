-- ============================================
-- Migration 161: Fix Cap/Trim Labor Code Conditions
-- ============================================
-- Updates W07, W08, W09 conditions to properly detect cap/trim selection

-- W07: Cap and Trim - only when BOTH cap AND trim are selected
UPDATE labor_group_eligibility_v2
SET condition_formula = '[cap_qty] > 0 AND [trim_qty] > 0'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W07');

-- W08: Just Trim - only when trim is selected but NOT cap
UPDATE labor_group_eligibility_v2
SET condition_formula = '[trim_qty] > 0 AND [cap_qty] == 0'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W08');

-- W09: Just Cap - only when cap is selected but NOT trim
UPDATE labor_group_eligibility_v2
SET condition_formula = '[cap_qty] > 0 AND [trim_qty] == 0'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W09');

-- Also fix W06 condition - style codes use dashes not underscores
UPDATE labor_group_eligibility_v2
SET condition_formula = '[style] == "good-neighbor-residential" OR [style] == "good-neighbor-builder"'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W06');

-- Verify
SELECT
  lc.labor_sku,
  lc.description,
  lge.condition_formula
FROM labor_group_eligibility_v2 lge
JOIN labor_codes lc ON lc.id = lge.labor_code_id
WHERE lge.product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND lc.labor_sku IN ('W06', 'W07', 'W08', 'W09')
ORDER BY lc.labor_sku;
