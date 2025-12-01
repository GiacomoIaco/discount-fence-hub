-- ============================================
-- Migration 060: Fix Function Members RLS for Owners
-- Created: 2025-12-01
-- Purpose: Allow function owners to manage members (not just super admins)
-- ============================================

-- The issue: Migration 059 only allowed super admins and admin role users
-- to manage function members. But function owners should also be able to
-- add/remove members for their own function.

-- Drop the old policy
DROP POLICY IF EXISTS "super_admin_manage_members" ON project_function_members;

-- Create new policy that allows:
-- 1. Super admins (can manage all)
-- 2. Admin role users (can manage all)
-- 3. Function owners (can manage members of their function)
CREATE POLICY "manage_function_members" ON project_function_members
  FOR ALL
  USING (
    -- Super admins and admin role can manage all
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_super_admin = TRUE OR up.role = 'admin')
    )
    OR
    -- Function owners can manage members of their own function
    EXISTS (
      SELECT 1 FROM project_function_owners pfo
      WHERE pfo.function_id = project_function_members.function_id
      AND pfo.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same conditions for INSERT/UPDATE
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_super_admin = TRUE OR up.role = 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_owners pfo
      WHERE pfo.function_id = project_function_members.function_id
      AND pfo.user_id = auth.uid()
    )
  );
