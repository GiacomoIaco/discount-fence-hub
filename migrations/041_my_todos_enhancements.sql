-- ============================================
-- MY TO-DOS / PROJECT MANAGEMENT ENHANCEMENTS
-- Created: 2025-11-25
-- Purpose: Add fields to support personal task management view
-- Features: assigned_by tracking, private initiatives, personal ordering
-- ============================================

-- ============================================
-- ADD NEW COLUMNS TO project_initiatives
-- ============================================

-- Add assigned_by: track who assigned the task (may be different from created_by)
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES user_profiles(id);

-- Add is_private: for private initiatives visible only to creator
-- Private initiatives are visible to: creator, assigned_to, assigned_by
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Add user_display_order: for personal ordering in "My To-Dos" view
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS user_display_order INTEGER DEFAULT 0;

-- ============================================
-- ADD INDEX FOR EFFICIENT QUERIES
-- ============================================

-- Index for finding tasks assigned by a user
CREATE INDEX IF NOT EXISTS idx_initiatives_assigned_by
ON project_initiatives(assigned_by)
WHERE assigned_by IS NOT NULL;

-- Index for filtering private initiatives
CREATE INDEX IF NOT EXISTS idx_initiatives_is_private
ON project_initiatives(is_private)
WHERE is_private = true;

-- Composite index for "My To-Dos" queries (find tasks where user is creator, assignee, or assigner)
CREATE INDEX IF NOT EXISTS idx_initiatives_my_todos_created
ON project_initiatives(created_by, user_display_order)
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_initiatives_my_todos_assigned
ON project_initiatives(assigned_to, user_display_order)
WHERE archived_at IS NULL;

-- ============================================
-- UPDATE RLS POLICIES FOR PRIVATE INITIATIVES
-- ============================================

-- Drop existing select policy and recreate with private initiative logic
DROP POLICY IF EXISTS "Users can view initiatives in their functions" ON project_initiatives;

CREATE POLICY "Users can view initiatives in their functions" ON project_initiatives
  FOR SELECT USING (
    -- Admin can see everything
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    -- User is the creator
    created_by = auth.uid()
    OR
    -- User is assigned to the initiative
    assigned_to = auth.uid()
    OR
    -- User is the one who assigned it
    assigned_by = auth.uid()
    OR
    -- Non-private initiatives: users with function access can see them
    (
      (is_private IS NULL OR is_private = false)
      AND EXISTS (
        SELECT 1 FROM project_buckets
        JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
        WHERE project_buckets.id = project_initiatives.bucket_id
        AND project_function_access.user_id = auth.uid()
      )
    )
  );

-- ============================================
-- FUNCTION TO SET assigned_by AUTOMATICALLY
-- ============================================

CREATE OR REPLACE FUNCTION set_initiative_assigned_by()
RETURNS TRIGGER AS $$
BEGIN
  -- When assigned_to changes and assigned_by is not explicitly set,
  -- set assigned_by to the current user
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- Only set assigned_by if it's not already set for this assignment
    IF NEW.assigned_by IS NULL OR OLD.assigned_to IS NOT NULL THEN
      NEW.assigned_by := auth.uid();
    END IF;
  END IF;

  -- For new initiatives with an assignee, set assigned_by to creator if not specified
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL AND NEW.assigned_by IS NULL THEN
    NEW.assigned_by := NEW.created_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-setting assigned_by
DROP TRIGGER IF EXISTS trigger_set_initiative_assigned_by ON project_initiatives;
CREATE TRIGGER trigger_set_initiative_assigned_by
  BEFORE INSERT OR UPDATE ON project_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION set_initiative_assigned_by();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN project_initiatives.assigned_by IS 'User who assigned this initiative to assigned_to';
COMMENT ON COLUMN project_initiatives.is_private IS 'If true, only visible to creator, assignee, and assigner';
COMMENT ON COLUMN project_initiatives.user_display_order IS 'User-specific ordering for My To-Dos view';
