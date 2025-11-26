-- ============================================
-- TASK OWNERSHIP AND COMMENTS
-- Created: 2025-11-26
-- Purpose: Add explicit owner to tasks and task-level comments
-- ============================================

-- ============================================
-- 1. ADD OWNER TO TASKS
-- ============================================

-- Add owner_id column (defaults to created_by for existing tasks)
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id);

-- Set owner_id to created_by for existing tasks
UPDATE project_tasks
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Create index for owner queries
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON project_tasks(owner_id);

-- ============================================
-- 2. CREATE TASK COMMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task comments
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created ON task_comments(created_at DESC);

-- ============================================
-- 3. ROW LEVEL SECURITY FOR TASK COMMENTS
-- ============================================

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can view comments on tasks they can see
CREATE POLICY select_task_comments ON task_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_tasks pt
      WHERE pt.id = task_comments.task_id
    )
  );

-- Users can insert their own comments
CREATE POLICY insert_task_comments ON task_comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own comments
CREATE POLICY update_task_comments ON task_comments
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY delete_task_comments ON task_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 4. COMMENTS
-- ============================================

COMMENT ON COLUMN project_tasks.owner_id IS 'Task owner - can edit all fields, assign others, delete. Defaults to creator.';
COMMENT ON TABLE task_comments IS 'Discussion thread for tasks - allows back-and-forth comments with timestamps';
