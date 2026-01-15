-- Migration 217e: Ticket Hub <-> FSM Connection
-- PART 5 of Request-Project Lifecycle Architecture

-- Connect tickets to FSM entities
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS job_issue_id UUID REFERENCES job_issues(id);

-- Ticket Hub Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_job ON tickets(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_job_issue ON tickets(job_issue_id)
  WHERE job_issue_id IS NOT NULL;

SELECT 'Migration 217e complete: Ticket Hub FSM connection';
