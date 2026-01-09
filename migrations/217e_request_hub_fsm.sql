-- Migration 217e: Request Hub (Internal Tickets) <-> FSM Connection
-- PART 5 of Request-Project Lifecycle Architecture
--
-- The `requests` table is used by the Request Hub (internal company requests
-- like pricing, material, support). This links them to FSM entities.

-- Connect internal requests to FSM entities
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS job_issue_id UUID REFERENCES job_issues(id);

-- Note: client_id already exists on requests table

-- Request Hub Indexes for FSM lookups
CREATE INDEX IF NOT EXISTS idx_requests_project ON requests(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_job ON requests(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_job_issue ON requests(job_issue_id)
  WHERE job_issue_id IS NOT NULL;

SELECT 'Migration 217e complete: Request Hub FSM connection';
