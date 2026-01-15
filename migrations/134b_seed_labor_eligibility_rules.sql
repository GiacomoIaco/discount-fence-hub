-- ============================================
-- Migration 134: Seed Labor Eligibility Rules
-- ============================================
-- Adds labor codes for each product type based on V1 FenceCalculator logic
-- Uses conditional formulas for variable-dependent labor
-- ============================================

-- 1. Create a generic "labor" component type if not exists
INSERT INTO component_types_v2 (code, name, description, unit_type, display_order, is_labor) VALUES
  ('labor', 'Labor', 'Labor codes for installation', 'LF', 100, true)
ON CONFLICT (code) DO UPDATE SET is_labor = true;

-- 2. Get component type ID for labor
-- We'll use CTEs to reference product types and labor codes by code

-- ============================================
-- WOOD VERTICAL LABOR RULES
-- ============================================
-- Based on FenceCalculator.getWoodVerticalLaborCodes():
-- - W02: Set Post 8' OC (always)
-- - W03/M03: Nail Up Vertical up to 6' (height<=6, wood/steel)
-- - W04/M04: Nail Up Vertical 7' or 8' (height>6, wood/steel)
-- - W05: Additional Rail (when rails > default: 6ft=2, 8ft=3)
-- - W06/M06: Goodneighbor Style (style check)
-- - W07/M07: Cap and Trim (has cap AND trim)
-- - W08: Just Trim (trim only)
-- - W09: Just Cap (cap only)
-- - W10: Wood Gate up to 6FT (per gate, height<=6)
-- - W11: Wood Gate 8FT (per gate, height>6)

-- W02: Set Post 8' OC - Always applies for Wood Vertical
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, '[Quantity]', 'Always applies - set posts for wood vertical fence', 1
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W02'
ON CONFLICT DO NOTHING;

-- W03: Nail Up Vertical up to 6' - Wood posts, height <= 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="WOOD", height<=6), [Quantity], 0)', 'Wood posts, height 6ft or less', 2
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W03'
ON CONFLICT DO NOTHING;

-- W04: Nail Up Vertical 7' or 8' - Wood posts, height > 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="WOOD", height>6), [Quantity], 0)', 'Wood posts, height 7-8ft', 3
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W04'
ON CONFLICT DO NOTHING;

-- M03: Steel Post Nail Up Vertical up to 6' - Steel posts, height <= 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="STEEL", height<=6), [Quantity], 0)', 'Steel posts, height 6ft or less', 4
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'M03'
ON CONFLICT DO NOTHING;

-- M04: Steel Post Nail Up Vertical 7' or 8' - Steel posts, height > 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="STEEL", height>6), [Quantity], 0)', 'Steel posts, height 7-8ft', 5
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'M04'
ON CONFLICT DO NOTHING;

-- W05: Additional Rail - when rails > default (6ft=2 rails, 8ft=3 rails)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(OR(AND(height<=6, rails>2), AND(height>6, rails>3)), [Quantity], 0)', 'Extra rail beyond default (6ft=2, 8ft=3)', 6
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W05'
ON CONFLICT DO NOTHING;

-- W06: Goodneighbor Style - Wood posts, goodneighbor style
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="WOOD", style=="good-neighbor"), [Quantity], 0)', 'Wood posts, Good Neighbor style', 7
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W06'
ON CONFLICT DO NOTHING;

-- M06: Steel Post Goodneighbor Style - Steel posts, goodneighbor style
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="STEEL", style=="good-neighbor"), [Quantity], 0)', 'Steel posts, Good Neighbor style', 8
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'M06'
ON CONFLICT DO NOTHING;

-- W07: Cap and Trim - Wood posts, has cap AND trim
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="WOOD", has_cap==true, has_trim==true), [Quantity], 0)', 'Wood posts with cap AND trim', 9
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W07'
ON CONFLICT DO NOTHING;

-- M07: Steel Post Cap and Trim - Steel posts, has cap AND trim
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="STEEL", has_cap==true, has_trim==true), [Quantity], 0)', 'Steel posts with cap AND trim', 10
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'M07'
ON CONFLICT DO NOTHING;

-- W08: Just Trim - has trim but NOT cap
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(has_trim==true, has_cap==false), [Quantity], 0)', 'Trim only (no cap)', 11
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W08'
ON CONFLICT DO NOTHING;

-- W09: Just Cap - has cap but NOT trim
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(has_cap==true, has_trim==false), [Quantity], 0)', 'Cap only (no trim)', 12
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W09'
ON CONFLICT DO NOTHING;

-- W10: Wood Gate up to 6FT - per gate (height <= 6)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(height<=6, [Gates], 0)', 'Gate labor for 6ft or shorter', 13
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W10'
ON CONFLICT DO NOTHING;

-- W11: Wood Gate 8FT - per gate (height > 6)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(height>6, [Gates], 0)', 'Gate labor for 7-8ft', 14
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-vertical' AND ct.code = 'labor' AND lc.labor_sku = 'W11'
ON CONFLICT DO NOTHING;


-- ============================================
-- WOOD HORIZONTAL LABOR RULES
-- ============================================
-- Based on FenceCalculator.getWoodHorizontalLaborCodes():
-- - W12: Horizontal Set Post 6' OC (always)
-- - W13: Horizontal Nail Up 6' High (height <= 6)
-- - W18: Horizontal Nail Up 7' or 8' High (height > 6)
-- - W06/M06: Goodneighbor Style (style check)
-- - W09: Just Cap (if cap present)
-- - W15: Horizontal Wood Gate Single (per gate)
-- - W16: Set Post for Exposed Horizontal (exposed style)
-- - W17: Nail up Exposed Horizontal (exposed style)

