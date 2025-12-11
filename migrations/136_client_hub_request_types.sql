-- Add Client Hub request types for onboarding workflows
-- Phase 6 of O-027 Client Hub

-- Update requests table constraint to include new types
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_request_type_check;
ALTER TABLE requests ADD CONSTRAINT requests_request_type_check
  CHECK (request_type IN (
    'pricing', 'material', 'support', 'new_builder', 'warranty', 'other',
    -- New Client Hub types:
    'new_client',       -- New client onboarding
    'new_community',    -- New community setup for existing client
    'pricing_change',   -- Request to change pricing/rate sheet
    'contact_update'    -- Update client/community contacts
  ));

-- Update assignment rules table constraint
ALTER TABLE request_assignment_rules DROP CONSTRAINT IF EXISTS request_assignment_rules_request_type_check;
ALTER TABLE request_assignment_rules ADD CONSTRAINT request_assignment_rules_request_type_check
  CHECK (request_type IN (
    'pricing', 'material', 'support', 'new_builder', 'warranty', 'other',
    'new_client', 'new_community', 'pricing_change', 'contact_update'
  ));

-- Update SLA defaults table constraint
ALTER TABLE request_sla_defaults DROP CONSTRAINT IF EXISTS request_sla_defaults_request_type_check;
ALTER TABLE request_sla_defaults ADD CONSTRAINT request_sla_defaults_request_type_check
  CHECK (request_type IN (
    'pricing', 'material', 'support', 'new_builder', 'warranty', 'other',
    'new_client', 'new_community', 'pricing_change', 'contact_update'
  ));

-- Add SLA defaults for new types
INSERT INTO request_sla_defaults (request_type, target_hours, urgent_target_hours, critical_target_hours) VALUES
  ('new_client', 48, 24, 8),       -- New client setup within 2 days
  ('new_community', 24, 12, 4),    -- New community faster (client exists)
  ('pricing_change', 48, 24, 8),   -- Pricing changes need review
  ('contact_update', 8, 4, 2)      -- Contact updates are quick
ON CONFLICT (request_type) DO NOTHING;

-- Add client/community link fields to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Index for client hub lookups
CREATE INDEX IF NOT EXISTS idx_requests_client_id ON requests(client_id);
CREATE INDEX IF NOT EXISTS idx_requests_community_id ON requests(community_id);

COMMENT ON COLUMN requests.client_id IS 'Link to client for Client Hub requests';
COMMENT ON COLUMN requests.community_id IS 'Link to community for Client Hub requests';
