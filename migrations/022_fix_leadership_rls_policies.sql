-- ============================================
-- FIX LEADERSHIP RLS POLICIES
-- Created: 2025-11-05
-- Purpose: Fix function creation policy to allow admins to create new functions
-- ============================================

-- Drop the existing "manage" policy that doesn't work for INSERT
DROP POLICY IF EXISTS "Admins and leads can manage functions" ON project_functions;

-- Create separate policies for INSERT vs UPDATE/DELETE

-- INSERT: Only admins can create new functions
CREATE POLICY "Admins can create functions" ON project_functions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- UPDATE: Admins or function leads can update
CREATE POLICY "Admins and leads can update functions" ON project_functions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_functions.id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- DELETE: Admins or function leads can delete
CREATE POLICY "Admins and leads can delete functions" ON project_functions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_functions.id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- ============================================
-- FIX BUCKETS POLICIES (same issue)
-- ============================================

-- Drop the existing "manage" policy
DROP POLICY IF EXISTS "Admins and leads can manage buckets" ON project_buckets;

-- INSERT: Admins or function leads can create buckets
CREATE POLICY "Admins and leads can create buckets" ON project_buckets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_buckets.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- UPDATE: Admins or function leads can update buckets
CREATE POLICY "Admins and leads can update buckets" ON project_buckets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_buckets.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- DELETE: Admins or function leads can delete buckets
CREATE POLICY "Admins and leads can delete buckets" ON project_buckets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_buckets.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "Admins can create functions" ON project_functions IS 'Only admins can create new functions';
COMMENT ON POLICY "Admins and leads can update functions" ON project_functions IS 'Admins and function leads can update existing functions';
COMMENT ON POLICY "Admins and leads can delete functions" ON project_functions IS 'Admins and function leads can delete functions';
