-- Migration: Fix task_assignees RLS infinite recursion
-- Issue: Self-referencing policies cause infinite recursion
-- Solution: Use a SECURITY DEFINER function to check assignee status

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Users can add task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Users can remove task assignees" ON task_assignees;

-- Create a helper function to check if user is an assignee
-- SECURITY DEFINER bypasses RLS, avoiding recursion
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees
    WHERE task_id = p_task_id
    AND user_id = p_user_id
  );
$$;

-- ============================================
-- NEW RLS POLICIES (without self-reference)
-- ============================================

-- SELECT: Users can view assignees for tasks they have access to
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
      -- User owns the task
      t.owner_id = auth.uid()
      OR
      -- User created the task
      t.created_by = auth.uid()
      OR
      -- User created the initiative
      pi.created_by = auth.uid()
      OR
      -- User is assigned to the initiative
      pi.assigned_to = auth.uid()
      OR
      -- User is an assignee of this task (using helper function)
      is_task_assignee(t.id, auth.uid())
      OR
      -- Personal initiative owned by user
      (pi.is_personal = true AND pi.created_by = auth.uid())
      OR
      -- User has function access (for non-personal, non-private initiatives)
      (
        pi.is_personal IS NOT TRUE
        AND (pi.is_private IS NULL OR pi.is_private = false)
        AND pi.area_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM project_areas pa
          JOIN project_function_access pfa ON pfa.function_id = pa.function_id
          WHERE pa.id = pi.area_id
          AND pfa.user_id = auth.uid()
        )
      )
    )
  )
);

-- INSERT: Users can add assignees to tasks they have access to
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
      -- User owns the task
      t.owner_id = auth.uid()
      OR
      -- User created the task
      t.created_by = auth.uid()
      OR
      -- User created the initiative
      pi.created_by = auth.uid()
      OR
      -- User is assigned to the initiative
      pi.assigned_to = auth.uid()
      OR
      -- Personal initiative owned by user
      (pi.is_personal = true AND pi.created_by = auth.uid())
      OR
      -- User is an assignee of this task (using helper function)
      is_task_assignee(t.id, auth.uid())
      OR
      -- User has function access (for non-personal initiatives)
      (
        pi.is_personal IS NOT TRUE
        AND pi.area_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM project_areas pa
          JOIN project_function_access pfa ON pfa.function_id = pa.function_id
          WHERE pa.id = pi.area_id
          AND pfa.user_id = auth.uid()
        )
      )
    )
  )
);

-- DELETE: Users can remove assignees from tasks they can edit or remove themselves
CREATE POLICY "Users can remove task assignees"
ON task_assignees FOR DELETE USING (
  -- User is removing themselves
  task_assignees.user_id = auth.uid()
  OR
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
      -- User owns the task
      t.owner_id = auth.uid()
      OR
      -- User created the task
      t.created_by = auth.uid()
      OR
      -- User created the initiative
      pi.created_by = auth.uid()
      OR
      -- Personal initiative owned by user
      (pi.is_personal = true AND pi.created_by = auth.uid())
      OR
      -- User has function access (for non-personal initiatives)
      (
        pi.is_personal IS NOT TRUE
        AND pi.area_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM project_areas pa
          JOIN project_function_access pfa ON pfa.function_id = pa.function_id
          WHERE pa.id = pi.area_id
          AND pfa.user_id = auth.uid()
        )
      )
    )
  )
);
