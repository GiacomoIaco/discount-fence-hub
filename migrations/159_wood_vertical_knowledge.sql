-- ============================================
-- Migration 159: Wood Vertical Knowledge Base
-- ============================================
-- Documents all wood vertical fence specifications for AI and team reference

INSERT INTO product_type_knowledge (
  product_type_id,
  overview,
  components_guide,
  formula_logic,
  style_differences,
  installation_notes
)
SELECT
  id,
  -- OVERVIEW
'Wood Vertical fence is the traditional privacy fence with vertical pickets attached to horizontal rails between posts. Heights available: 6ft and 8ft. Post spacing default: 8ft (7.71ft for good neighbor styles).

**Styles Available:**
- **standard**: Basic privacy fence, pickets on one side
- **good-neighbor-residential**: Alternating pickets visible from both sides (uses brackets)
- **good-neighbor-builder**: Same as residential but without brackets
- **board-on-board**: 2 layers of overlapping pickets for full privacy

**Post Types:**
- **Wood Posts**: Standard 4x4 pressure treated
- **Steel Posts**: 2-3/8" galvanized steel posts (requires steel post labor codes M03, M04, M06, M07)',

  -- COMPONENTS GUIDE
'**POSTS:**
- post: Wood posts (4x4 PT)
- steel_post: Steel posts (2-3/8" galvanized) - alternative to wood

**PICKETS:**
- picket: Vertical fence boards (typically 1x6 or dog-ear style)

**RAILS:**
- rail: Horizontal rails (typically 2x4)
- Rail count: 2 rails standard for 6ft, 3 rails standard for 8ft
- Additional rail labor (W05) applies when: 6ft+3rails OR 8ft+4rails

**TOP FINISH:**
- cap: Top cap rail (1x6 or 2x6)
- trim: Trim board under cap
- rot_board: Rot board at bottom (optional)

**HARDWARE:**
- nails_picket: Nails for attaching pickets to rails
- nails_frame: Nails for framing (rails to posts)
- concrete: Concrete for setting posts (bags per post)

**GOOD NEIGHBOR SPECIFIC:**
- nailer: Center nailer boards for good neighbor styles
- brackets: Metal brackets (residential style only)',

  -- FORMULA LOGIC
'**POST CALCULATIONS:**
- posts = ROUNDUP([Quantity]/[post_spacing]) + 1 + ROUNDUP(MAX([Lines]-2,0)/2)
- Steel posts use same formula, different component

**PICKET CALCULATIONS:**
- Standard: [Quantity] * 12 / [picket.width_inches] * 1.025 (2.5% waste)
- Good Neighbor: multiply by 1.11 (11% more for alternating pattern)
- Board on Board: multiply by 1.14 (14% more for overlap)

**RAIL CALCULATIONS:**
- rails = ROUNDUP([Quantity]/[post_spacing]) * [rail_count]
- Default rail_count: 2 for 6ft, 3 for 8ft

**CAP/TRIM:**
- cap = ROUNDUP([Quantity]/[cap.length_feet])
- trim = Same as cap

**CONCRETE:**
- concrete = [post_qty] * 1.5 bags (typical)

**NAILS:**
- picket_nails = ([picket_qty] * [rail_count] * 2) / [nails_picket.qty_per_unit]',

  -- STYLE DIFFERENCES
'**STANDARD (code: standard)**
- Pickets on one side only
- Default post spacing: 8ft
- No extra labor or materials

**GOOD NEIGHBOR RESIDENTIAL (code: good-neighbor-residential)**
- Alternating pickets visible from both sides
- Uses metal brackets to attach rails
- Post spacing: 7.71ft (for even picket distribution)
- Picket multiplier: 1.11 (11% more pickets)
- Requires nailer boards
- Labor: W06 applies (wood post) or M06 (steel post)

**GOOD NEIGHBOR BUILDER (code: good-neighbor-builder)**
- Same alternating pattern as residential
- NO brackets - rails notched into posts
- Post spacing: 7.71ft
- Picket multiplier: 1.11
- Requires nailer boards
- Labor: W06 applies (wood post) or M06 (steel post)

**BOARD ON BOARD (code: board-on-board)**
- Two layers of overlapping pickets
- Full privacy from both sides
- Picket multiplier: 1.14 (14% more pickets)
- Default post spacing: 8ft',

  -- INSTALLATION NOTES
'**LABOR CODE CONDITIONS:**

**Post Setting:**
- W02: Set Post 8'' OC (wood posts)
- M03: Steel Post up to 6'' height ([post_type]=="steel" AND [height]<=6)
- M04: Steel Post 7-8'' height ([post_type]=="steel" AND [height]>6)

**Nail Up:**
- W03: Nail Up 6'' height ([height]<=6)
- W04: Nail Up 7-8'' height ([height]>6)

**Other Labor:**
- W05: Additional Rail - applies when: (6ft + 3 rails) OR (8ft + 4 rails). NOT for 8ft + 3 rails (standard)
- W06: Good Neighbor Style (wood) - [style]=="good-neighbor-residential" OR [style]=="good-neighbor-builder"
- M06: Steel Post Good Neighbor - [post_type]=="steel" AND good neighbor style
- M07: Steel Post Cap & Trim - [post_type]=="steel" AND [cap_qty]>0 AND [trim_qty]>0
- W07: Cap and Trim - always available option
- W08: Just Trim - always available option
- W09: Just Cap - always available option
- W10: Wood Gate up to 6ft - [height]<=6
- W11: Wood Gate 8ft - [height]>6

**DEFAULT HEIGHTS:**
- 6ft: 2 rails standard, 3 rails is additional
- 8ft: 3 rails standard, 4 rails is additional'

FROM product_types_v2
WHERE code = 'wood-vertical'
ON CONFLICT (product_type_id) DO UPDATE SET
  overview = EXCLUDED.overview,
  components_guide = EXCLUDED.components_guide,
  formula_logic = EXCLUDED.formula_logic,
  style_differences = EXCLUDED.style_differences,
  installation_notes = EXCLUDED.installation_notes,
  updated_at = NOW();

-- Verify
SELECT 'Wood Vertical knowledge populated' as status,
  overview IS NOT NULL as has_overview,
  components_guide IS NOT NULL as has_components,
  formula_logic IS NOT NULL as has_formulas,
  style_differences IS NOT NULL as has_styles,
  installation_notes IS NOT NULL as has_install
FROM product_type_knowledge
WHERE product_type_id = (SELECT id FROM product_types_v2 WHERE code = 'wood-vertical');
