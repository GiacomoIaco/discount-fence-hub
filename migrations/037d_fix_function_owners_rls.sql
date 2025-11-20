-- Migration 037d: Fix Function Owners RLS Policy
-- The previous policy was too restrictive - non-admin users couldn't add owners if function had no owners yet

-- Drop the old policy
DROP POLICY IF EXISTS manage_function_owners ON project_function_owners;

-- Create a better policy:
-- Users can manage owners if they:
-- 1. Are admin, OR
-- 2. Have access to the function (can edit it), OR
-- 3. Are already an owner of the function
CREATE POLICY manage_function_owners ON project_function_owners
  FOR ALL
  USING (
    -- User is admin
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
    OR
    -- User has access to the function (through project_function_access)
    EXISTS (
      SELECT 1 FROM project_function_access pfa
      WHERE pfa.function_id = project_function_owners.function_id
      AND pfa.user_id = auth.uid()
    )
    OR
    -- User is already an owner of this function
    EXISTS (
      SELECT 1 FROM project_function_owners pfo
      WHERE pfo.function_id = project_function_owners.function_id
      AND pfo.user_id = auth.uid()
    )
  );

COMMENT ON POLICY manage_function_owners ON project_function_owners IS 'Allow admins, users with function access, or existing owners to manage function owners';
