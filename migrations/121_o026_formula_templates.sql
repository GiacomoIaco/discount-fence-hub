-- ============================================
-- Migration 121: O-026 Formula Templates
-- ============================================
-- Seeds formula_templates_v2 with formulas from FenceCalculator.ts
-- These formulas replace 1,575 lines of hardcoded TypeScript
-- ============================================

-- ============================================
-- WOOD VERTICAL FORMULAS
-- ============================================

-- POST (all styles - base formula)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(MAX([Lines]-2,0)/2)',
  'sku',
  'Posts = sections + 1, plus extra for multiple fence lines',
  'post_spacing comes from style adjustments or SKU variable'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'post';

-- PICKET (Standard style)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, ps.id, ct.id,
  '[Quantity]*12/[picket.width_inches]*1.025',
  'sku',
  'Pickets = fence length in inches / picket width * 2.5% waste'
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'picket';

-- PICKET (Good Neighbor - 11% more)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[Quantity]*12/[picket.width_inches]*1.025*1.11',
  'sku',
  'Good Neighbor: 11% more pickets for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good_neighbor'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'picket';

-- PICKET (Good Neighbor Builder - same as Good Neighbor)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[Quantity]*12/[picket.width_inches]*1.025*1.11',
  'sku',
  'Good Neighbor Builder: 11% more pickets for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good_neighbor_builder'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'picket';

-- PICKET (Board on Board - overlap formula)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '([Quantity]*12*2)/([picket.width_inches]*2-2.5)*1.025',
  'sku',
  'Board on Board: overlap formula (length*2)/(width*2-gap)*waste',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'board_on_board'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'picket';

-- RAIL (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[post_spacing])*[rail_count]',
  'sku',
  'Rails = sections * rails per section'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'rail';

-- CAP (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[cap.length_feet])',
  'sku',
  'Cap boards = fence length / cap length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'cap';

-- TRIM (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[trim.length_feet])',
  'sku',
  'Trim boards = fence length / trim length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'trim';

-- ROT BOARD (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[rot_board.length_feet])',
  'sku',
  'Rot boards = fence length / rot board length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'rot_board';

-- BRACKET (steel posts only - all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]*[rail_count]',
  'sku',
  'Brackets = posts * rails (one per connection)',
  'Only calculated when post_type = STEEL'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'bracket';

-- STEEL POST CAP (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]',
  'sku',
  'One cap per steel post',
  'Only calculated when post_type = STEEL'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'steel_post_cap';

-- PICKET NAILS (project-level rounding)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([picket_count]*[rail_count]*2)/[nails_picket.qty_per_unit]',
  'project',
  'Nail coils = (pickets * rails * 2 nails) / nails per coil',
  'qty_per_unit typically 300 for coils'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'nails_picket';

-- FRAME NAILS (project-level rounding)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([post_count]*[rail_count]*4)/[nails_frame.qty_per_unit]',
  'project',
  'Frame nail boxes = (posts * rails * 4 nails) / nails per box',
  'qty_per_unit typically 28 for boxes'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'nails_frame';

-- CONCRETE SAND (3-part system, project-level)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]/10',
  'project',
  'Sand yards = posts / 10'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'concrete_sand';

-- CONCRETE PORTLAND (3-part system, project-level)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]/20',
  'project',
  'Portland bags = posts / 20'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'concrete_portland';

-- CONCRETE QUICKROCK (3-part system, project-level)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]*0.5',
  'project',
  'QuickRock bags = posts * 0.5'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_vertical' AND ct.code = 'concrete_quickrock';

-- ============================================
-- WOOD HORIZONTAL FORMULAS
-- ============================================

-- POST (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[post_spacing])+1+ROUNDUP(MAX([Lines]-2,0)/2)',
  'sku',
  'Posts = sections + 1, plus extra for multiple fence lines'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'post';

-- BOARD (Standard style)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])',
  'sku',
  'Boards = boards high * boards per row'
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'board';

-- BOARD (Good Neighbor - double)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])*2',
  'sku',
  'Good Neighbor: double boards for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good_neighbor'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'board';

-- BOARD (Exposed style - same as standard)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])',
  'sku',
  'Exposed: single side boards',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'exposed'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'board';

-- NAILER (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '(ROUNDUP([height]*12/[board.width_inches])-1)*ROUNDUP([Quantity]/[post_spacing])',
  'sku',
  'Nailers = (boards high - 1) * sections'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'nailer';

-- VERTICAL TRIM (Standard - one side)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, ps.id, ct.id,
  '[post_count]',
  'sku',
  'Vertical trim = one per post (one side)'
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'vertical_trim';

-- VERTICAL TRIM (Good Neighbor - both sides)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[post_count]*2',
  'sku',
  'Good Neighbor: vertical trim on both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good_neighbor'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'vertical_trim';

-- CAP (all horizontal styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[cap.length_feet])',
  'sku',
  'Cap boards = fence length / cap length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood_horizontal' AND ct.code = 'cap';

-- ============================================
-- IRON FORMULAS
-- ============================================

-- POST (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[panel_width])+1+ROUNDUP(MAX([Lines]-2,0)/2)',
  'sku',
  'Posts = panels + 1, plus extra for multiple fence lines'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'post';

-- PANEL (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[panel_width])',
  'sku',
  'Panels = fence length / panel width'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'panel';

-- BRACKET (Ameristar style only)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[panel_count]*[rails_per_panel]*2',
  'sku',
  'Ameristar brackets = panels * rails * 2 (one each end)',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'ameristar'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'bracket';

-- IRON POST CAP (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]',
  'sku',
  'One cap per iron post'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'iron_post_cap';

-- CONCRETE for Iron (same formulas as wood vertical)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]/10',
  'project',
  'Sand yards = posts / 10'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'concrete_sand';

INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]/20',
  'project',
  'Portland bags = posts / 20'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'concrete_portland';

INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '[post_count]*0.5',
  'project',
  'QuickRock bags = posts * 0.5'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'iron' AND ct.code = 'concrete_quickrock';

-- ============================================
-- SUMMARY
-- ============================================
-- Total formulas seeded: ~40
-- Replaces: FenceCalculator.ts (1,575 lines)
-- Formula interpreter: ~200 lines
