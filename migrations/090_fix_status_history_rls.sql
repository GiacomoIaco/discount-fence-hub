-- Migration: 090_fix_status_history_rls.sql
-- Description: Add INSERT policy for project_status_history table
-- The table had RLS enabled with only a SELECT policy, blocking status changes

-- Add INSERT policy for project_status_history
CREATE POLICY "Anyone can insert project_status_history"
  ON project_status_history FOR INSERT
  WITH CHECK (true);

-- Also add UPDATE and DELETE policies for completeness
CREATE POLICY "Anyone can update project_status_history"
  ON project_status_history FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete project_status_history"
  ON project_status_history FOR DELETE
  USING (true);
