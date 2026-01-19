-- ============================================================================
-- UNIFIED COMMUNICATION HUB - PHASE 1: Entity Links
-- Adds entity linking columns to mc_messages using Exclusive Arc Pattern
-- Allows messages to be linked to Jobs, Quotes, Requests, Invoices, and Tickets
-- ============================================================================

-- ============================================================================
-- 1. ENTITY LINK COLUMNS
-- Using Exclusive Arc Pattern: at most one entity link per message
-- ============================================================================

-- Link to service_requests (FSM requests from clients)
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS linked_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL;

-- Link to quotes
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS linked_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Link to jobs
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS linked_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Link to invoices
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Link to internal tickets (requests table)
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS linked_ticket_id UUID REFERENCES requests(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. THREADING SUPPORT
-- Allows messages to form reply threads
-- ============================================================================

-- Parent message reference for threading
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES mc_messages(id) ON DELETE CASCADE;

-- Thread depth (0 = root, 1 = first reply, etc.)
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS thread_depth INT DEFAULT 0;

-- ============================================================================
-- 3. INDEXES FOR FAST ENTITY LOOKUP
-- Partial indexes only on non-null values for efficiency
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mc_messages_linked_request
  ON mc_messages(linked_request_id)
  WHERE linked_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_messages_linked_quote
  ON mc_messages(linked_quote_id)
  WHERE linked_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_messages_linked_job
  ON mc_messages(linked_job_id)
  WHERE linked_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_messages_linked_invoice
  ON mc_messages(linked_invoice_id)
  WHERE linked_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_messages_linked_ticket
  ON mc_messages(linked_ticket_id)
  WHERE linked_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mc_messages_parent_thread
  ON mc_messages(parent_message_id)
  WHERE parent_message_id IS NOT NULL;

-- ============================================================================
-- 4. EXCLUSIVE ARC CONSTRAINT
-- Ensures a message can only be linked to ONE entity type at a time
-- ============================================================================

-- Drop constraint if it exists (for re-running migration)
ALTER TABLE mc_messages
  DROP CONSTRAINT IF EXISTS mc_messages_single_entity_link;

-- Add constraint: at most one entity link per message
ALTER TABLE mc_messages
  ADD CONSTRAINT mc_messages_single_entity_link CHECK (
    (CASE WHEN linked_request_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN linked_quote_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN linked_job_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN linked_invoice_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN linked_ticket_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );

-- ============================================================================
-- 5. ANNOUNCEMENT/BROADCAST SUPPORT
-- Add conversation type for announcements
-- ============================================================================

-- First, add the announcement type to the enum if it doesn't exist
DO $$
BEGIN
  -- Check if 'announcement' is already a value in conversation_type enum
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'announcement'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'conversation_type')
  ) THEN
    ALTER TYPE conversation_type ADD VALUE 'announcement';
  END IF;
END
$$;

-- Add broadcast flag to conversations
ALTER TABLE mc_conversations
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT FALSE;

-- Target roles for announcements (e.g., ['sales', 'operations'])
ALTER TABLE mc_conversations
  ADD COLUMN IF NOT EXISTS target_roles TEXT[];

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to get entity info for a message
CREATE OR REPLACE FUNCTION get_message_entity_info(p_message_id UUID)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  entity_number TEXT,
  entity_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN m.linked_request_id IS NOT NULL THEN 'request'
      WHEN m.linked_quote_id IS NOT NULL THEN 'quote'
      WHEN m.linked_job_id IS NOT NULL THEN 'job'
      WHEN m.linked_invoice_id IS NOT NULL THEN 'invoice'
      WHEN m.linked_ticket_id IS NOT NULL THEN 'ticket'
      ELSE NULL
    END AS entity_type,
    COALESCE(
      m.linked_request_id,
      m.linked_quote_id,
      m.linked_job_id,
      m.linked_invoice_id,
      m.linked_ticket_id
    ) AS entity_id,
    COALESCE(
      sr.request_number,
      q.quote_number,
      j.job_number,
      i.invoice_number,
      r.project_number::TEXT
    ) AS entity_number,
    CASE
      WHEN m.linked_request_id IS NOT NULL THEN 'Request #' || sr.request_number
      WHEN m.linked_quote_id IS NOT NULL THEN 'Quote #' || q.quote_number
      WHEN m.linked_job_id IS NOT NULL THEN 'Job #' || j.job_number
      WHEN m.linked_invoice_id IS NOT NULL THEN 'Invoice #' || i.invoice_number
      WHEN m.linked_ticket_id IS NOT NULL THEN 'Ticket #' || r.project_number
      ELSE NULL
    END AS entity_label
  FROM mc_messages m
  LEFT JOIN service_requests sr ON m.linked_request_id = sr.id
  LEFT JOIN quotes q ON m.linked_quote_id = q.id
  LEFT JOIN jobs j ON m.linked_job_id = j.id
  LEFT JOIN invoices i ON m.linked_invoice_id = i.id
  LEFT JOIN requests r ON m.linked_ticket_id = r.id
  WHERE m.id = p_message_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all messages for an entity
CREATE OR REPLACE FUNCTION get_entity_messages(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  channel message_channel,
  direction message_direction,
  body TEXT,
  from_user_id UUID,
  from_contact_id UUID,
  status message_status,
  created_at TIMESTAMPTZ,
  parent_message_id UUID,
  thread_depth INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.conversation_id,
    m.channel,
    m.direction,
    m.body,
    m.from_user_id,
    m.from_contact_id,
    m.status,
    m.created_at,
    m.parent_message_id,
    m.thread_depth
  FROM mc_messages m
  WHERE
    CASE p_entity_type
      WHEN 'request' THEN m.linked_request_id = p_entity_id
      WHEN 'quote' THEN m.linked_quote_id = p_entity_id
      WHEN 'job' THEN m.linked_job_id = p_entity_id
      WHEN 'invoice' THEN m.linked_invoice_id = p_entity_id
      WHEN 'ticket' THEN m.linked_ticket_id = p_entity_id
      ELSE FALSE
    END
  ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN mc_messages.linked_request_id IS 'FK to service_requests - links message to a client service request';
COMMENT ON COLUMN mc_messages.linked_quote_id IS 'FK to quotes - links message to a quote';
COMMENT ON COLUMN mc_messages.linked_job_id IS 'FK to jobs - links message to a job';
COMMENT ON COLUMN mc_messages.linked_invoice_id IS 'FK to invoices - links message to an invoice';
COMMENT ON COLUMN mc_messages.linked_ticket_id IS 'FK to requests (internal tickets) - links message to an internal ticket';
COMMENT ON COLUMN mc_messages.parent_message_id IS 'FK to mc_messages - parent message for threading';
COMMENT ON COLUMN mc_messages.thread_depth IS 'Depth in reply thread (0=root, 1=first reply, etc.)';
COMMENT ON COLUMN mc_conversations.is_broadcast IS 'True if this is a broadcast/announcement conversation';
COMMENT ON COLUMN mc_conversations.target_roles IS 'Target roles for broadcast announcements';

COMMENT ON CONSTRAINT mc_messages_single_entity_link ON mc_messages IS
  'Exclusive Arc Pattern: ensures message is linked to at most one entity type';

SELECT 'Migration 260 complete: Unified messaging entity links added';
