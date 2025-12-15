-- ============================================
-- Migration 163: Add Bundles/Kits Roadmap Item
-- ============================================

-- Find next O-XXX code and insert roadmap item
DO $$
DECLARE
  v_next_code TEXT;
  v_max_num INTEGER;
BEGIN
  -- Get highest O-XXX number
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 3) AS INTEGER)), 0)
  INTO v_max_num
  FROM roadmap_items
  WHERE code LIKE 'O-%';

  v_next_code := 'O-' || LPAD((v_max_num + 1)::TEXT, 3, '0');

  INSERT INTO roadmap_items (code, hub, title, status, raw_idea, claude_analysis)
  VALUES (
    v_next_code,
    'ops-hub',
    'Material Bundles/Kits and Production Recipes',
    'idea',
    'Explore generalizing material bundles for two use cases: (1) BOM Expansion like 3-part concrete mix where components show individually, (2) Production Recipes like stained pickets where finished item is inventoried and production is tracked via work orders.',
    'Two distinct concepts identified from Dec 15 discussion:

1. BOM EXPANSION (e.g., 3-Part Concrete Mix)
- Components appear individually in BOM (Sand, Portland, Quickrock)
- No inventory of the "mix" itself - assembled at job site
- Each component has independent formula/rounding
- Current hardcoded approach works but needs better UI

2. PRODUCTION RECIPE (e.g., Stained Pickets)
- Finished item appears in BOM (Stained Picket)
- Finished item IS inventoried
- Recipe: 42 raw pickets + 1 gal stain → 42 stained pickets
- This is a WORK ORDER concept, not BOM concept

KEY INSIGHT: These may be two different features:
- BOM Expansion = show components because bundle doesnt exist as inventory
- Production Recipe = track how items are made (future work order feature)

OPEN QUESTIONS:
- Should concrete become a proper component with material eligibility?
- Is the "bundle" concept needed, or just better formula organization?
- When to tackle production/work order system for stained pickets?'
  );

  RAISE NOTICE 'Created roadmap item: %', v_next_code;
END $$;
