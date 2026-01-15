-- ============================================
-- Migration 157: Add All VW Labor Codes to Wood Vertical Other Labor
-- ============================================
-- Adds all labor codes marked with VW (Vertical Wood) to the Other Labor
-- group so they can be optionally selected when building SKUs
-- ============================================

-- First, let's see what's currently in Other Labor for wood-vertical
-- Then add any missing VW codes

-- VW Labor Codes from labor_rates (Products = VW):
-- M03: Steel Post - Nail Up - Vertical up to 6' High
-- M04: Steel Post - Nail Up - Vertical 7' or 8' High
-- M06: Steel Post - Goodneighbor Style
-- M07: Steel Post - Cap and Trim
-- W02: Set Post 8' OC
-- W03: Nail Up - Vertical up to 6' High
-- W04: Nail Up - Vertical 7' or 8' High
-- W05: Additional Rail
-- W06: Goodneighbor Style
-- W07: Cap and Trim
-- W08: Just Trim/Additional Trim
-- W09: Just CAP
-- W10: Wood Gate - Vert - Single (up to 6FT)
-- W11: Wood Gate - Vertical - Single (8FT)

-- Insert all VW labor codes into Other Labor group for wood-vertical
INSERT INTO labor_group_eligibility_v2 (
  product_type_id,
  labor_group_id,
  labor_code_id,
  condition_formula,
  is_default,
  display_order
)
SELECT
  pt.id,
  lg.id,
  lc.id,
  CASE lc.labor_sku
    -- Steel Post options (for steel post type)
    WHEN 'M03' THEN 'post_type == "steel" AND height <= 6'
    WHEN 'M04' THEN 'post_type == "steel" AND height > 6'
    WHEN 'M06' THEN 'post_type == "steel" AND style == "good_neighbor"'
    WHEN 'M07' THEN 'post_type == "steel"'
    -- Wood Post options
    WHEN 'W02' THEN NULL  -- Set Post - already in set_post group but add here for visibility
    WHEN 'W03' THEN NULL  -- Nail Up 6' - already in nail_up group but add here for visibility
    WHEN 'W04' THEN NULL  -- Nail Up 7-8' - already in nail_up group but add here for visibility
    WHEN 'W05' THEN 'rail_count >= 3'  -- Additional Rail
    WHEN 'W06' THEN 'style == "good_neighbor"'  -- Goodneighbor Style
    WHEN 'W07' THEN NULL  -- Cap and Trim - always available
    WHEN 'W08' THEN NULL  -- Just Trim - always available
    WHEN 'W09' THEN NULL  -- Just Cap - always available
    WHEN 'W10' THEN 'height <= 6'  -- Gate up to 6ft
    WHEN 'W11' THEN 'height > 6'   -- Gate 8ft
    ELSE NULL
  END,
  false,  -- None are default for other_labor
  CASE lc.labor_sku
    -- Order by logical grouping
    WHEN 'M03' THEN 1
    WHEN 'M04' THEN 2
    WHEN 'M06' THEN 3
    WHEN 'M07' THEN 4
    WHEN 'W05' THEN 10
    WHEN 'W06' THEN 11
    WHEN 'W07' THEN 12
    WHEN 'W08' THEN 13
    WHEN 'W09' THEN 14
    WHEN 'W10' THEN 20
    WHEN 'W11' THEN 21
    ELSE 99
  END
FROM product_types_v2 pt
CROSS JOIN labor_groups_v2 lg
CROSS JOIN labor_codes lc
WHERE pt.code = 'wood-vertical'
  AND lg.code = 'other_labor'
  AND lc.labor_sku IN ('M03', 'M04', 'M06', 'M07', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11')
ON CONFLICT (product_type_id, labor_group_id, labor_code_id)
DO UPDATE SET
  condition_formula = EXCLUDED.condition_formula,
  display_order = EXCLUDED.display_order;

-- Verify what we have now
SELECT
  lg.name as labor_group,
  lc.labor_sku,
  lc.description,
  lge.condition_formula,
  lge.is_default,
  lge.display_order
FROM labor_group_eligibility_v2 lge
JOIN product_types_v2 pt ON pt.id = lge.product_type_id
JOIN labor_groups_v2 lg ON lg.id = lge.labor_group_id
JOIN labor_codes lc ON lc.id = lge.labor_code_id
WHERE pt.code = 'wood-vertical'
ORDER BY lg.display_order, lge.display_order;
