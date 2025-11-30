-- ============================================
-- Migration 059: Fix RLS Recursion in Function Owners
-- Created: 2025-11-30
-- Purpose: Fix infinite recursion in project_function_owners RLS policy
-- ============================================

-- The issue: The policy was checking project_function_owners table
-- within a policy ON project_function_owners table, causing infinite recursion.

-- Solution: Only allow super admins and users with admin role to manage owners.
-- Function owners can still be VIEWED by anyone in the function.

-- Drop the problematic policies
DROP POLICY IF EXISTS "manage_function_owners" ON project_function_owners;

-- Create simplified policy - super admins and admin role users can manage owners
CREATE POLICY "super_admin_manage_owners" ON project_function_owners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_super_admin = TRUE OR up.role = 'admin')
    )
  );

-- Allow everyone to view owners (for display purposes)
CREATE POLICY "view_function_owners" ON project_function_owners
  FOR SELECT
  USING (true);

-- ============================================
-- Fix function_members policies too
-- ============================================

DROP POLICY IF EXISTS "super_admin_full_access" ON project_function_members;
DROP POLICY IF EXISTS "owner_manage_members" ON project_function_members;
DROP POLICY IF EXISTS "view_own_membership" ON project_function_members;

-- Super admins can do everything with members
CREATE POLICY "super_admin_manage_members" ON project_function_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (up.is_super_admin = TRUE OR up.role = 'admin')
    )
  );

-- Allow viewing all members (for Team View display)
CREATE POLICY "view_function_members" ON project_function_members
  FOR SELECT
  USING (true);

-- Users can see their own membership
CREATE POLICY "view_own_membership" ON project_function_members
  FOR SELECT
  USING (user_id = auth.uid());
