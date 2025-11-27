-- Migration: Consolidate task assignees
-- This migration ensures task_assignees is the single source of truth for task assignments
-- by migrating any assigned_to values that don't have a corresponding task_assignees entry

-- Insert missing assignees from assigned_to into task_assignees
INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at)
SELECT
  pt.id as task_id,
  pt.assigned_to as user_id,
  pt.created_by as assigned_by,
  pt.created_at as assigned_at
FROM project_tasks pt
WHERE pt.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM task_assignees ta
    WHERE ta.task_id = pt.id AND ta.user_id = pt.assigned_to
  );

-- Add a comment to document that assigned_to is deprecated
COMMENT ON COLUMN project_tasks.assigned_to IS 'DEPRECATED: Use task_assignees table instead. Kept for backward compatibility.';
