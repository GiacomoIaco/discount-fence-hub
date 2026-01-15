-- Migration 217b: Project Type & Warranty
-- PART 2 of Request-Project Lifecycle Architecture

-- Project type for categorization
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'standard'
    CHECK (project_type IN ('standard', 'warranty', 'follow_up', 'service_call'));

-- Warranty tracking (structured)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS warranty_expires_at DATE,
  ADD COLUMN IF NOT EXISTS warranty_type TEXT;

-- Note: parent_project_id already exists for warranty child projects

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id)
  WHERE parent_project_id IS NOT NULL;

SELECT 'Migration 217b complete: Project type & warranty fields';
