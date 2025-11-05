-- ============================================
-- FIX PROJECT ACTIVITY RLS POLICIES
-- Created: 2025-11-05
-- Purpose: Add INSERT policy for project_activity to allow triggers to log activity
-- ============================================

-- The trigger log_initiative_activity creates activity records automatically
-- when initiatives are created or updated. We need an INSERT policy that allows
-- the trigger to function properly.

-- Add INSERT policy for project_activity
-- Allow inserts when the user has permission to create/update the associated initiative
CREATE POLICY "System can log activity for initiatives" ON project_activity
  FOR INSERT WITH CHECK (
    -- Allow if user is creating/updating an initiative they have access to
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_buckets ON project_buckets.id = project_initiatives.bucket_id
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_initiatives.id = project_activity.initiative_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead', 'member')
    )
    OR
    -- Allow if user is assigned to the initiative
    EXISTS (
      SELECT 1 FROM project_initiatives
      WHERE project_initiatives.id = project_activity.initiative_id
      AND project_initiatives.assigned_to = auth.uid()
    )
    OR
    -- Allow for admins
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY "System can log activity for initiatives" ON project_activity IS 'Allow activity logging for initiatives the user has access to';
