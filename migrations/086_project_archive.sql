-- Migration: 086_project_archive.sql
-- Description: Add archive functionality to projects
-- Date: December 5, 2024

-- Add is_archived column to bom_projects
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add archived_at timestamp
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add archived_by to track who archived
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Create index for filtering archived projects
CREATE INDEX IF NOT EXISTS idx_bom_projects_is_archived
ON bom_projects(is_archived);

-- Create index for archived_at for sorting
CREATE INDEX IF NOT EXISTS idx_bom_projects_archived_at
ON bom_projects(archived_at)
WHERE is_archived = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN bom_projects.is_archived IS 'Soft delete flag - archived projects are hidden by default';
COMMENT ON COLUMN bom_projects.archived_at IS 'Timestamp when project was archived';
COMMENT ON COLUMN bom_projects.archived_by IS 'User who archived the project';
