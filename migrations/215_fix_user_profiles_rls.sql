-- Migration 215: Fix infinite recursion in user_profiles RLS policies
-- The policies added in migration 214 reference user_profiles from within
-- user_profiles policies, causing infinite recursion.

-- Fix: Use a SECURITY DEFINER function to check admin status
-- This avoids the recursive policy check

-- 1. Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS on this specific check
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

-- 2. Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- 3. Recreate policies using the helper function (no recursion)
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (is_current_user_admin());

-- 4. Also ensure approved users can view other approved profiles for lookups
-- (e.g., seeing sales rep names in dropdowns)
DROP POLICY IF EXISTS "Approved users can view approved profiles" ON user_profiles;
CREATE POLICY "Approved users can view approved profiles" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- The row is an approved/active user
    approval_status = 'approved' AND is_active = true
  );

SELECT 'Migration 215 complete: Fixed user_profiles RLS infinite recursion';
