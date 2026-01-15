-- =============================================================================
-- CHAIN LINK FENCE COMPLETE SETUP
-- Migration 156: Sets up complete Chain Link product type configuration
-- including knowledge base, styles, variables, components, and formulas
-- =============================================================================

-- 1. CREATE CHAIN LINK PRODUCT TYPE (if not exists)
-- =============================================================================
INSERT INTO product_types_v2 (code, name, default_post_spacing, is_active)
VALUES ('chain_link', 'Chain Link', 10, true)
ON CONFLICT (code) DO NOTHING;

-- Get the chain_link product type ID for use in subsequent inserts
DO $$
DECLARE
  v_product_type_id UUID;
BEGIN
  SELECT id INTO v_product_type_id FROM product_types_v2 WHERE code = 'chain_link';

  -- 2. POPULATE KNOWLEDGE BASE
  -- ===========================================================================
  INSERT INTO product_type_knowledge (
    product_type_id,
    overview,
    components_guide,
    formula_logic,
    style_differences,
    installation_notes
  ) VALUES (
    v_product_type_id,
    -- OVERVIEW
    'Chain link fencing uses woven galvanized steel wire mesh (fabric) attached to a framework of steel posts and rails. It is the most cost-effective fencing option for large areas, offering durability, visibility, and security. Common applications include residential yards, commercial properties, sports facilities, and industrial perimeters.

Key specifications:
- Fabric: Woven diamond pattern, typically 2" mesh opening
- Wire gauges: 11.5 ga (light residential) to 6 ga (heavy industrial)
- Heights: 36" to 144" (3ft to 12ft)
- Post spacing: Maximum 10ft between line posts
- Coatings: Galvanized, vinyl-coated (green, black, brown)',

    -- COMPONENTS GUIDE
    'POSTS:
- Terminal Posts: Used at ends, corners, and gates. Larger diameter than line posts (typically 1 size up). Hold the fabric tension.
- Line Posts: Placed between terminal posts at max 10ft spacing. Support the mesh and hold top rail.
- Gate Posts: Considered terminal posts. Must support gate weight and swing stress.

Post Grades:
- .065 wall (LG15): Light residential, thinnest option
- .095-.100 wall (LG20/SS20): Standard residential/light commercial - RECOMMENDED
- Schedule 40 (.145 wall): Commercial/industrial, maximum durability

POST SIZING BY HEIGHT:
- Terminal posts: Fence height + 36" (commercial) or + 24" (residential)
- Line posts: Fence height + 30" (commercial) or + 24" (residential)

RAILS:
- Top Rail: Runs through loop caps on line posts, connects to rail ends at terminals. Supports top of mesh.
- Bottom Rail (optional): Alternative to tension wire for added rigidity
- Tension Wire: 7 gauge wire at bottom of fence, less expensive than bottom rail

FITTINGS (per terminal post):
- Tension Bands: Height in feet - 1 (minimum 3). Holds tension bar to post.
- Brace Bands: 1 per rail direction (holds rail ends)
- Rail Ends: 1 per rail direction
- Dome Cap: 1 per terminal post

FITTINGS (per line post):
- Loop Cap: 1 per post (holds top rail)
- Tie Wires: 1 per foot of fence height (attaches mesh to post)

FABRIC & TENSION:
- Tension Bars: 1 per terminal hookup (slides through mesh end)
- Fabric: Sold by linear foot in various heights
- Ties: Aluminum or galvanized, attaches mesh to rails and posts',

    -- FORMULA LOGIC
    'POST CALCULATIONS:
- Line Posts = ROUNDUP(Fence Length / Post Spacing) - 1
- Terminal Posts = 2 (ends) + Corners + (Gates x 2)
- Total Posts = Line Posts + Terminal Posts

Note: Each corner adds 1 terminal post. Each gate needs 2 gate posts (terminal).

TOP RAIL:
- Top Rail Length = Fence Length (sold in 21ft sections)
- Top Rail Sections = ROUNDUP(Fence Length / 21)
- Rail Sleeves = Top Rail Sections - 1 (connects sections)

FABRIC:
- Fabric Length = Fence Length + 1ft waste per terminal
- Fabric is sold by linear foot at specified height

FITTINGS PER TERMINAL:
- Tension Bands = (Fence Height - 1), minimum 3
- Brace Bands = Number of rail directions (1 for end, 2 for corner)
- Rail Ends = Same as brace bands
- Tension Bars = 1 per fabric hookup (1 for end, 2 for corner)

FITTINGS PER LINE POST:
- Loop Caps = 1 per line post
- Tie Wires = Fence Height in feet x Line Posts

TENSION WIRE:
- Length = Fence Length (same as fence)

CONCRETE:
- Bags per post varies by post diameter and depth
- Typical: 1.5-2 bags per residential post, 2-3 for commercial',

    -- STYLE DIFFERENCES
    'RESIDENTIAL (.065 or LG20 framework):
- Post sizes: 1-5/8" line posts, 1-7/8" to 2" terminal posts
- Top rail: 1-3/8" O.D.
- Fabric: 11.5 or 11 gauge, galvanized or vinyl-coated
- Post spacing: Up to 10ft
- Concrete: 1.5 bags per post

COMMERCIAL (LG20 or Schedule 40 framework):
- Post sizes: 2" to 2-3/8" line posts, 2-3/8" to 2-7/8" terminal posts
- Top rail: 1-5/8" O.D.
- Fabric: 9 gauge galvanized
- Post spacing: 8-10ft (8ft if using privacy slats)
- Concrete: 2 bags per post
- Often includes bottom tension wire

INDUSTRIAL (Schedule 40 framework):
- Post sizes: 2-3/8" to 3" line posts, 3" to 4" terminal posts
- Top rail: 1-5/8" or 1-7/8" O.D.
- Fabric: 9 or 6 gauge
- Post spacing: 6-8ft for tall fences
- May include barbed wire arms or razor ribbon
- Concrete: 2-3 bags per post

VINYL-COATED:
- Same framework as above
- Fabric has PVC coating (green, black, brown)
- All fittings should be color-matched
- More expensive but better aesthetics and corrosion resistance',

    -- INSTALLATION NOTES
    'POST DEPTH:
- Minimum 24" + 3" per foot of fence height over 4ft
- Example: 6ft fence = 24" + (2 x 3") = 30" depth
- 8ft fence = 24" + (4 x 3") = 36" depth

