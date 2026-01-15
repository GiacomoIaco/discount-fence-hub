-- ============================================
-- Migration 233: Restore Rate Sheets Tables
-- ============================================
-- This migration reverts migration 232's renaming.
-- We're keeping Rate Sheets as a SEPARATE concept from Price Books.
--
-- Rate Sheets = Pricing tiers (HOW MUCH do they pay)
-- Price Books = Product catalogs (WHAT can they buy) - created in migration 234
--
-- KEEPING from migration 232:
-- - rate_sheets.tags[] column (useful for organization)
-- - rate_sheet_items.is_featured column (useful for price lists)
--
-- REMOVING from migration 232:
-- - availability_mode column (will be on price_books instead)
-- ============================================

-- ============================================
-- PART 1: RENAME TABLES BACK
-- ============================================

-- Rename price_books back to rate_sheets
ALTER TABLE IF EXISTS price_books RENAME TO rate_sheets;

-- Rename price_book_items back to rate_sheet_items
ALTER TABLE IF EXISTS price_book_items RENAME TO rate_sheet_items;

-- Rename price_book_assignments back to rate_sheet_assignments
ALTER TABLE IF EXISTS price_book_assignments RENAME TO rate_sheet_assignments;

-- ============================================
-- PART 2: RENAME FK COLUMNS BACK
-- ============================================

-- In rate_sheet_items: rename price_book_id back to rate_sheet_id
ALTER TABLE rate_sheet_items
  RENAME COLUMN price_book_id TO rate_sheet_id;

-- In rate_sheet_assignments: rename price_book_id back to rate_sheet_id
ALTER TABLE rate_sheet_assignments
  RENAME COLUMN price_book_id TO rate_sheet_id;

-- ============================================
-- PART 3: RENAME FK COLUMNS IN OTHER TABLES
-- ============================================

-- Update clients.default_price_book_id back to default_rate_sheet_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'default_price_book_id'
  ) THEN
    ALTER TABLE clients RENAME COLUMN default_price_book_id TO default_rate_sheet_id;
  END IF;
END $$;

-- Update communities.price_book_id to rate_sheet_override_id
-- (using _override_id to clarify this is an OVERRIDE of client's rate sheet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'price_book_id'
  ) THEN
    ALTER TABLE communities RENAME COLUMN price_book_id TO rate_sheet_override_id;
  END IF;
END $$;

-- Update qbo_classes.default_price_book_id back to default_rate_sheet_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qbo_classes' AND column_name = 'default_price_book_id'
  ) THEN
    ALTER TABLE qbo_classes RENAME COLUMN default_price_book_id TO default_rate_sheet_id;
  END IF;
END $$;

-- ============================================
-- PART 4: DROP AVAILABILITY_MODE COLUMN
-- ============================================

-- This will be on price_books (product catalogs) instead
ALTER TABLE rate_sheets DROP COLUMN IF EXISTS availability_mode;

-- ============================================
-- PART 5: RENAME INDEXES
-- ============================================

-- Rename the featured items index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_price_book_items_featured') THEN
    ALTER INDEX idx_price_book_items_featured RENAME TO idx_rate_sheet_items_featured;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Index might not exist
END $$;

-- Rename the tags index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_price_books_tags') THEN
    ALTER INDEX idx_price_books_tags RENAME TO idx_rate_sheets_tags;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Index might not exist
END $$;

-- ============================================
-- PART 6: UPDATE get_resolved_price FUNCTION
-- ============================================

-- Drop existing function first (signature is changing)
DROP FUNCTION IF EXISTS get_resolved_price(UUID, DECIMAL, UUID, UUID, VARCHAR(50));

-- Create function with correct rate_sheet references
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
  -- Check community rate sheet override
  IF p_community_id IS NOT NULL THEN
    SELECT c.rate_sheet_override_id, c.client_id INTO v_rate_sheet_id, v_client_id
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
  'Resolve effective price for a SKU through the cascade: community override → community rate sheet → client rate sheet → BU default rate sheet';

-- ============================================
-- PART 7: RENAME get_price_book_price TO get_rate_sheet_price
-- ============================================

-- Drop the price_book version
DROP FUNCTION IF EXISTS get_price_book_price(UUID, UUID, DECIMAL);

-- Create the rate_sheet version
CREATE OR REPLACE FUNCTION get_rate_sheet_price(
  p_rate_sheet_id UUID,
  p_sku_id UUID,
  p_base_cost DECIMAL DEFAULT 0
)
RETURNS TABLE (
  price DECIMAL(10,2),
  labor_price DECIMAL(10,2),
  material_price DECIMAL(10,2),
  pricing_method TEXT
) AS $$
DECLARE
  v_item RECORD;
  v_rate_sheet RECORD;
  v_calculated_price DECIMAL(10,2);
