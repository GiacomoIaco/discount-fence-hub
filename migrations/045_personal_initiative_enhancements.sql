-- ============================================
-- PERSONAL INITIATIVE ENHANCEMENTS
-- Created: 2025-11-26
-- Purpose: Add private flag, header color, and sort order for personal initiatives
-- ============================================

-- Add private flag for initiatives (only visible to the owner)
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Add custom header color for initiatives
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS header_color VARCHAR(50) DEFAULT NULL;

-- Add sort order for drag-drop reordering
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Also add sort_order to tasks if not exists
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for personal initiatives sorting
CREATE INDEX IF NOT EXISTS idx_initiatives_personal_sort
ON project_initiatives(created_by, is_personal, sort_order)
WHERE is_personal = true;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN project_initiatives.is_private IS 'If true, this initiative is only visible to its creator (not shared with team)';
COMMENT ON COLUMN project_initiatives.header_color IS 'Custom color for the initiative header (e.g., blue-600, green-600)';
COMMENT ON COLUMN project_initiatives.sort_order IS 'Order for drag-drop sorting in My To-Dos';