CONCRETE:
- Minimum 2,500 PSI, air-entrained
- Post should be 1/3 in concrete, 2/3 above ground
- Let cure 24-48 hours before stretching fabric

FABRIC INSTALLATION:
- Stretch fabric tight using come-along or fence stretcher
- Attach to terminal posts first with tension bars
- Then tie to top rail and line posts
- Bottom should be 2" above ground (or use tension wire)

GATE CONSIDERATIONS:
- Gate posts must be terminal grade
- Allow for gate hardware and swing clearance
- Single gates up to 6ft wide, doubles for wider openings

SLOPES AND CORNERS:
- On slopes, fabric can be racked (angled) up to 12" per 10ft
- Steeper slopes require stepped installation
- Each corner requires a terminal post
- Maximum fabric stretch: 10ft between terminals'
  )
  ON CONFLICT (product_type_id) DO UPDATE SET
    overview = EXCLUDED.overview,
    components_guide = EXCLUDED.components_guide,
    formula_logic = EXCLUDED.formula_logic,
    style_differences = EXCLUDED.style_differences,
    installation_notes = EXCLUDED.installation_notes,
    updated_at = NOW();

  -- 3. CREATE STYLES
  -- ===========================================================================
  INSERT INTO product_styles_v2 (product_type_id, code, name, formula_adjustments) VALUES
    (v_product_type_id, 'residential', 'Residential', '{"post_grade": "lg20", "fabric_gauge": 11.5, "concrete_per_post": 1.5}'::jsonb),
    (v_product_type_id, 'commercial', 'Commercial', '{"post_grade": "schedule_40", "fabric_gauge": 9, "concrete_per_post": 2}'::jsonb),
    (v_product_type_id, 'industrial', 'Industrial', '{"post_grade": "schedule_40", "fabric_gauge": 6, "concrete_per_post": 2.5}'::jsonb)
  ON CONFLICT DO NOTHING;

  -- 4. CREATE VARIABLES
  -- ===========================================================================
  INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, display_order) VALUES
    (v_product_type_id, 'post_spacing', 'Post Spacing', 'select', '10', ARRAY['6', '8', '10'], 'ft', 1),
    (v_product_type_id, 'fabric_gauge', 'Fabric Gauge', 'select', '11.5', ARRAY['6', '9', '11', '11.5'], 'ga', 2),
    (v_product_type_id, 'mesh_size', 'Mesh Size', 'select', '2', ARRAY['2', '2.25', '1.75'], 'in', 3),
    (v_product_type_id, 'post_grade', 'Post Grade', 'select', 'lg20', ARRAY['lg15', 'lg20', 'schedule_40'], NULL, 4),
    (v_product_type_id, 'terminal_count', 'Terminal Posts (ends/corners)', 'integer', '4', NULL, 'posts', 5),
    (v_product_type_id, 'has_tension_wire', 'Include Tension Wire', 'select', '1', ARRAY['0', '1'], NULL, 6),
    (v_product_type_id, 'coating', 'Coating Type', 'select', 'galvanized', ARRAY['galvanized', 'vinyl_green', 'vinyl_black', 'vinyl_brown'], NULL, 7)
  ON CONFLICT DO NOTHING;

