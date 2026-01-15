-- ============================================
-- Migration 234: Create Price Books Tables
-- ============================================
-- Price Books = Product Catalogs (WHAT can they buy)
-- Separate from Rate Sheets (HOW MUCH do they pay)
--
-- A client gets assigned Price Book + Rate Sheet pairs.
-- ============================================

-- ============================================
-- PART 1: CREATE PRICE BOOKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS price_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_books_name ON price_books(name);
CREATE INDEX IF NOT EXISTS idx_price_books_tags ON price_books USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_price_books_active ON price_books(is_active);

-- RLS
ALTER TABLE price_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_books_select" ON price_books
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "price_books_insert" ON price_books
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "price_books_update" ON price_books
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "price_books_delete" ON price_books
  FOR DELETE TO authenticated
  USING (true);

COMMENT ON TABLE price_books IS 'Product catalogs - defines WHICH SKUs a client can purchase';
COMMENT ON COLUMN price_books.tags IS 'Tags for organization: builders, fence, deck, austin, etc.';

-- ============================================
-- PART 2: CREATE PRICE BOOK ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS price_book_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES sku_catalog(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(price_book_id, sku_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_book_items_price_book ON price_book_items(price_book_id);
CREATE INDEX IF NOT EXISTS idx_price_book_items_sku ON price_book_items(sku_id);
CREATE INDEX IF NOT EXISTS idx_price_book_items_featured ON price_book_items(price_book_id, is_featured) WHERE is_featured = true;

-- RLS
ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_book_items_select" ON price_book_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "price_book_items_insert" ON price_book_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "price_book_items_update" ON price_book_items
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "price_book_items_delete" ON price_book_items
  FOR DELETE TO authenticated
  USING (true);

COMMENT ON TABLE price_book_items IS 'SKUs included in each price book (product catalog)';
COMMENT ON COLUMN price_book_items.is_featured IS 'Mark priority SKUs for client-facing price lists';
COMMENT ON COLUMN price_book_items.sort_order IS 'Custom ordering within the price book';

-- ============================================
-- PART 3: CREATE CLIENT PRICE BOOK ASSIGNMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS client_price_book_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
  rate_sheet_id UUID REFERENCES rate_sheets(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  effective_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(client_id, price_book_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_client ON client_price_book_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_pb ON client_price_book_assignments(price_book_id);
CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_rs ON client_price_book_assignments(rate_sheet_id);

-- RLS
ALTER TABLE client_price_book_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_pb_assignments_select" ON client_price_book_assignments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "client_pb_assignments_insert" ON client_price_book_assignments
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "client_pb_assignments_update" ON client_price_book_assignments
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "client_pb_assignments_delete" ON client_price_book_assignments
  FOR DELETE TO authenticated
  USING (true);

COMMENT ON TABLE client_price_book_assignments IS 'Links clients to Price Book + Rate Sheet combinations';
COMMENT ON COLUMN client_price_book_assignments.rate_sheet_id IS 'NULL means use BU default rate sheet';
COMMENT ON COLUMN client_price_book_assignments.is_default IS 'If client has multiple assignments, which is primary?';

-- ============================================
-- PART 4: ADD DEFAULT PRICE BOOK TO QBO CLASSES
-- ============================================

ALTER TABLE qbo_classes
  ADD COLUMN IF NOT EXISTS default_price_book_id UUID REFERENCES price_books(id);

COMMENT ON COLUMN qbo_classes.default_price_book_id IS 'Default product catalog for this BU (optional)';

-- ============================================
-- PART 5: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get available SKUs for a client/community
CREATE OR REPLACE FUNCTION get_client_available_skus(
  p_client_id UUID,
  p_community_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sku_id UUID,
  sku_code TEXT,
  description TEXT,
  unit TEXT,
  sell_price DECIMAL(10,2),
  is_featured BOOLEAN,
  sort_order INT,
  source TEXT
) AS $$
DECLARE
  v_has_assignments BOOLEAN;
BEGIN
  -- Check if client has any price book assignments
  SELECT EXISTS (
    SELECT 1 FROM client_price_book_assignments
    WHERE client_id = p_client_id
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  ) INTO v_has_assignments;

  IF v_has_assignments THEN
    -- Return SKUs from assigned price books
    RETURN QUERY
    SELECT DISTINCT ON (sc.id)
      sc.id AS sku_id,
      sc.sku AS sku_code,
      sc.description,
      sc.unit,
      sc.sell_price,
      pbi.is_featured,
      pbi.sort_order,
      'price_book'::TEXT AS source
    FROM client_price_book_assignments cpba
    JOIN price_book_items pbi ON pbi.price_book_id = cpba.price_book_id
    JOIN sku_catalog sc ON sc.id = pbi.sku_id
    WHERE cpba.client_id = p_client_id
    AND (cpba.expires_at IS NULL OR cpba.expires_at >= CURRENT_DATE)
    AND sc.is_active = true
    ORDER BY sc.id, pbi.is_featured DESC, pbi.sort_order;
  ELSE
    -- No assignments = full catalog access
    RETURN QUERY
    SELECT
      sc.id AS sku_id,
      sc.sku AS sku_code,
      sc.description,
      sc.unit,
      sc.sell_price,
      false AS is_featured,
      0 AS sort_order,
      'full_catalog'::TEXT AS source
    FROM sku_catalog sc
    WHERE sc.is_active = true
    ORDER BY sc.sku;
  END IF;

  -- If community has products, further filter
  IF p_community_id IS NOT NULL THEN
    -- Check if community has restricted SKUs
    IF EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = p_community_id AND c.restrict_skus = true
    ) THEN
      -- Only return SKUs that are in community_products
      RETURN QUERY
      SELECT DISTINCT ON (sc.id)
        sc.id AS sku_id,
        sc.sku AS sku_code,
        COALESCE(cp.custom_description, sc.description) AS description,
        sc.unit,
        COALESCE(cp.price_override, sc.sell_price) AS sell_price,
        COALESCE(cp.is_featured, false) AS is_featured,
        COALESCE(cp.sort_order, 0) AS sort_order,
        'community_filtered'::TEXT AS source
      FROM community_products cp
      JOIN sku_catalog sc ON sc.id = cp.sku_id
      WHERE cp.community_id = p_community_id
      AND sc.is_active = true
      ORDER BY sc.id, cp.is_featured DESC, cp.sort_order;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_client_available_skus IS
  'Get available SKUs for a client, optionally filtered by community restrictions';

-- ============================================
-- PART 6: CREATE SUMMARY VIEW
-- ============================================

CREATE OR REPLACE VIEW v_price_books_summary AS
SELECT
  pb.id,
  pb.name,
  pb.code,
  pb.description,
  pb.tags,
  pb.is_active,
  pb.created_at,
  -- Item counts
  COUNT(DISTINCT pbi.id) AS items_count,
  COUNT(DISTINCT pbi.id) FILTER (WHERE pbi.is_featured) AS featured_count,
  -- Assignment counts
  COUNT(DISTINCT cpba.client_id) AS assigned_clients_count,
  -- Sample assignments
  ARRAY_AGG(DISTINCT c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL) AS assigned_client_names
FROM price_books pb
LEFT JOIN price_book_items pbi ON pbi.price_book_id = pb.id
LEFT JOIN client_price_book_assignments cpba ON cpba.price_book_id = pb.id
LEFT JOIN clients c ON c.id = cpba.client_id
GROUP BY pb.id, pb.name, pb.code, pb.description, pb.tags, pb.is_active, pb.created_at;

COMMENT ON VIEW v_price_books_summary IS
  'Price books with item counts and assignment info';

-- ============================================
-- PART 7: LOG COMPLETION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 234: Created Price Books tables';
  RAISE NOTICE 'Tables created: price_books, price_book_items, client_price_book_assignments';
  RAISE NOTICE 'Added qbo_classes.default_price_book_id';
  RAISE NOTICE 'Created get_client_available_skus function';
  RAISE NOTICE 'Created v_price_books_summary view';
END $$;
