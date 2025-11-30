-- ============================================
-- Migration 058: Fix Function Owners RLS for Super Admin
-- Created: 2025-11-30
-- Purpose: Update RLS policy to recognize is_super_admin flag
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "manage_function_owners" ON project_function_owners;
DROP POLICY IF EXISTS "function_owners_policy" ON project_function_owners;
DROP POLICY IF EXISTS "allow_all_for_admins" ON project_function_owners;

-- Recreate with super_admin support
CREATE POLICY "manage_function_owners" ON project_function_owners
  FOR ALL
  USING (
    -- User is super admin (new check)
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = TRUE
    )
    OR
    -- User is admin role (legacy support)
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
    OR
    -- User is already an owner of this function
    EXISTS (
      SELECT 1 FROM project_function_owners pfo
      WHERE pfo.function_id = project_function_owners.function_id
      AND pfo.user_id = auth.uid()
    )
  );

-- Also fix function_members policy if it exists
DROP POLICY IF EXISTS "super_admin_full_access" ON project_function_members;
DROP POLICY IF EXISTS "owner_manage_members" ON project_function_members;
DROP POLICY IF EXISTS "view_own_membership" ON project_function_members;

-- Recreate function_members policies
CREATE POLICY "super_admin_full_access" ON project_function_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

CREATE POLICY "owner_manage_members" ON project_function_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_function_owners
      WHERE function_id = project_function_members.function_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "view_own_membership" ON project_function_members
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- Verify super admin is set
-- ============================================
DO $$
BEGIN
  -- Make sure giacomo is super admin
  UPDATE user_profiles
  SET is_super_admin = TRUE
  WHERE email = 'giacomo@discountfenceusa.com'
    AND (is_super_admin IS NULL OR is_super_admin = FALSE);

  IF FOUND THEN
    RAISE NOTICE 'Updated giacomo to super admin';
  ELSE
    RAISE NOTICE 'giacomo already super admin or not found';
  END IF;
END $$;