END $$;

-- 5. CREATE COMPONENT TYPES (if not exist)
-- Using correct column names: code, name, description, unit_type, display_order, is_active
-- =============================================================================
INSERT INTO component_types_v2 (code, name, description, unit_type, is_active) VALUES
  -- Posts
  ('cl_terminal_post', 'CL Terminal Post', 'Chain link terminal/corner/gate post', 'Each', true),
  ('cl_line_post', 'CL Line Post', 'Chain link line post', 'Each', true),
  -- Rails
  ('cl_top_rail', 'CL Top Rail', 'Chain link top rail (21ft sections)', 'Each', true),
  ('cl_rail_sleeve', 'CL Rail Sleeve', 'Connects top rail sections', 'Each', true),
  -- Fabric
  ('cl_fabric', 'CL Fabric', 'Chain link mesh fabric', 'Linear Feet', true),
  ('cl_tension_bar', 'CL Tension Bar', 'Slides through fabric end for tensioning', 'Each', true),
  -- Fittings - Terminal
  ('cl_tension_band', 'CL Tension Band', 'Secures tension bar to terminal post', 'Each', true),
  ('cl_brace_band', 'CL Brace Band', 'Holds rail end to terminal post', 'Each', true),
  ('cl_rail_end', 'CL Rail End', 'Caps end of top rail at terminal', 'Each', true),
  ('cl_dome_cap', 'CL Dome Cap', 'Top cap for terminal posts', 'Each', true),
  -- Fittings - Line
  ('cl_loop_cap', 'CL Loop Cap', 'Top cap for line posts, holds rail', 'Each', true),
  ('cl_tie_wire', 'CL Tie Wire', 'Attaches fabric to posts', 'Each', true),
  -- Tension Wire
  ('cl_tension_wire', 'CL Tension Wire', 'Bottom tension wire (7 gauge)', 'Linear Feet', true),
  -- Concrete
  ('cl_concrete', 'CL Concrete', 'Concrete for post setting', 'Each', true)
ON CONFLICT (code) DO NOTHING;

-- 6. ASSIGN COMPONENTS TO CHAIN LINK
-- =============================================================================
DO $$
DECLARE
  v_product_type_id UUID;
  v_component_id UUID;
  v_order INTEGER := 1;