-- W12: Horizontal Set Post 6' OC - Standard/Goodneighbor styles
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style!="exposed", [Quantity], 0)', 'Set posts for standard/goodneighbor horizontal', 1
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W12'
ON CONFLICT DO NOTHING;

-- W16: Set Post for Exposed Horizontal - Exposed style only
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="exposed", [Quantity], 0)', 'Set posts for exposed horizontal style', 2
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W16'
ON CONFLICT DO NOTHING;

-- W13: Horizontal Nail Up 6' High - Standard/Goodneighbor, height <= 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(style!="exposed", height<=6), [Quantity], 0)', 'Nail up horizontal boards, 6ft or less', 3
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W13'
ON CONFLICT DO NOTHING;

-- W18: Horizontal Nail Up 7' or 8' High - Standard/Goodneighbor, height > 6
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(style!="exposed", height>6), [Quantity], 0)', 'Nail up horizontal boards, 7-8ft', 4
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W18'
ON CONFLICT DO NOTHING;

-- W17: Nail up Exposed Horizontal - Exposed style only
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="exposed", [Quantity], 0)', 'Nail up exposed horizontal fence', 5
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W17'
ON CONFLICT DO NOTHING;

-- W06: Goodneighbor Style (Wood horizontal with wood posts)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="WOOD", style=="good-neighbor"), [Quantity], 0)', 'Wood posts, Good Neighbor horizontal', 6
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W06'
ON CONFLICT DO NOTHING;

-- M06: Steel Post Goodneighbor Style (Wood horizontal with steel posts)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(AND(post_type=="STEEL", style=="good-neighbor"), [Quantity], 0)', 'Steel posts, Good Neighbor horizontal', 7
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'M06'
ON CONFLICT DO NOTHING;

-- W09: Just Cap (if cap present)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(has_cap==true, [Quantity], 0)', 'Cap for horizontal fence', 8
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W09'
ON CONFLICT DO NOTHING;

-- W15: Horizontal Wood Gate Single - per gate
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, '[Gates]', 'Horizontal wood gate labor per gate', 9
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'wood-horizontal' AND ct.code = 'labor' AND lc.labor_sku = 'W15'
ON CONFLICT DO NOTHING;


-- ============================================
-- IRON LABOR RULES
-- ============================================
-- Based on FenceCalculator.getIronLaborCodes():
-- - IR01: Set posts (always)
-- - IR02: Iron Weld Standard Fence (standard-2-rail style)
-- - IR04: Set and Weld Railing (iron-rail style)
-- - IR05: Set Post Ameristar/3 rail brackets (ameristar style - post setting)
-- - IR06: Weld/Bracket Fence Ameristar (ameristar style)
-- - IR07: Iron Gate Single (per gate)

-- IR01: Iron Set Post 8' O.C. - Always applies
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, '[Quantity]', 'Always applies - set iron posts', 1
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR01'
ON CONFLICT DO NOTHING;

-- IR02: Iron Weld Standard Fence - Standard 2-rail style
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="standard-2-rail", [Quantity], 0)', 'Weld standard iron panels', 2
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR02'
ON CONFLICT DO NOTHING;

-- IR04: Set and Weld Railing - Iron Rail style (railing projects)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="iron-rail", [Quantity], 0)', 'Iron railing installation', 3
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR04'
ON CONFLICT DO NOTHING;

-- IR05: Set Post Ameristar/3 rail brackets - Ameristar style (different post setting)
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="ameristar", [Quantity], 0)', 'Ameristar bracket post setting', 4
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR05'
ON CONFLICT DO NOTHING;

-- IR06: Weld/Bracket Fence Ameristar - Ameristar/3-rail bracket installation
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, 'IF(style=="ameristar", [Quantity], 0)', 'Ameristar panel bracket installation', 5
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR06'
ON CONFLICT DO NOTHING;

-- IR07: Iron Gate Single - per gate
INSERT INTO component_labor_eligibility (product_type_id, component_type_id, labor_code_id, quantity_formula, notes, display_order)
SELECT pt.id, ct.id, lc.id, '[Gates]', 'Iron gate installation per gate', 6
FROM product_types_v2 pt, component_types_v2 ct, labor_codes lc
WHERE pt.code = 'iron' AND ct.code = 'labor' AND lc.labor_sku = 'IR07'
ON CONFLICT DO NOTHING;


-- ============================================
-- UPDATE EXISTING IR04 RULE IF EXISTS
-- ============================================
-- The IR04 that was already added for Iron should be updated to have the correct formula
UPDATE component_labor_eligibility
SET quantity_formula = 'IF(style=="iron-rail", [Quantity], 0)',
    notes = 'Iron railing installation'
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'iron')
  AND labor_code_id = (SELECT id FROM labor_codes WHERE labor_sku = 'IR04');


-- ============================================
-- SUMMARY
-- ============================================
-- Added labor rules for:
--   Wood Vertical: 14 rules (W02, W03, W04, M03, M04, W05, W06, M06, W07, M07, W08, W09, W10, W11)
--   Wood Horizontal: 9 rules (W12, W13, W16, W17, W18, W06, M06, W09, W15)
--   Iron: 6 rules (IR01, IR02, IR04, IR05, IR06, IR07)
--
-- Formula patterns used:
--   [Quantity] - always apply based on footage
--   [Gates] - apply per gate count
--   IF(condition, [Quantity], 0) - conditional application
--   IF(AND(...), ...) - multiple conditions
--   IF(OR(...), ...) - either condition
