-- ============================================
-- FIX RECURSIVE RLS POLICIES
-- Created: 2025-11-05
-- Purpose: Fix infinite recursion in project_function_access policies
-- ============================================

-- The issue: When creating a function, we check project_function_access table,
-- but the SELECT policy on project_function_access also checks itself, causing recursion.
--
-- Solution: Simplify policies to avoid circular dependencies.
-- For admin operations, ONLY check user_profiles role, not function_access.

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can create functions" ON project_functions;
DROP POLICY IF EXISTS "Admins and leads can update functions" ON project_functions;
DROP POLICY IF EXISTS "Admins and leads can delete functions" ON project_functions;
DROP POLICY IF EXISTS "Users can view functions they have access to" ON project_functions;

DROP POLICY IF EXISTS "Admins and leads can create buckets" ON project_buckets;
DROP POLICY IF EXISTS "Admins and leads can update buckets" ON project_buckets;
DROP POLICY IF EXISTS "Admins and leads can delete buckets" ON project_buckets;
DROP POLICY IF EXISTS "Users can view buckets in their functions" ON project_buckets;

DROP POLICY IF EXISTS "Users can view access for their functions" ON project_function_access;
DROP POLICY IF EXISTS "Admins and leads can manage access" ON project_function_access;

-- ============================================
-- PROJECT_FUNCTIONS POLICIES (SIMPLIFIED)
-- ============================================

-- SELECT: Admins see all, users see functions they have access to
-- IMPORTANT: Use SECURITY DEFINER function to avoid recursion
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE POLICY "Users can view functions" ON project_functions
  FOR SELECT USING (
    user_is_admin()
    OR
    id IN (
      SELECT function_id FROM project_function_access
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Only admins can create functions
CREATE POLICY "Admins can create functions" ON project_functions
  FOR INSERT WITH CHECK (user_is_admin());

-- UPDATE: Only admins can update functions
CREATE POLICY "Admins can update functions" ON project_functions
  FOR UPDATE USING (user_is_admin());

-- DELETE: Only admins can delete functions
CREATE POLICY "Admins can delete functions" ON project_functions
  FOR DELETE USING (user_is_admin());

-- ============================================
-- PROJECT_FUNCTION_ACCESS POLICIES (SIMPLIFIED)
-- ============================================

-- SELECT: Admins see all, users see their own access
CREATE POLICY "Users can view access" ON project_function_access
  FOR SELECT USING (
    user_is_admin()
    OR
    user_id = auth.uid()
  );

-- INSERT: Only admins can grant access
CREATE POLICY "Admins can grant access" ON project_function_access
  FOR INSERT WITH CHECK (user_is_admin());

-- UPDATE: Only admins can modify access
CREATE POLICY "Admins can update access" ON project_function_access
  FOR UPDATE USING (user_is_admin());

-- DELETE: Only admins can revoke access
CREATE POLICY "Admins can revoke access" ON project_function_access
  FOR DELETE USING (user_is_admin());

-- ============================================
-- PROJECT_BUCKETS POLICIES (SIMPLIFIED)
-- ============================================

-- SELECT: Admins see all, users see buckets in their functions
CREATE POLICY "Users can view buckets" ON project_buckets
  FOR SELECT USING (
    user_is_admin()
    OR
    function_id IN (
      SELECT function_id FROM project_function_access
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Only admins can create buckets
CREATE POLICY "Admins can create buckets" ON project_buckets
  FOR INSERT WITH CHECK (user_is_admin());

-- UPDATE: Only admins can update buckets
CREATE POLICY "Admins can update buckets" ON project_buckets
  FOR UPDATE USING (user_is_admin());

-- DELETE: Only admins can delete buckets
CREATE POLICY "Admins can delete buckets" ON project_buckets
  FOR DELETE USING (user_is_admin());

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION user_is_admin() IS 'Security definer function to check if current user is admin - prevents RLS recursion';
COMMENT ON POLICY "Users can view functions" ON project_functions IS 'Admins see all functions, users see functions they have access to';
COMMENT ON POLICY "Admins can create functions" ON project_functions IS 'Only admins can create new functions';
COMMENT ON POLICY "Users can view access" ON project_function_access IS 'Admins see all access records, users see their own';
COMMENT ON POLICY "Admins can grant access" ON project_function_access IS 'Only admins can grant function access';