BEGIN
  -- Get rate sheet defaults
  SELECT * INTO v_rate_sheet
  FROM rate_sheets WHERE id = p_rate_sheet_id;

  -- Get specific item pricing
  SELECT * INTO v_item
  FROM rate_sheet_items
  WHERE rate_sheet_id = p_rate_sheet_id AND sku_id = p_sku_id;

  -- If no specific item, check if we should use defaults
  IF v_item IS NULL THEN
    -- No item found, use defaults if rate sheet is formula type
    IF v_rate_sheet.pricing_type IN ('formula', 'hybrid') THEN
      -- Calculate from defaults using margin if set, otherwise markup
      IF v_rate_sheet.default_margin_target IS NOT NULL AND v_rate_sheet.default_margin_target > 0 AND v_rate_sheet.default_margin_target < 100 THEN
        -- Use margin formula: price = cost / (1 - margin%)
        v_calculated_price := p_base_cost / (1 - v_rate_sheet.default_margin_target / 100);
      ELSE
        -- Use markup formula: price = cost * (1 + markup%)
        v_calculated_price := p_base_cost * (1 + COALESCE(v_rate_sheet.default_material_markup, 0) / 100);
      END IF;

      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'default_formula'::TEXT;
      RETURN;
    END IF;

    -- No pricing found
    RETURN;
  END IF;

  -- Calculate price based on item's pricing method
  CASE v_item.pricing_method
    WHEN 'fixed' THEN
      RETURN QUERY SELECT
        COALESCE(v_item.fixed_price, p_base_cost),
        v_item.fixed_labor_price,
        v_item.fixed_material_price,
        'fixed'::TEXT;

    WHEN 'markup' THEN
      -- Calculate labor and material separately if both markups are set
      v_calculated_price := p_base_cost * (1 + COALESCE(v_item.material_markup_percent, v_rate_sheet.default_material_markup, 0) / 100);
      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'markup'::TEXT;

    WHEN 'margin' THEN
      -- Calculate from target margin: price = cost / (1 - margin)
      IF COALESCE(v_item.margin_target_percent, v_rate_sheet.default_margin_target) IS NOT NULL
         AND COALESCE(v_item.margin_target_percent, v_rate_sheet.default_margin_target) < 100 THEN
        v_calculated_price := p_base_cost / (1 - COALESCE(v_item.margin_target_percent, v_rate_sheet.default_margin_target, 0) / 100);
      ELSE
        v_calculated_price := p_base_cost;
      END IF;
      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'margin'::TEXT;

    WHEN 'cost_plus' THEN
      -- Add fixed amount to cost
      v_calculated_price := p_base_cost + COALESCE(v_item.cost_plus_amount, 0);
      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'cost_plus'::TEXT;

    ELSE
      -- Default: return base cost
      RETURN QUERY SELECT
        p_base_cost,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'default'::TEXT;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_rate_sheet_price IS
  'Calculate effective price for a SKU from a rate sheet, applying pricing rules';

-- ============================================
-- PART 8: ADD cost_plus_amount COLUMN IF MISSING
-- ============================================

ALTER TABLE rate_sheet_items
  ADD COLUMN IF NOT EXISTS cost_plus_amount DECIMAL(10,2);

COMMENT ON COLUMN rate_sheet_items.cost_plus_amount IS
  'Fixed amount to add to cost for cost_plus pricing method';

-- ============================================
-- PART 9: UPDATE v_community_products_summary VIEW
-- ============================================

DROP VIEW IF EXISTS v_community_products_summary;

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
  c.rate_sheet_override_id AS community_rate_sheet_id,
  rs_c.name AS community_rate_sheet_name,
  cl.default_rate_sheet_id AS client_rate_sheet_id,
  rs_cl.name AS client_rate_sheet_name,
  -- Effective rate sheet
  COALESCE(c.rate_sheet_override_id, cl.default_rate_sheet_id) AS effective_rate_sheet_id,
  COALESCE(rs_c.name, rs_cl.name) AS effective_rate_sheet_name
FROM communities c
LEFT JOIN clients cl ON cl.id = c.client_id
LEFT JOIN rate_sheets rs_c ON rs_c.id = c.rate_sheet_override_id
LEFT JOIN rate_sheets rs_cl ON rs_cl.id = cl.default_rate_sheet_id;

COMMENT ON VIEW v_community_products_summary IS
  'Summary view of communities with product counts and rate sheet inheritance';

-- ============================================
-- PART 10: LOG COMPLETION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 233: Restored Rate Sheets tables';
  RAISE NOTICE 'Tables renamed back: price_books -> rate_sheets, price_book_items -> rate_sheet_items, price_book_assignments -> rate_sheet_assignments';
  RAISE NOTICE 'FK columns renamed back: price_book_id -> rate_sheet_id';
  RAISE NOTICE 'Kept columns: tags[], is_featured';
  RAISE NOTICE 'Added column: cost_plus_amount';
  RAISE NOTICE 'Dropped column: availability_mode';
  RAISE NOTICE 'Communities now use rate_sheet_override_id (clarifies override purpose)';
END $$;
