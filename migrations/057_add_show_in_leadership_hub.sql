-- ============================================
-- Migration 057: Add show_in_leadership_hub Flag
-- Created: 2025-11-30
-- Purpose: Control whether organizational initiatives appear in Leadership Hub
--          Function Members create initiatives with this FALSE (only in My Todos)
--          Function Owners create initiatives with this TRUE (visible in both)
-- ============================================

-- Add show_in_leadership_hub column
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS show_in_leadership_hub BOOLEAN DEFAULT TRUE;

-- ============================================
-- Data Migration: Set appropriate values for existing initiatives
-- ============================================

-- Personal initiatives (area_id IS NULL) should never show in Leadership Hub
UPDATE project_initiatives
SET show_in_leadership_hub = FALSE
WHERE area_id IS NULL;

-- Initiatives marked as is_personal should not show in Leadership Hub
UPDATE project_initiatives
SET show_in_leadership_hub = FALSE
WHERE is_personal = TRUE;

-- Initiatives marked as is_private should not show in Leadership Hub
UPDATE project_initiatives
SET show_in_leadership_hub = FALSE
WHERE is_private = TRUE;

-- All other organizational initiatives (area_id IS NOT NULL) default to TRUE
-- which is already the default, but let's be explicit
UPDATE project_initiatives
SET show_in_leadership_hub = TRUE
WHERE area_id IS NOT NULL
  AND (is_personal IS NULL OR is_personal = FALSE)
  AND (is_private IS NULL OR is_private = FALSE)
  AND show_in_leadership_hub IS NULL;

-- ============================================
-- Create index for Leadership Hub queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_initiatives_leadership_hub
ON project_initiatives(area_id, show_in_leadership_hub)
WHERE show_in_leadership_hub = TRUE AND archived_at IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN project_initiatives.show_in_leadership_hub IS 'If TRUE, this organizational initiative appears in Leadership Hub. Function Members create with FALSE (My Todos only), Function Owners create with TRUE.';

-- ============================================
-- NOTE: is_personal and is_private are now deprecated
-- Their logic is replaced by:
--   - area_id IS NULL = personal initiative
--   - show_in_leadership_hub = FALSE = not visible in Leadership Hub
-- These columns will be removed in a future migration after verification
-- ============================================
