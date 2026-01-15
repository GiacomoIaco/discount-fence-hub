-- ============================================
-- Migration 232: Rename Rate Sheets to Price Books
-- ============================================
-- Part of Price Books Redesign Phase 2
--
-- This migration:
-- 1. Renames rate_sheets → price_books
-- 2. Renames rate_sheet_items → price_book_items
-- 3. Renames rate_sheet_assignments → price_book_assignments
-- 4. Adds new columns: tags[], availability_mode
-- 5. Adds is_featured to price_book_items
-- 6. Updates foreign key columns and views
-- ============================================

-- ============================================
-- PART 1: RENAME TABLES
-- ============================================

-- Rename rate_sheets to price_books
ALTER TABLE IF EXISTS rate_sheets RENAME TO price_books;

-- Rename rate_sheet_items to price_book_items
ALTER TABLE IF EXISTS rate_sheet_items RENAME TO price_book_items;

-- Rename rate_sheet_assignments to price_book_assignments
ALTER TABLE IF EXISTS rate_sheet_assignments RENAME TO price_book_assignments;

-- ============================================
-- PART 2: RENAME FOREIGN KEY COLUMNS
-- ============================================

-- In price_book_items: rename rate_sheet_id to price_book_id
ALTER TABLE price_book_items
  RENAME COLUMN rate_sheet_id TO price_book_id;

-- In price_book_assignments: rename rate_sheet_id to price_book_id
ALTER TABLE price_book_assignments
  RENAME COLUMN rate_sheet_id TO price_book_id;

-- ============================================
-- PART 3: ADD NEW COLUMNS TO PRICE_BOOKS
-- ============================================

-- Tags for organization (e.g., 'large-builders', 'austin', 'wood-only')
ALTER TABLE price_books
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Availability mode: 'all_catalog' (default) or 'explicit_only'
-- - all_catalog: All SKUs available, this price book only contains price overrides
-- - explicit_only: Only SKUs explicitly added to this price book are available
ALTER TABLE price_books
  ADD COLUMN IF NOT EXISTS availability_mode TEXT DEFAULT 'all_catalog'
  CHECK (availability_mode IN ('all_catalog', 'explicit_only'));

COMMENT ON COLUMN price_books.tags IS
  'Tags for organizing price books, e.g., large-builders, austin, wood-only';

COMMENT ON COLUMN price_books.availability_mode IS
  'all_catalog: All SKUs available with price overrides. explicit_only: Only listed SKUs available.';

-- ============================================
-- PART 4: ADD NEW COLUMNS TO PRICE_BOOK_ITEMS
-- ============================================

-- Featured flag for price list generation
ALTER TABLE price_book_items
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

COMMENT ON COLUMN price_book_items.is_featured IS
  'Featured SKUs appear on generated price lists and are prioritized in SKU picker';

-- Index for featured items
CREATE INDEX IF NOT EXISTS idx_price_book_items_featured
  ON price_book_items(price_book_id, is_featured) WHERE is_featured = true;

-- ============================================
-- PART 5: INDEX FOR TAGS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_price_books_tags
  ON price_books USING GIN(tags);

-- ============================================
-- PART 6: UPDATE REFERENCES IN OTHER TABLES
-- ============================================

-- Update clients.default_rate_sheet_id column name to default_price_book_id
-- Check if column exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'default_rate_sheet_id'
  ) THEN
    ALTER TABLE clients RENAME COLUMN default_rate_sheet_id TO default_price_book_id;
  END IF;
END $$;

-- Update communities.rate_sheet_id column name to price_book_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'rate_sheet_id'
  ) THEN
    ALTER TABLE communities RENAME COLUMN rate_sheet_id TO price_book_id;
  END IF;
END $$;

-- Update qbo_classes.default_rate_sheet_id to default_price_book_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qbo_classes' AND column_name = 'default_rate_sheet_id'
  ) THEN
    ALTER TABLE qbo_classes RENAME COLUMN default_rate_sheet_id TO default_price_book_id;
  END IF;
END $$;

-- ============================================
-- PART 7: UPDATE get_resolved_price FUNCTION
-- ============================================

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS get_resolved_price(UUID, DECIMAL, UUID, UUID, VARCHAR(50));

