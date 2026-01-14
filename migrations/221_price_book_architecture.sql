-- ============================================
-- Migration 221: Price Book Architecture
-- ============================================
-- Implements the comprehensive Price Book + Rate Sheet structure:
--
-- LAYER 1: SKU Catalog (existing) + bu_types_allowed for default visibility
-- LAYER 2: BU Price Books - Per-BU SKU availability with overrides
-- LAYER 3: Rate Sheets (existing) - Pricing tiers
-- LAYER 4: Community Products - Richer per-community restrictions
--
-- Resolution Order:
-- 1. What SKUs can we sell? → BU Price Book filters
-- 2. What can this community buy? → Community restrictions filter
-- 3. What price? → Community → Client → BU Rate Sheet
-- ============================================

-- ============================================
-- PART 1: EXTEND SKU CATALOG WITH DEFAULT BU VISIBILITY
-- ============================================

-- Add default BU type visibility to SKU catalog
-- NULL or empty = available everywhere
-- Array = only available to those bu_types by default (can be overridden by price book)
ALTER TABLE sku_catalog_v2 ADD COLUMN IF NOT EXISTS bu_types_allowed TEXT[];

COMMENT ON COLUMN sku_catalog_v2.bu_types_allowed IS
  'Default BU types where this SKU is available. NULL/empty = all. Values: residential, builders, commercial';

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_sku_catalog_v2_bu_types ON sku_catalog_v2 USING GIN(bu_types_allowed);

-- ============================================
-- PART 2: BU PRICE BOOKS (Per-QBO Class SKU Availability)
-- ============================================

CREATE TABLE IF NOT EXISTS bu_price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_class_id VARCHAR(50) NOT NULL REFERENCES qbo_classes(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,

  -- Auto-include logic
  -- If true, automatically include SKUs matching the BU's bu_type
  include_all_for_bu_type BOOLEAN DEFAULT true,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- For copying/versioning
  copied_from_id UUID REFERENCES bu_price_books(id),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),

  UNIQUE(qbo_class_id)
);

COMMENT ON TABLE bu_price_books IS
  'Per-BU price book defining which SKUs are available for sale in that business unit';

-- ============================================
-- PART 3: BU PRICE BOOK OVERRIDES (Exceptions)
-- ============================================

CREATE TABLE IF NOT EXISTS bu_price_book_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES bu_price_books(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES sku_catalog_v2(id) ON DELETE CASCADE,

  -- Action: include = add to book, exclude = remove from book
  action TEXT NOT NULL CHECK (action IN ('include', 'exclude')),

  -- Display customization
  sort_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,  -- Show at top of SKU picker
  category_override TEXT,              -- Override category for this BU

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),

  UNIQUE(price_book_id, sku_id)
);

COMMENT ON TABLE bu_price_book_overrides IS
  'Override default SKU visibility for a specific BU price book. Use action=include to add SKUs not in bu_types_allowed, action=exclude to remove SKUs that would otherwise be included.';

-- ============================================
-- PART 4: COMMUNITY PRODUCTS (Enhanced Restrictions)
-- ============================================

-- Richer community-level product configuration than just approved_sku_ids[]
CREATE TABLE IF NOT EXISTS community_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES sku_catalog_v2(id) ON DELETE CASCADE,

  -- Community-specific product info
  spec_code TEXT,                      -- Community's code for this product, e.g., "Fence Type A"
  custom_description TEXT,             -- "Per HOA spec dated 2024-01-15"

  -- Optional price override (takes precedence over rate sheet)
  price_override DECIMAL(10,2),
  price_override_reason TEXT,          -- Why this community has a special price

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,    -- Pre-select this product in quotes

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),

  UNIQUE(community_id, sku_id)
);

COMMENT ON TABLE community_products IS
  'Products available at a specific community with optional spec codes and price overrides. If community.restrict_skus=true, only SKUs in this table are available.';

