-- ============================================
-- SKU IMPORT & STATUS TRACKING
-- Created: 2025-12-04
-- Purpose: Add status tracking for SKU import workflow
-- ============================================

-- ============================================
-- ADD STATUS FIELDS TO PRODUCT TABLES
-- ============================================

-- Wood Vertical Products
ALTER TABLE wood_vertical_products
ADD COLUMN IF NOT EXISTS sku_status TEXT DEFAULT 'complete' CHECK (sku_status IN ('draft', 'complete', 'archived')),
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Wood Horizontal Products
ALTER TABLE wood_horizontal_products
ADD COLUMN IF NOT EXISTS sku_status TEXT DEFAULT 'complete' CHECK (sku_status IN ('draft', 'complete', 'archived')),
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Iron Products
ALTER TABLE iron_products
ADD COLUMN IF NOT EXISTS sku_status TEXT DEFAULT 'complete' CHECK (sku_status IN ('draft', 'complete', 'archived')),
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Custom Products
ALTER TABLE custom_products
ADD COLUMN IF NOT EXISTS sku_status TEXT DEFAULT 'complete' CHECK (sku_status IN ('draft', 'complete', 'archived')),
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS populated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- ============================================
-- SET EXISTING PRODUCTS TO COMPLETE
-- ============================================

UPDATE wood_vertical_products SET sku_status = 'complete' WHERE sku_status IS NULL;
UPDATE wood_horizontal_products SET sku_status = 'complete' WHERE sku_status IS NULL;
UPDATE iron_products SET sku_status = 'complete' WHERE sku_status IS NULL;
UPDATE custom_products SET sku_status = 'complete' WHERE sku_status IS NULL;

-- ============================================
-- INDEXES FOR QUEUE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_wood_vertical_sku_status ON wood_vertical_products(sku_status) WHERE sku_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_wood_horizontal_sku_status ON wood_horizontal_products(sku_status) WHERE sku_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_iron_sku_status ON iron_products(sku_status) WHERE sku_status = 'draft';
CREATE INDEX IF NOT EXISTS idx_custom_sku_status ON custom_products(sku_status) WHERE sku_status = 'draft';

-- ============================================
-- SKU IMPORT BATCHES (for tracking imports)
-- ============================================

CREATE TABLE IF NOT EXISTS sku_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_name TEXT NOT NULL,
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  total_count INTEGER DEFAULT 0,
  draft_count INTEGER DEFAULT 0,
  complete_count INTEGER DEFAULT 0,
  source_file TEXT,
  notes TEXT
);

-- RLS for import batches
ALTER TABLE sku_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view import batches"
  ON sku_import_batches FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert import batches"
  ON sku_import_batches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update import batches"
  ON sku_import_batches FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================
-- VIEW: All SKUs with status (for queue)
-- ============================================

CREATE OR REPLACE VIEW all_skus_queue AS
SELECT
  id,
  sku_code,
  sku_name,
  'wood_vertical' as sku_type,
  sku_status,
  imported_at,
  populated_at,
  populated_by,
  import_notes,
  is_active,
  created_at
FROM wood_vertical_products
UNION ALL
SELECT
  id,
  sku_code,
  sku_name,
  'wood_horizontal' as sku_type,
  sku_status,
  imported_at,
  populated_at,
  populated_by,
  import_notes,
  is_active,
  created_at
FROM wood_horizontal_products
UNION ALL
SELECT
  id,
  sku_code,
  sku_name,
  'iron' as sku_type,
  sku_status,
  imported_at,
  populated_at,
  populated_by,
  import_notes,
  is_active,
  created_at
FROM iron_products
UNION ALL
SELECT
  id,
  sku_code,
  sku_name,
  'custom' as sku_type,
  sku_status,
  imported_at,
  populated_at,
  populated_by,
  import_notes,
  is_active,
  created_at
FROM custom_products;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN wood_vertical_products.sku_status IS 'draft = imported but not configured, complete = fully configured, archived = no longer active';
COMMENT ON COLUMN wood_vertical_products.imported_at IS 'When this SKU was imported from external system';
COMMENT ON COLUMN wood_vertical_products.populated_at IS 'When materials/labor were configured';
COMMENT ON COLUMN wood_vertical_products.populated_by IS 'User who configured the materials/labor';
COMMENT ON VIEW all_skus_queue IS 'Combined view of all SKU types for the population queue';
