-- Migration: Add description field to project_initiatives
-- This adds detailed initiative descriptions for the Annual Plan tab

-- Add description column to project_initiatives
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN project_initiatives.description IS 'Detailed description of what this initiative is and why it matters';