-- ============================================
-- PART 5: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bu_price_books_qbo_class ON bu_price_books(qbo_class_id);
CREATE INDEX IF NOT EXISTS idx_bu_price_books_active ON bu_price_books(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bu_price_book_overrides_book ON bu_price_book_overrides(price_book_id);
CREATE INDEX IF NOT EXISTS idx_bu_price_book_overrides_sku ON bu_price_book_overrides(sku_id);
CREATE INDEX IF NOT EXISTS idx_bu_price_book_overrides_action ON bu_price_book_overrides(action);

CREATE INDEX IF NOT EXISTS idx_community_products_community ON community_products(community_id);
CREATE INDEX IF NOT EXISTS idx_community_products_sku ON community_products(sku_id);

-- ============================================
-- PART 6: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE bu_price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bu_price_book_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_products ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated
DROP POLICY IF EXISTS "bu_price_books_read" ON bu_price_books;
CREATE POLICY "bu_price_books_read" ON bu_price_books
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bu_price_book_overrides_read" ON bu_price_book_overrides;
CREATE POLICY "bu_price_book_overrides_read" ON bu_price_book_overrides
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_products_read" ON community_products;
CREATE POLICY "community_products_read" ON community_products
  FOR SELECT TO authenticated USING (true);

-- Write access for admin/ops/sales-manager
DROP POLICY IF EXISTS "bu_price_books_write" ON bu_price_books;
CREATE POLICY "bu_price_books_write" ON bu_price_books
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
  );

DROP POLICY IF EXISTS "bu_price_book_overrides_write" ON bu_price_book_overrides;
CREATE POLICY "bu_price_book_overrides_write" ON bu_price_book_overrides
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
  );

DROP POLICY IF EXISTS "community_products_write" ON community_products;
CREATE POLICY "community_products_write" ON community_products
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
  );

-- ============================================
-- PART 7: TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bu_price_books_updated_at ON bu_price_books;
CREATE TRIGGER update_bu_price_books_updated_at
  BEFORE UPDATE ON bu_price_books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bu_price_book_overrides_updated_at ON bu_price_book_overrides;
CREATE TRIGGER update_bu_price_book_overrides_updated_at
  BEFORE UPDATE ON bu_price_book_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_products_updated_at ON community_products;
CREATE TRIGGER update_community_products_updated_at
  BEFORE UPDATE ON community_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 8: AUTO-CREATE PRICE BOOKS FOR EXISTING QBO CLASSES
-- ============================================

INSERT INTO bu_price_books (qbo_class_id, name, description, include_all_for_bu_type, is_active)
SELECT
  id,
  CONCAT(name, ' Price Book'),
  CONCAT('SKU availability for ', name),
  true,  -- Auto-include based on bu_type
  true
FROM qbo_classes
WHERE is_active = true
ON CONFLICT (qbo_class_id) DO NOTHING;

-- ============================================
-- PART 9: RPC FUNCTIONS FOR SKU FILTERING
-- ============================================

-- Function: Get available SKUs for a given context (BU + optional community)
CREATE OR REPLACE FUNCTION get_available_skus(
  p_qbo_class_id VARCHAR(50),
  p_community_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  sku_code TEXT,
  sku_name TEXT,
  product_type_id UUID,
  product_style_id UUID,
  height INTEGER,
  post_type TEXT,
  variables JSONB,
  components JSONB,
  standard_cost_per_foot DECIMAL,
  standard_material_cost DECIMAL,
  standard_labor_cost DECIMAL,
  is_featured BOOLEAN,
  sort_order INTEGER,
  community_spec_code TEXT,
  community_price_override DECIMAL
) AS $$
DECLARE
  v_price_book_id UUID;
  v_bu_type TEXT;
  v_restrict_skus BOOLEAN;
