-- ============================================
-- Migration 142: Labor Groups V2
-- ============================================
-- Adds labor grouping system (like material components)
-- Each product type can have different labor groups assigned
-- Each group can be Required/Optional and Single/Multiple

-- ============================================
-- PART 1: LABOR GROUPS TABLE
-- ============================================

-- Labor groups define categories like "Post Setting", "Nail Up", "Other Labor"
CREATE TABLE IF NOT EXISTS labor_groups_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'set_post', 'nail_up', 'other_labor'
  name TEXT NOT NULL,                      -- 'Post Setting', 'Nail Up', 'Other Labor'
  description TEXT,
  is_required BOOLEAN DEFAULT true,        -- Must have at least 1 code selected?
  allow_multiple BOOLEAN DEFAULT false,    -- Can have multiple codes? (true for other_labor)
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE labor_groups_v2 IS 'Labor group definitions (like component_types_v2 but for labor)';
COMMENT ON COLUMN labor_groups_v2.is_required IS 'If true, SKU must have at least one labor code from this group';
COMMENT ON COLUMN labor_groups_v2.allow_multiple IS 'If true, SKU can have multiple labor codes from this group (e.g., other_labor)';

-- ============================================
-- PART 2: PRODUCT TYPE LABOR GROUP ASSIGNMENTS
-- ============================================

-- Which labor groups are used by each product type
CREATE TABLE IF NOT EXISTS product_type_labor_groups_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  labor_group_id UUID NOT NULL REFERENCES labor_groups_v2(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, labor_group_id)
);

COMMENT ON TABLE product_type_labor_groups_v2 IS 'Assigns labor groups to product types';

-- ============================================
-- PART 3: LABOR GROUP ELIGIBILITY
-- ============================================

-- Which labor codes are eligible for each group per product type
-- Includes condition formula for when the code applies
CREATE TABLE IF NOT EXISTS labor_group_eligibility_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  labor_group_id UUID NOT NULL REFERENCES labor_groups_v2(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id) ON DELETE CASCADE,
  condition_formula TEXT,                  -- e.g., "height <= 6" or "post_type == 'STEEL'"
  is_default BOOLEAN DEFAULT false,        -- Default selection when condition matches
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type_id, labor_group_id, labor_code_id)
);

COMMENT ON TABLE labor_group_eligibility_v2 IS 'Labor codes eligible for each group, with conditions';
COMMENT ON COLUMN labor_group_eligibility_v2.condition_formula IS 'Formula that determines when this labor code applies (empty = always eligible)';

-- ============================================
-- PART 4: ADD LABOR_CODES TO SKU_CATALOG_V2
-- ============================================

ALTER TABLE sku_catalog_v2
ADD COLUMN IF NOT EXISTS labor_codes JSONB DEFAULT '{}';

COMMENT ON COLUMN sku_catalog_v2.labor_codes IS 'Labor codes by group: {"set_post": "W03", "nail_up": "W01", "other_labor": ["W11", "W23"]}';

