-- ============================================
-- Migration 158: Fix Wood Vertical Labor Conditions
-- ============================================
-- Updates labor code conditions based on actual business rules
-- Style codes: standard, good-neighbor-residential, good-neighbor-builder, board-on-board

-- ============================================
-- UPDATE M06: Steel Post Good Neighbor Style
-- Should apply when: post_type = steel AND style is any good neighbor variant
-- ============================================
UPDATE labor_group_eligibility_v2
SET condition_formula = '[post_type] == "steel" AND ([style] == "good-neighbor-residential" OR [style] == "good-neighbor-builder")'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'M06');

-- ============================================
-- UPDATE M07: Steel Post Cap and Trim
-- Should apply when: post_type = steel AND both cap and trim are included
-- ============================================
UPDATE labor_group_eligibility_v2
SET condition_formula = '[post_type] == "steel" AND [cap_qty] > 0 AND [trim_qty] > 0'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'M07');

-- ============================================
-- UPDATE W05: Additional Rail
-- Should apply when: 6ft fence with 3 rails OR 8ft fence with 4 rails
-- Does NOT apply to 8ft fence with 3 rails (that's standard)
-- ============================================
UPDATE labor_group_eligibility_v2
SET condition_formula = '([height] == 6 AND [rail_count] == 3) OR ([height] == 8 AND [rail_count] == 4)'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W05');

-- ============================================
-- UPDATE W06: Good Neighbor Style (wood post)
-- Should apply when: style is any good neighbor variant
-- ============================================
UPDATE labor_group_eligibility_v2
SET condition_formula = '[style] == "good-neighbor-residential" OR [style] == "good-neighbor-builder"'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'W06');

-- ============================================
-- VERIFY: Show updated conditions
-- ============================================
SELECT
  lc.labor_sku,
  lc.description,
  lg.code as labor_group,
  lge.condition_formula as new_condition
FROM labor_group_eligibility_v2 lge
JOIN labor_codes lc ON lc.id = lge.labor_code_id
JOIN labor_groups_v2 lg ON lg.id = lge.labor_group_id
WHERE lge.product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical')
  AND lc.labor_sku IN ('M06', 'M07', 'W05', 'W06')
ORDER BY lc.labor_sku;
