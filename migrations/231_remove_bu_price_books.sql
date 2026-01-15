-- ============================================
-- Migration 231: Remove BU Price Books Architecture
-- ============================================
-- Part of Price Books Redesign Phase 1
--
-- The bu_price_books system auto-created 19 price books (one per BU)
-- which was confusing and unmanageable. The new architecture merges
-- Rate Sheets into Price Books (user-created, not auto-created per BU).
--
-- This migration:
-- 1. Drops the v_bu_price_book_summary view
-- 2. Drops the bu_price_book_overrides table
-- 3. Drops the bu_price_books table
-- 4. Drops the get_available_skus function (will be recreated with new logic)
-- 5. Keeps the sku_catalog_v2.bu_types_allowed column (still useful)
-- ============================================

-- Drop the view first (depends on bu_price_books)
DROP VIEW IF EXISTS v_bu_price_book_summary;

-- Drop the function that depends on bu_price_books
DROP FUNCTION IF EXISTS get_available_skus(VARCHAR(50), UUID);

-- Drop the overrides table (FK to bu_price_books)
DROP TABLE IF EXISTS bu_price_book_overrides;

-- Drop the main table
DROP TABLE IF EXISTS bu_price_books;

-- Note: We keep:
-- - sku_catalog_v2.bu_types_allowed (default BU visibility is still useful)
-- - community_products table (still part of new architecture)
-- - get_resolved_price function (works with rate_sheets, will be updated in Phase 2)

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 231: Removed bu_price_books architecture';
  RAISE NOTICE 'Tables dropped: bu_price_books, bu_price_book_overrides';
  RAISE NOTICE 'Views dropped: v_bu_price_book_summary';
  RAISE NOTICE 'Functions dropped: get_available_skus';
END $$;
