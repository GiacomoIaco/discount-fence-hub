-- ============================================
-- TASK MULTIPLE ASSIGNEES SUPPORT
-- Created: 2025-11-25
-- Purpose: Add multiple assignees to tasks (project_tasks table)
--
-- Tasks are simple to-do items with:
--   - title, status, due_date, description/notes
--   - Multiple assignees (via this junction table)
-- ============================================

-- Add created_by column to tasks (for "created by me" queries)
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

-- Add notes field for task comments/notes
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for created_by queries
CREATE INDEX IF NOT EXISTS idx_tasks_created_by
ON project_tasks(created_by);

-- Create junction table for multiple assignees per task
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES user_profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_assignees_task
ON task_assignees(task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user
ON task_assignees(user_id);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Users can view assignees for tasks they have access to
CREATE POLICY "Users can view task assignees"
ON task_assignees FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_tasks t
    JOIN project_initiatives pi ON pi.id = t.initiative_id
    WHERE t.id = task_assignees.task_id
    AND (
      -- Admin can see everything
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
      )
      OR
      -- User created the task's initiative
      pi.created_by = auth.uid()
      OR
      -- User is assigned to the initiative
      pi.assigned_to = auth.uid()
      OR
      -- User is an assignee of this task
      EXISTS (
        SELECT 1 FROM task_assignees ta2
        WHERE ta2.task_id = t.id
        AND ta2.user_id = auth.uid()
      )
      OR
      -- User has function access (non-private initiatives)
      (
        (pi.is_private IS NULL OR pi.is_private = false)
        AND EXISTS (
          SELECT 1 FROM project_areas
          JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
          WHERE project_areas.id = pi.area_id
          AND project_function_access.user_id = auth.uid()
        )
      )
    )
  )
);

-- Users can add assignees to tasks they can edit
CREATE POLICY "Users can add task assignees"
ON task_assignees FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_tasks t
    JOIN project_initiatives pi ON pi.id = t.initiative_id
    WHERE t.id = task_assignees.task_id
    AND (
      -- Admin can edit anything
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
      )
      OR
      -- User created the initiative
      pi.created_by = auth.uid()
      OR
      -- User is assigned to the initiative
      pi.assigned_to = auth.uid()
    )
  )
);

-- Users can remove assignees from tasks they can edit
CREATE POLICY "Users can remove task assignees"
ON task_assignees FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM project_tasks t
    JOIN project_initiatives pi ON pi.id = t.initiative_id
    WHERE t.id = task_assignees.task_id
    AND (
      -- Admin can edit anything
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
      )
      OR
      -- User created the initiative
      pi.created_by = auth.uid()
      OR
      -- User is removing themselves
      task_assignees.user_id = auth.uid()
    )
  )
);

-- ============================================
-- MIGRATE EXISTING assigned_to TO task_assignees
-- Preserve existing single assignments in the new junction table
-- ============================================

INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at)
SELECT
  id as task_id,
  assigned_to as user_id,
  NULL as assigned_by,  -- We don't know who assigned originally
  created_at as assigned_at
FROM project_tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE task_assignees IS 'Junction table for multiple assignees per task';