BEGIN
  -- Get the price book for this BU
  SELECT pb.id INTO v_price_book_id
  FROM bu_price_books pb
  WHERE pb.qbo_class_id = p_qbo_class_id AND pb.is_active = true;

  -- Get the BU type for this QBO class
  SELECT qc.bu_type INTO v_bu_type
  FROM qbo_classes qc
  WHERE qc.id = p_qbo_class_id;

  -- Check if community restricts SKUs
  IF p_community_id IS NOT NULL THEN
    SELECT c.restrict_skus INTO v_restrict_skus
    FROM communities c
    WHERE c.id = p_community_id;
  ELSE
    v_restrict_skus := false;
  END IF;

  -- Return filtered SKUs
  RETURN QUERY
  WITH base_skus AS (
    -- Start with active SKUs
    SELECT
      s.id,
      s.sku_code,
      s.sku_name,
      s.product_type_id,
      s.product_style_id,
      s.height,
      s.post_type,
      s.variables,
      s.components,
      s.standard_cost_per_foot,
      s.standard_material_cost,
      s.standard_labor_cost,
      COALESCE(o.is_featured, false) AS is_featured,
      COALESCE(o.sort_order, 0) AS sort_order,
      o.action AS override_action
    FROM sku_catalog_v2 s
    LEFT JOIN bu_price_book_overrides o ON o.sku_id = s.id AND o.price_book_id = v_price_book_id
    WHERE s.is_active = true
  ),
  bu_filtered AS (
    -- Apply BU filtering
    SELECT bs.*
    FROM base_skus bs
    WHERE
      -- Include if explicitly included in price book
      bs.override_action = 'include'
      OR (
        -- Not explicitly excluded
        (bs.override_action IS NULL OR bs.override_action != 'exclude')
        AND (
          -- SKU allows all BU types
          (SELECT sc.bu_types_allowed IS NULL OR sc.bu_types_allowed = '{}' FROM sku_catalog_v2 sc WHERE sc.id = bs.id)
          -- OR matches this BU type
          OR v_bu_type = ANY((SELECT sc.bu_types_allowed FROM sku_catalog_v2 sc WHERE sc.id = bs.id))
        )
      )
  ),
  community_filtered AS (
    -- Apply community filtering if applicable
    SELECT
      bf.*,
      cp.spec_code AS community_spec_code,
      cp.price_override AS community_price_override
    FROM bu_filtered bf
    LEFT JOIN community_products cp ON cp.sku_id = bf.id AND cp.community_id = p_community_id
    WHERE
      -- If community doesn't restrict, include all BU-filtered SKUs
      NOT v_restrict_skus
      -- If community restricts, only include SKUs in community_products
      OR cp.id IS NOT NULL
  )
  SELECT
    cf.id,
    cf.sku_code,
    cf.sku_name,
    cf.product_type_id,
    cf.product_style_id,
    cf.height,
    cf.post_type,
    cf.variables,
    cf.components,
    cf.standard_cost_per_foot,
    cf.standard_material_cost,
    cf.standard_labor_cost,
    cf.is_featured,
    cf.sort_order,
    cf.community_spec_code,
    cf.community_price_override
  FROM community_filtered cf
  ORDER BY cf.is_featured DESC, cf.sort_order, cf.sku_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_available_skus IS
  'Returns SKUs available for a given BU (qbo_class_id), optionally filtered by community restrictions';

-- ============================================
-- PART 10: ENHANCED GET_RATE_SHEET_PRICE FUNCTION
-- ============================================

-- Update the existing function to also check community_products price_override
CREATE OR REPLACE FUNCTION get_resolved_price(
  p_sku_id UUID,
  p_base_cost DECIMAL,
  p_community_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_qbo_class_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  price DECIMAL(10,2),
  labor_price DECIMAL(10,2),
  material_price DECIMAL(10,2),
  pricing_method VARCHAR(30),
  pricing_source VARCHAR(50),
  rate_sheet_id UUID,
  rate_sheet_name TEXT
) AS $$
DECLARE
  v_community_price DECIMAL(10,2);
  v_rate_sheet_id UUID;
  v_rate_sheet_name TEXT;
  v_client_id UUID;
  v_source VARCHAR(50);
BEGIN
  -- Step 1: Check community price override (highest priority)
  IF p_community_id IS NOT NULL THEN
    SELECT cp.price_override INTO v_community_price
    FROM community_products cp
    WHERE cp.community_id = p_community_id AND cp.sku_id = p_sku_id;

    IF v_community_price IS NOT NULL THEN
      RETURN QUERY SELECT
        v_community_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'community_override'::VARCHAR(30),
        'Community Price Override'::VARCHAR(50),
        NULL::UUID,
        NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Step 2: Find effective rate sheet (community → client → BU)
  -- Check community rate sheet
  IF p_community_id IS NOT NULL THEN
    SELECT c.rate_sheet_id, c.client_id INTO v_rate_sheet_id, v_client_id
    FROM communities c WHERE c.id = p_community_id;

    IF v_rate_sheet_id IS NOT NULL THEN
      v_source := 'Community Rate Sheet';
    END IF;
  END IF;

  -- Fall back to client rate sheet
  IF v_rate_sheet_id IS NULL AND (p_client_id IS NOT NULL OR v_client_id IS NOT NULL) THEN
    SELECT cl.default_rate_sheet_id INTO v_rate_sheet_id
    FROM clients cl WHERE cl.id = COALESCE(p_client_id, v_client_id);

    IF v_rate_sheet_id IS NOT NULL THEN
      v_source := 'Client Rate Sheet';
    END IF;
  END IF;

  -- Fall back to BU default rate sheet
  IF v_rate_sheet_id IS NULL AND p_qbo_class_id IS NOT NULL THEN
    SELECT qc.default_rate_sheet_id INTO v_rate_sheet_id
    FROM qbo_classes qc WHERE qc.id = p_qbo_class_id;

    IF v_rate_sheet_id IS NOT NULL THEN
      v_source := 'BU Default Rate Sheet';
    END IF;
  END IF;

  -- Step 3: Get rate sheet name
  IF v_rate_sheet_id IS NOT NULL THEN
    SELECT rs.name INTO v_rate_sheet_name
    FROM rate_sheets rs WHERE rs.id = v_rate_sheet_id;
  END IF;

  -- Step 4: Get price from rate sheet
  IF v_rate_sheet_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      rsp.price,
      rsp.labor_price,
      rsp.material_price,
      rsp.pricing_method::VARCHAR(30),
      v_source,
      v_rate_sheet_id,
      v_rate_sheet_name
    FROM get_rate_sheet_price(v_rate_sheet_id, p_sku_id, p_base_cost) rsp;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Step 5: No rate sheet or no price - return cost
  RETURN QUERY SELECT
    p_base_cost,
    NULL::DECIMAL(10,2),
    NULL::DECIMAL(10,2),
    'cost_only'::VARCHAR(30),
    'No Rate Sheet'::VARCHAR(50),
    NULL::UUID,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_resolved_price IS
  'Resolves the final price for a SKU given context: community price override → rate sheet hierarchy → cost fallback';

