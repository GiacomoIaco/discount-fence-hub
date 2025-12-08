-- ============================================
-- Migration 112: SKU Archive Feature (O-025)
-- ============================================
-- Adds archived_at timestamp to product_skus table
-- Archived SKUs are hidden from BOM Calculator dropdowns
-- but remain visible in SKU Catalog when filter is enabled

-- Add archived_at column
ALTER TABLE product_skus
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN product_skus.archived_at IS 'When set, SKU is archived and hidden from calculator dropdowns. Can be restored by clearing this field.';

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_product_skus_archived ON product_skus(archived_at) WHERE archived_at IS NULL;

-- Update the existing partial index to include archived check
DROP INDEX IF EXISTS idx_product_skus_active;
CREATE INDEX idx_product_skus_active ON product_skus(is_active) WHERE is_active = true AND archived_at IS NULL;
