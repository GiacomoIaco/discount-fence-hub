-- Migration 234a: Create Price Books Tables (Part 1 - Tables only)

-- PART 1: CREATE PRICE BOOKS TABLE
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

DROP POLICY IF EXISTS "price_books_select" ON price_books;
CREATE POLICY "price_books_select" ON price_books FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "price_books_insert" ON price_books;
CREATE POLICY "price_books_insert" ON price_books FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "price_books_update" ON price_books;
CREATE POLICY "price_books_update" ON price_books FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "price_books_delete" ON price_books;
CREATE POLICY "price_books_delete" ON price_books FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE price_books IS 'Product catalogs - defines WHICH SKUs a client can purchase';
COMMENT ON COLUMN price_books.tags IS 'Tags for organization: builders, fence, deck, austin, etc.';

-- PART 2: CREATE PRICE BOOK ITEMS TABLE
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

CREATE INDEX IF NOT EXISTS idx_price_book_items_price_book ON price_book_items(price_book_id);
CREATE INDEX IF NOT EXISTS idx_price_book_items_sku ON price_book_items(sku_id);

ALTER TABLE price_book_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_book_items_select" ON price_book_items;
CREATE POLICY "price_book_items_select" ON price_book_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "price_book_items_insert" ON price_book_items;
CREATE POLICY "price_book_items_insert" ON price_book_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "price_book_items_update" ON price_book_items;
CREATE POLICY "price_book_items_update" ON price_book_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "price_book_items_delete" ON price_book_items;
CREATE POLICY "price_book_items_delete" ON price_book_items FOR DELETE TO authenticated USING (true);

-- PART 3: CREATE CLIENT PRICE BOOK ASSIGNMENTS
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

CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_client ON client_price_book_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_pb ON client_price_book_assignments(price_book_id);
CREATE INDEX IF NOT EXISTS idx_client_pb_assignments_rs ON client_price_book_assignments(rate_sheet_id);

ALTER TABLE client_price_book_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_pb_assignments_select" ON client_price_book_assignments;
CREATE POLICY "client_pb_assignments_select" ON client_price_book_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_pb_assignments_insert" ON client_price_book_assignments;
CREATE POLICY "client_pb_assignments_insert" ON client_price_book_assignments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "client_pb_assignments_update" ON client_price_book_assignments;
CREATE POLICY "client_pb_assignments_update" ON client_price_book_assignments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "client_pb_assignments_delete" ON client_price_book_assignments;
CREATE POLICY "client_pb_assignments_delete" ON client_price_book_assignments FOR DELETE TO authenticated USING (true);

-- PART 4: ADD DEFAULT PRICE BOOK TO QBO CLASSES
ALTER TABLE qbo_classes ADD COLUMN IF NOT EXISTS default_price_book_id UUID REFERENCES price_books(id);
