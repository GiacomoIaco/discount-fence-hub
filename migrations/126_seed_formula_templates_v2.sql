-- ============================================
-- Migration 126: Seed Formula Templates V2
-- ============================================
-- Fixes migration 121 which used wrong codes (underscores vs dashes)
-- Uses correct product_type codes: wood-vertical, wood-horizontal, iron
-- Uses correct style codes: standard, good-neighbor-builder, etc.
-- ============================================

-- First clear any existing (in case partial data exists)
DELETE FROM formula_templates_v2 WHERE true;

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
  'post_spacing from SKU variables (8 or 7.71)'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'post';

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
WHERE pt.code = 'wood-vertical' AND ct.code = 'picket';

-- PICKET (Good Neighbor Residential - 11% more)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[Quantity]*12/[picket.width_inches]*1.025*1.11',
  'sku',
  'Good Neighbor: 11% more pickets for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-residential'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'picket';

-- PICKET (Good Neighbor Builder - same as Good Neighbor)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[Quantity]*12/[picket.width_inches]*1.025*1.11',
  'sku',
  'Good Neighbor Builder: 11% more pickets for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'picket';

-- PICKET (Board on Board - overlap formula)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '([Quantity]*12*2)/([picket.width_inches]*2-2.5)*1.025',
  'sku',
  'Board on Board: overlap formula (length*2)/(width*2-gap)*waste',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'board-on-board'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'picket';

-- RAIL (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[post_spacing])*[rail_count]',
  'sku',
  'Rails = sections * rails per section'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'rail';

-- CAP (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[cap.length_feet])',
  'sku',
  'Cap boards = fence length / cap length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'cap';

-- TRIM (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[trim.length_feet])',
  'sku',
  'Trim boards = fence length / trim length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'trim';

-- ROT BOARD (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[rot_board.length_feet])',
  'sku',
  'Rot boards = fence length / rot board length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'rot_board';

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
WHERE pt.code = 'wood-vertical' AND ct.code = 'bracket';

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
WHERE pt.code = 'wood-vertical' AND ct.code = 'steel_post_cap';

-- PICKET NAILS (project-level rounding)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([picket_count]*[rail_count]*2)/300',
  'project',
  'Nail coils = (pickets * rails * 2 nails) / 300 nails per coil',
  'Rounds at project level'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code = 'nails_picket';

-- FRAME NAILS (project-level rounding) - handles both nails_frame and nails_framing
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([post_count]*[rail_count]*4)/28',
  'project',
  'Frame nail boxes = (posts * rails * 4 nails) / 28 nails per box',
  'Rounds at project level'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-vertical' AND ct.code IN ('nails_frame', 'nails_framing');

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
WHERE pt.code = 'wood-horizontal' AND ct.code = 'post';

-- BOARD (Standard Horizontal style)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])',
  'sku',
  'Boards = boards high * boards per row'
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard-horizontal'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'board';

-- BOARD (Good Neighbor Horizontal - double)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])*2',
  'sku',
  'Good Neighbor: double boards for both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-horizontal'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'board';

-- BOARD (Exposed Posts Horizontal - same as standard)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  'ROUNDUP([height]*12/[board.width_inches])*ROUNDUP([Quantity]/[board.length_feet])',
  'sku',
  'Exposed: single side boards',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'exposed-posts-horizontal'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'board';

-- NAILER (all styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  '(ROUNDUP([height]*12/[board.width_inches])-1)*ROUNDUP([Quantity]/[post_spacing])',
  'sku',
  'Nailers = (boards high - 1) * sections'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'nailer';

-- VERTICAL TRIM (Standard Horizontal - one side)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, ps.id, ct.id,
  '[post_count]',
  'sku',
  'Vertical trim = one per post (one side)'
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard-horizontal'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'vertical_trim';

-- VERTICAL TRIM (Good Neighbor Horizontal - both sides)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, priority)
SELECT
  pt.id, ps.id, ct.id,
  '[post_count]*2',
  'sku',
  'Good Neighbor: vertical trim on both sides',
  10
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-horizontal'
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'vertical_trim';

-- CAP (all horizontal styles)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english)
SELECT
  pt.id, NULL, ct.id,
  'ROUNDUP([Quantity]/[cap.length_feet])',
  'sku',
  'Cap boards = fence length / cap length'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'cap';

-- PICKET NAILS for horizontal (board nails)
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([board_count]*4)/300',
  'project',
  'Board nail coils = (boards * 4 nails) / 300 nails per coil',
  'Rounds at project level'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code = 'nails_picket';

-- FRAME NAILS for horizontal
INSERT INTO formula_templates_v2 (product_type_id, product_style_id, component_type_id, formula, rounding_level, plain_english, notes)
SELECT
  pt.id, NULL, ct.id,
  '([nailer_count]*2*6+[post_count]*2*4)/28',
  'project',
  'Frame nails = (nailers*2*6 + posts*2*4) / 28',
  'Rounds at project level'
FROM product_types_v2 pt
CROSS JOIN component_types_v2 ct
WHERE pt.code = 'wood-horizontal' AND ct.code IN ('nails_frame', 'nails_framing');

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

-- ============================================
-- SUMMARY
-- ============================================
-- Total formulas seeded: ~35+
-- Replaces: FenceCalculator.ts (1,575 lines)
-- Uses correct product_type codes with dashes (wood-vertical, wood-horizontal, iron)
-- Uses correct style codes (standard, good-neighbor-builder, etc.)