BEGIN
  SELECT id INTO v_product_type_id FROM product_types_v2 WHERE code = 'chain_link';

  -- Assign each component with proper order
  FOR v_component_id IN
    SELECT id FROM component_types_v2 WHERE code LIKE 'cl_%' ORDER BY code
  LOOP
    INSERT INTO product_type_components_v2 (product_type_id, component_type_id, display_order, is_active)
    VALUES (v_product_type_id, v_component_id, v_order, true)
    ON CONFLICT DO NOTHING;
    v_order := v_order + 1;
  END LOOP;
END $$;

-- 7. CREATE FORMULAS
-- =============================================================================
DO $$
DECLARE
  v_product_type_id UUID;
  v_component_id UUID;
BEGIN
  SELECT id INTO v_product_type_id FROM product_types_v2 WHERE code = 'chain_link';

  -- Terminal Posts
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_terminal_post';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[terminal_count]',
      'Number of terminal posts = end posts (2) + corners + gate posts. User specifies total.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Line Posts
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_line_post';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      'ROUNDUP([Quantity]/[post_spacing])-1',
      'Line posts = sections (length / spacing) minus 1. Terminals handle the ends.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Top Rail (21ft sections)
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_top_rail';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      'ROUNDUP([Quantity]/21)',
      'Top rail sections = fence length / 21ft rail length, rounded up.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rail Sleeves
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_rail_sleeve';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      'MAX(ROUNDUP([Quantity]/21)-1,0)',
      'Rail sleeves connect rail sections. Count = rail sections - 1.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Fabric
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_fabric';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[Quantity]+[terminal_count]',
      'Fabric length = fence length + 1ft allowance per terminal for stretching.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tension Bars
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_tension_bar';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[terminal_count]+[Lines]',
      'Tension bars = terminals + extra for corners (2 hookups each). Lines variable accounts for corners.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tension Bands
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_tension_band';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '([terminal_count]+[Lines])*MAX([height]-1,3)',
      'Tension bands per hookup = fence height - 1 (min 3). Multiply by number of hookups.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Brace Bands
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_brace_band';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[terminal_count]+[Lines]',
      'Brace bands = 1 per terminal + extra for corners (need 2 each).',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rail Ends
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_rail_end';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[terminal_count]+[Lines]',
      'Rail ends = same as brace bands, 1 per rail direction at each terminal.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Dome Caps
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_dome_cap';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[terminal_count]',
      'Dome caps = 1 per terminal post.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Loop Caps
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_loop_cap';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      'ROUNDUP([Quantity]/[post_spacing])-1',
      'Loop caps = 1 per line post.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tie Wires
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_tie_wire';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '(ROUNDUP([Quantity]/[post_spacing])-1)*[height]',
      'Tie wires = line posts x fence height (1 per foot of height per post).',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Tension Wire
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_tension_wire';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '[Quantity]*[has_tension_wire]',
      'Tension wire = fence length (if option selected, multiplied by 0 or 1).',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Concrete
  SELECT id INTO v_component_id FROM component_types_v2 WHERE code = 'cl_concrete';
  IF v_component_id IS NOT NULL THEN
    INSERT INTO formula_templates_v2 (product_type_id, component_type_id, formula, plain_english, rounding_level, priority)
    VALUES (v_product_type_id, v_component_id,
      '([terminal_count]+(ROUNDUP([Quantity]/[post_spacing])-1))*1.5',
      'Concrete = total posts x 1.5 bags per post (residential). Adjust multiplier for commercial.',
      'sku', 0)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

-- 8. VERIFICATION QUERY
-- =============================================================================
SELECT
  pt.name as product_type,
  (SELECT COUNT(*) FROM product_styles_v2 WHERE product_type_id = pt.id) as styles,
  (SELECT COUNT(*) FROM product_variables_v2 WHERE product_type_id = pt.id) as variables,
  (SELECT COUNT(*) FROM product_type_components_v2 WHERE product_type_id = pt.id) as components,
  (SELECT COUNT(*) FROM formula_templates_v2 WHERE product_type_id = pt.id) as formulas,
  (SELECT overview IS NOT NULL FROM product_type_knowledge WHERE product_type_id = pt.id) as has_knowledge
FROM product_types_v2 pt
WHERE pt.code = 'chain_link';
