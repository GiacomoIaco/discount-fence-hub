-- ============================================
-- Migration 101: Fix Status Constraint
-- ============================================
-- Adds 'picking' status to the bom_projects_status_check constraint
-- Required for the claim workflow in migration 093

-- Drop the old constraint and add with 'picking' included
ALTER TABLE bom_projects DROP CONSTRAINT IF EXISTS bom_projects_status_check;
ALTER TABLE bom_projects ADD CONSTRAINT bom_projects_status_check
  CHECK (status IN ('draft', 'ready', 'sent_to_yard', 'picking', 'staged', 'loaded', 'completed', 'cancelled', 'archived'));

-- Add comment documenting the workflow statuses
COMMENT ON COLUMN bom_projects.status IS 'Project status: draft -> ready -> sent_to_yard -> picking -> staged -> loaded -> completed (or cancelled/archived)';
