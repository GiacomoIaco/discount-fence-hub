-- ============================================
-- Migration 117: Fix Wood Vertical Product Styles
-- ============================================
-- Fixes style values that were incorrectly set in migration 116:
-- 1. 'cap-and-trim' -> 'standard' (C&T is a component option, not a style)
-- 2. 'good-neighbor' -> 'good-neighbor-builder' (correct style name)
-- 3. 'Standard' -> 'standard' (normalize case)

-- Fix 'cap-and-trim' -> 'standard'
-- These SKUs have cap and trim materials but use the standard formula
UPDATE wood_vertical_products
SET style = 'standard'
WHERE style = 'cap-and-trim';

-- Fix 'good-neighbor' -> 'good-neighbor-builder'
-- The data source uses 'good-neighbor-builder' as the correct value
UPDATE wood_vertical_products
SET style = 'good-neighbor-builder'
WHERE style = 'good-neighbor';

-- Normalize 'Standard' to 'standard' (case consistency)
UPDATE wood_vertical_products
SET style = 'standard'
WHERE style = 'Standard';

-- Normalize 'Good Neighbor' to 'good-neighbor-builder' (old format)
UPDATE wood_vertical_products
SET style = 'good-neighbor-builder'
WHERE style = 'Good Neighbor';

-- Normalize 'Board-on-Board' to 'board-on-board' (case consistency)
UPDATE wood_vertical_products
SET style = 'board-on-board'
WHERE style = 'Board-on-Board';