-- ============================================
-- PART 5: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_labor_groups_v2_active ON labor_groups_v2(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_labor_groups_v2_code ON labor_groups_v2(code);

CREATE INDEX IF NOT EXISTS idx_product_type_labor_groups_v2_type ON product_type_labor_groups_v2(product_type_id);
CREATE INDEX IF NOT EXISTS idx_product_type_labor_groups_v2_group ON product_type_labor_groups_v2(labor_group_id);

CREATE INDEX IF NOT EXISTS idx_labor_group_eligibility_v2_type ON labor_group_eligibility_v2(product_type_id);
CREATE INDEX IF NOT EXISTS idx_labor_group_eligibility_v2_group ON labor_group_eligibility_v2(labor_group_id);
CREATE INDEX IF NOT EXISTS idx_labor_group_eligibility_v2_code ON labor_group_eligibility_v2(labor_code_id);

CREATE INDEX IF NOT EXISTS idx_sku_catalog_v2_labor ON sku_catalog_v2 USING GIN(labor_codes);

-- ============================================
-- PART 6: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE labor_groups_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_type_labor_groups_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_group_eligibility_v2 ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated
CREATE POLICY "read_labor_groups_v2" ON labor_groups_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_product_type_labor_groups_v2" ON product_type_labor_groups_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_labor_group_eligibility_v2" ON labor_group_eligibility_v2 FOR SELECT TO authenticated USING (true);

-- Write access for authenticated (app layer restricts to admin)
CREATE POLICY "write_labor_groups_v2" ON labor_groups_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_product_type_labor_groups_v2" ON product_type_labor_groups_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "write_labor_group_eligibility_v2" ON labor_group_eligibility_v2 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- PART 7: SEED LABOR GROUPS
-- ============================================

INSERT INTO labor_groups_v2 (code, name, description, is_required, allow_multiple, display_order) VALUES
  ('set_post', 'Post Setting', 'Labor for setting posts in ground', true, false, 1),
  ('nail_up', 'Nail Up', 'Labor for nailing up fence boards/panels', true, false, 2),
  ('other_labor', 'Other Labor', 'Additional labor costs (cap rail, trim, etc.)', false, true, 3)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_required = EXCLUDED.is_required,
  allow_multiple = EXCLUDED.allow_multiple,
  display_order = EXCLUDED.display_order;

-- ============================================
-- PART 8: ASSIGN LABOR GROUPS TO WOOD-VERTICAL
-- ============================================

-- Get wood-vertical product type ID and assign all 3 labor groups
INSERT INTO product_type_labor_groups_v2 (product_type_id, labor_group_id, display_order)
SELECT
  pt.id,
  lg.id,
  lg.display_order
FROM product_types_v2 pt
CROSS JOIN labor_groups_v2 lg
WHERE pt.code = 'wood-vertical'
  AND lg.is_active = true
ON CONFLICT (product_type_id, labor_group_id) DO NOTHING;

-- ============================================
-- PART 9: SEED LABOR CODE ELIGIBILITY FOR WOOD-VERTICAL
-- ============================================

-- Post Setting labor codes
INSERT INTO labor_group_eligibility_v2 (product_type_id, labor_group_id, labor_code_id, condition_formula, is_default, display_order)
SELECT
  pt.id,
  lg.id,
  lc.id,
  CASE
    WHEN lc.labor_sku = 'W03' THEN 'post_spacing == 8'
    WHEN lc.labor_sku = 'W04' THEN 'post_spacing == 6'
    WHEN lc.labor_sku = 'BW02' THEN 'post_spacing == 8'
    WHEN lc.labor_sku = 'BW04' THEN 'post_spacing == 6'
    ELSE NULL
  END,
  lc.labor_sku IN ('W03', 'BW02'),  -- Default for 8' spacing
  CASE
    WHEN lc.labor_sku LIKE 'W%' THEN 1
    WHEN lc.labor_sku LIKE 'BW%' THEN 2
    ELSE 10
  END
FROM product_types_v2 pt
CROSS JOIN labor_groups_v2 lg
CROSS JOIN labor_codes lc
WHERE pt.code = 'wood-vertical'
  AND lg.code = 'set_post'
  AND lc.labor_sku IN ('W03', 'W04', 'BW02', 'BW04')
ON CONFLICT (product_type_id, labor_group_id, labor_code_id) DO NOTHING;

-- Nail Up labor codes
INSERT INTO labor_group_eligibility_v2 (product_type_id, labor_group_id, labor_code_id, condition_formula, is_default, display_order)
SELECT
  pt.id,
  lg.id,
  lc.id,
  CASE
    WHEN lc.labor_sku = 'W01' THEN 'height <= 6'
    WHEN lc.labor_sku = 'W02' THEN 'height > 6'
    WHEN lc.labor_sku = 'BW03' THEN 'height <= 6'
    WHEN lc.labor_sku = 'BW06' THEN 'height > 6'
    ELSE NULL
  END,
  lc.labor_sku IN ('W01', 'BW03'),  -- Default for 6' height
  CASE
    WHEN lc.labor_sku LIKE 'W%' THEN 1
    WHEN lc.labor_sku LIKE 'BW%' THEN 2
    ELSE 10
  END
FROM product_types_v2 pt
CROSS JOIN labor_groups_v2 lg
CROSS JOIN labor_codes lc
WHERE pt.code = 'wood-vertical'
  AND lg.code = 'nail_up'
  AND lc.labor_sku IN ('W01', 'W02', 'BW03', 'BW06')
ON CONFLICT (product_type_id, labor_group_id, labor_code_id) DO NOTHING;

-- Other Labor codes (multiple can apply)
INSERT INTO labor_group_eligibility_v2 (product_type_id, labor_group_id, labor_code_id, condition_formula, is_default, display_order)
SELECT
  pt.id,
  lg.id,
  lc.id,
  CASE
    WHEN lc.labor_sku = 'W05' THEN 'rails == 3'
    WHEN lc.labor_sku = 'W11' THEN NULL  -- Always eligible
    WHEN lc.labor_sku = 'W12' THEN NULL  -- Always eligible (cap & trim)
    WHEN lc.labor_sku = 'W23' THEN NULL  -- Always eligible
    WHEN lc.labor_sku = 'BW05' THEN 'rails == 3'
    ELSE NULL
  END,
  false,  -- None are default for other_labor
  CASE
    WHEN lc.labor_sku = 'W05' THEN 1
    WHEN lc.labor_sku = 'W11' THEN 2
    WHEN lc.labor_sku = 'W12' THEN 3
    WHEN lc.labor_sku = 'W23' THEN 4
    WHEN lc.labor_sku = 'BW05' THEN 5
    ELSE 10
  END
FROM product_types_v2 pt
CROSS JOIN labor_groups_v2 lg
CROSS JOIN labor_codes lc
WHERE pt.code = 'wood-vertical'
  AND lg.code = 'other_labor'
  AND lc.labor_sku IN ('W05', 'W11', 'W12', 'W23', 'BW05')
ON CONFLICT (product_type_id, labor_group_id, labor_code_id) DO NOTHING;
