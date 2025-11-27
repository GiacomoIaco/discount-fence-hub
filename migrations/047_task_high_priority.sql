-- Migration: Add is_high_priority flag to tasks
-- This allows marking tasks as high priority with a visual indicator

-- Add the is_high_priority column to project_tasks
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS is_high_priority boolean DEFAULT false;

-- Add index for filtering high priority tasks
CREATE INDEX IF NOT EXISTS idx_project_tasks_high_priority
ON project_tasks(is_high_priority)
WHERE is_high_priority = true;

-- Comment for documentation
COMMENT ON COLUMN project_tasks.is_high_priority IS 'Marks a task as high priority, shown with a red indicator in the UI';
