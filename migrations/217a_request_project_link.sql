-- Migration 217a: Request-Project Bidirectional Link
-- PART 1 of Request-Project Lifecycle Architecture

-- Add project_id to requests (for when request converts to project)
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Add related_project_id for warranty/repair requests on existing projects
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS related_project_id UUID REFERENCES projects(id);

-- Add request_id to projects (source request that created this project)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES service_requests(id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_requests_project ON service_requests(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_request ON projects(request_id)
  WHERE request_id IS NOT NULL;

SELECT 'Migration 217a complete: Request-Project bidirectional link';