-- ============================================
-- PART 11: VIEW FOR PRICE BOOK SUMMARY
-- ============================================

CREATE OR REPLACE VIEW v_bu_price_book_summary AS
SELECT
  pb.id,
  pb.qbo_class_id,
  qc.name AS qbo_class_name,
  qc.bu_type,
  pb.name,
  pb.description,
  pb.include_all_for_bu_type,
  pb.is_active,
  pb.created_at,
  pb.updated_at,
  -- Count SKUs
  (
    SELECT COUNT(DISTINCT s.id)
    FROM sku_catalog_v2 s
    LEFT JOIN bu_price_book_overrides o ON o.sku_id = s.id AND o.price_book_id = pb.id
    WHERE s.is_active = true
    AND (
      o.action = 'include'
      OR (
        (o.action IS NULL OR o.action != 'exclude')
        AND (s.bu_types_allowed IS NULL OR s.bu_types_allowed = '{}' OR qc.bu_type = ANY(s.bu_types_allowed))
      )
    )
  ) AS sku_count,
  -- Count explicit includes
  (SELECT COUNT(*) FROM bu_price_book_overrides o WHERE o.price_book_id = pb.id AND o.action = 'include') AS include_count,
  -- Count explicit excludes
  (SELECT COUNT(*) FROM bu_price_book_overrides o WHERE o.price_book_id = pb.id AND o.action = 'exclude') AS exclude_count,
  -- Rate sheet info
  qc.default_rate_sheet_id,
  rs.name AS default_rate_sheet_name
FROM bu_price_books pb
JOIN qbo_classes qc ON qc.id = pb.qbo_class_id
LEFT JOIN rate_sheets rs ON rs.id = qc.default_rate_sheet_id;

COMMENT ON VIEW v_bu_price_book_summary IS
  'Summary view of price books with SKU counts and associated rate sheet';

-- ============================================
-- PART 12: VIEW FOR COMMUNITY PRODUCT SUMMARY
-- ============================================

CREATE OR REPLACE VIEW v_community_products_summary AS
SELECT
  c.id AS community_id,
  c.name AS community_name,
  c.restrict_skus,
  cl.id AS client_id,
  cl.company_name AS client_name,
  -- Count products
  (SELECT COUNT(*) FROM community_products cp WHERE cp.community_id = c.id) AS product_count,
  -- Rate sheet info
  c.rate_sheet_id AS community_rate_sheet_id,
  rs_c.name AS community_rate_sheet_name,
  cl.default_rate_sheet_id AS client_rate_sheet_id,
  rs_cl.name AS client_rate_sheet_name,
  -- Effective rate sheet
  COALESCE(c.rate_sheet_id, cl.default_rate_sheet_id) AS effective_rate_sheet_id,
  COALESCE(rs_c.name, rs_cl.name) AS effective_rate_sheet_name
FROM communities c
LEFT JOIN clients cl ON cl.id = c.client_id
LEFT JOIN rate_sheets rs_c ON rs_c.id = c.rate_sheet_id
LEFT JOIN rate_sheets rs_cl ON rs_cl.id = cl.default_rate_sheet_id;

COMMENT ON VIEW v_community_products_summary IS
  'Summary view of communities with product counts and rate sheet inheritance';
