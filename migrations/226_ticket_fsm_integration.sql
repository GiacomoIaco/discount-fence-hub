-- Migration 226: Ticket (Internal Request) FSM Integration
-- Links internal tickets (requests table) to FSM entities (quotes, jobs)
-- This allows staff to create tickets related to specific quotes or jobs

-- ============================================
-- 1. ADD FSM LINK COLUMNS TO REQUESTS TABLE
-- ============================================

-- Add quote_id column to link tickets to quotes
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS fsm_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Add job_id column to link tickets to jobs
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS fsm_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Add project_id column for broader project context
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS fsm_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================
-- 2. CREATE INDEXES FOR EFFICIENT LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_requests_fsm_quote ON requests(fsm_quote_id)
  WHERE fsm_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_fsm_job ON requests(fsm_job_id)
  WHERE fsm_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requests_fsm_project ON requests(fsm_project_id)
  WHERE fsm_project_id IS NOT NULL;

-- ============================================
-- 3. ADD REVERSE LOOKUP COLUMNS (OPTIONAL)
-- ============================================
-- These allow quick lookup of related tickets from FSM entities

-- Quotes: ticket_id for primary related ticket
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS related_ticket_id UUID REFERENCES requests(id) ON DELETE SET NULL;

-- Jobs: ticket_id for primary related ticket
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS related_ticket_id UUID REFERENCES requests(id) ON DELETE SET NULL;

-- ============================================
-- 4. HELPER VIEW FOR FSM-RELATED TICKETS
-- ============================================

CREATE OR REPLACE VIEW v_fsm_tickets AS
SELECT
  r.id,
  r.project_number as ticket_number,
  r.request_type,
  r.description,
  r.stage,
  r.created_at,
  r.updated_at,
  r.assigned_to,
  r.submitter_id,
  -- FSM Links
  r.fsm_quote_id,
  r.fsm_job_id,
  r.fsm_project_id,
  -- Quote info
  q.quote_number,
  q.status as quote_status,
  -- Job info
  j.job_number,
  j.status as job_status,
  -- Project info
  p.project_number,
  p.name as project_name
FROM requests r
LEFT JOIN quotes q ON r.fsm_quote_id = q.id
LEFT JOIN jobs j ON r.fsm_job_id = j.id
LEFT JOIN projects p ON r.fsm_project_id = p.id
WHERE r.fsm_quote_id IS NOT NULL
   OR r.fsm_job_id IS NOT NULL
   OR r.fsm_project_id IS NOT NULL;

SELECT 'Migration 226 complete: Ticket FSM integration';
