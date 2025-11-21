-- Migration 037e: Fix Foreign Key Relationship and RLS Infinite Recursion
-- 1. Add FK from project_function_owners.user_id to user_profiles(id) for easier joins
-- 2. Fix infinite recursion in RLS policy

-- Add foreign key to user_profiles
ALTER TABLE project_function_owners
  ADD CONSTRAINT project_function_owners_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Drop the old recursive policy
DROP POLICY IF EXISTS manage_function_owners ON project_function_owners;

-- Create a new policy without recursion:
-- Users can manage owners if they:
-- 1. Are admin, OR
-- 2. Have access to the function (can edit it)
-- Note: Removed the recursive check for "already an owner"
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
  );

COMMENT ON POLICY manage_function_owners ON project_function_owners IS 'Allow admins or users with function access to manage function owners (no recursive check)';