-- Create function with new column names
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
  price_book_id UUID,
  price_book_name TEXT
) AS $$
DECLARE
  v_community_price DECIMAL(10,2);
  v_price_book_id UUID;
  v_price_book_name TEXT;
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

  -- Step 2: Find effective price book (community → client → BU)
  -- Check community price book
  IF p_community_id IS NOT NULL THEN
    SELECT c.price_book_id, c.client_id INTO v_price_book_id, v_client_id
    FROM communities c WHERE c.id = p_community_id;

    IF v_price_book_id IS NOT NULL THEN
      v_source := 'Community Price Book';
    END IF;
  END IF;

  -- Fall back to client price book
  IF v_price_book_id IS NULL AND (p_client_id IS NOT NULL OR v_client_id IS NOT NULL) THEN
    SELECT cl.default_price_book_id INTO v_price_book_id
    FROM clients cl WHERE cl.id = COALESCE(p_client_id, v_client_id);

    IF v_price_book_id IS NOT NULL THEN
      v_source := 'Client Price Book';
    END IF;
  END IF;

  -- Fall back to BU default price book
  IF v_price_book_id IS NULL AND p_qbo_class_id IS NOT NULL THEN
    SELECT qc.default_price_book_id INTO v_price_book_id
    FROM qbo_classes qc WHERE qc.id = p_qbo_class_id;

    IF v_price_book_id IS NOT NULL THEN
      v_source := 'BU Default Price Book';
    END IF;
  END IF;

  -- Step 3: Get price book name
  IF v_price_book_id IS NOT NULL THEN
    SELECT pb.name INTO v_price_book_name
    FROM price_books pb WHERE pb.id = v_price_book_id;
  END IF;

  -- Step 4: Get price from price book
  IF v_price_book_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      pbp.price,
      pbp.labor_price,
      pbp.material_price,
      pbp.pricing_method::VARCHAR(30),
      v_source,
      v_price_book_id,
      v_price_book_name
    FROM get_price_book_price(v_price_book_id, p_sku_id, p_base_cost) pbp;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Step 5: No price book or no price - return cost
  RETURN QUERY SELECT
    p_base_cost,
    NULL::DECIMAL(10,2),
    NULL::DECIMAL(10,2),
    'cost_only'::VARCHAR(30),
    'No Price Book'::VARCHAR(50),
    NULL::UUID,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 8: CREATE get_price_book_price FUNCTION
-- ============================================

-- Drop old function name if exists
DROP FUNCTION IF EXISTS get_rate_sheet_price(UUID, UUID, DECIMAL);

-- Create the new function
CREATE OR REPLACE FUNCTION get_price_book_price(
  p_price_book_id UUID,
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
  v_price_book RECORD;
  v_calculated_price DECIMAL(10,2);
BEGIN
  -- Get price book defaults
  SELECT * INTO v_price_book
  FROM price_books WHERE id = p_price_book_id;

  -- Get specific item pricing
  SELECT * INTO v_item
  FROM price_book_items
  WHERE price_book_id = p_price_book_id AND sku_id = p_sku_id;

  -- If no specific item, check if we should use defaults
  IF v_item IS NULL THEN
    -- No item found, use defaults if price book is formula type
    IF v_price_book.pricing_type IN ('formula', 'hybrid') THEN
      -- Calculate from defaults
      v_calculated_price := p_base_cost * (1 + COALESCE(v_price_book.default_material_markup, 0) / 100);

      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'default_markup'::TEXT;
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
      v_calculated_price := p_base_cost * (1 + COALESCE(v_item.material_markup_percent, v_price_book.default_material_markup, 0) / 100);
      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'markup'::TEXT;

    WHEN 'margin' THEN
      -- Calculate from target margin: price = cost / (1 - margin)
      IF COALESCE(v_item.margin_target_percent, v_price_book.default_margin_target) IS NOT NULL
         AND COALESCE(v_item.margin_target_percent, v_price_book.default_margin_target) < 100 THEN
        v_calculated_price := p_base_cost / (1 - COALESCE(v_item.margin_target_percent, v_price_book.default_margin_target, 0) / 100);
      ELSE
        v_calculated_price := p_base_cost;
      END IF;
      RETURN QUERY SELECT
        v_calculated_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        'margin'::TEXT;

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

COMMENT ON FUNCTION get_price_book_price IS
  'Calculate effective price for a SKU from a price book, applying pricing rules';

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
  -- Price book info (renamed from rate sheet)
  c.price_book_id AS community_price_book_id,
  pb_c.name AS community_price_book_name,
  cl.default_price_book_id AS client_price_book_id,
  pb_cl.name AS client_price_book_name,
  -- Effective price book
  COALESCE(c.price_book_id, cl.default_price_book_id) AS effective_price_book_id,
  COALESCE(pb_c.name, pb_cl.name) AS effective_price_book_name
FROM communities c
LEFT JOIN clients cl ON cl.id = c.client_id
LEFT JOIN price_books pb_c ON pb_c.id = c.price_book_id
LEFT JOIN price_books pb_cl ON pb_cl.id = cl.default_price_book_id;

COMMENT ON VIEW v_community_products_summary IS
  'Summary view of communities with product counts and price book inheritance';

-- ============================================
-- PART 10: LOG COMPLETION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 232: Renamed Rate Sheets to Price Books';
  RAISE NOTICE 'Tables renamed: rate_sheets -> price_books, rate_sheet_items -> price_book_items, rate_sheet_assignments -> price_book_assignments';
  RAISE NOTICE 'New columns added: tags[], availability_mode, is_featured';
  RAISE NOTICE 'FK columns renamed: rate_sheet_id -> price_book_id in clients, communities, qbo_classes';
END $$;
