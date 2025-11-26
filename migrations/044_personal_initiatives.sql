-- ============================================
-- PERSONAL INITIATIVES FOR MY TO-DOS
-- Created: 2025-11-25
-- Purpose: Allow creating initiatives without an area for personal to-dos
-- ============================================

-- Make area_id nullable for personal initiatives
ALTER TABLE project_initiatives
ALTER COLUMN area_id DROP NOT NULL;

-- Add flag to mark personal initiatives (only visible in My To-Dos)
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;

-- Create index for personal initiatives queries
CREATE INDEX IF NOT EXISTS idx_initiatives_personal
ON project_initiatives(created_by, is_personal)
WHERE is_personal = true;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN project_initiatives.is_personal IS 'If true, this is a personal initiative only visible in My To-Dos (not in Leadership Hub)';
