-- Migration 225: Quote Status Cleanup
--
-- Implements the refined quote status system:
-- - Approved = Manager approved (internal gate)
-- - Accepted = Client accepted (external)
-- - Expired = No response after X days (auto)
-- - Archived = Superseded/duplicate (with reason)
--
-- Also fixes the alternative quotes trigger to set archived_at

-- ============================================
-- 1. Rename client_approved_at → client_accepted_at
-- ============================================

ALTER TABLE quotes
  RENAME COLUMN client_approved_at TO client_accepted_at;

-- ============================================
-- 2. Add new columns for status tracking
-- ============================================

-- Expired status (auto after X days of no response)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Changes requested by client (via portal - future)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changes_requested_notes TEXT;

-- Archive reason (for analytics differentiation)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS archive_reason TEXT
    CHECK (archive_reason IN ('alternative_selected', 'superseded', 'duplicate', 'cancelled', 'other'));

-- Follow-up tracking (not a status, but for team handoff)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS follow_up_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_owner_id UUID REFERENCES auth.users(id);

-- Auto-expire settings (days after sent, 0 = no auto-expire)
ALTER TABLE quote_approval_settings
  ADD COLUMN IF NOT EXISTS auto_expire_days INTEGER DEFAULT 30;

COMMENT ON COLUMN quotes.expired_at IS 'When quote auto-expired due to no response';
COMMENT ON COLUMN quotes.archive_reason IS 'Why the quote was archived (alternative_selected, superseded, etc.)';
COMMENT ON COLUMN quotes.follow_up_assigned_at IS 'When quote was assigned to follow-up team';
COMMENT ON COLUMN quotes.follow_up_owner_id IS 'User responsible for follow-up (different from sales_rep)';

-- ============================================
-- 3. Update compute_quote_status function
-- ============================================

CREATE OR REPLACE FUNCTION compute_quote_status(q quotes)
RETURNS TEXT AS $$
BEGIN
  -- Terminal states first (order matters!)
  IF q.converted_to_job_id IS NOT NULL THEN RETURN 'converted'; END IF;
  IF q.lost_reason IS NOT NULL AND q.lost_reason != '' THEN RETURN 'lost'; END IF;
  IF q.expired_at IS NOT NULL THEN RETURN 'expired'; END IF;
  IF q.archived_at IS NOT NULL THEN RETURN 'archived'; END IF;

  -- Client accepted (was "approved")
  IF q.client_accepted_at IS NOT NULL THEN RETURN 'accepted'; END IF;

  -- Client requested changes (future - via portal)
  IF q.changes_requested_at IS NOT NULL THEN RETURN 'changes_requested'; END IF;

  -- Sent to client - awaiting response
  IF q.sent_at IS NOT NULL THEN RETURN 'awaiting_response'; END IF;

  -- Manager approved, ready to send
  IF q.manager_approved_at IS NOT NULL THEN RETURN 'approved'; END IF;

  -- Pending manager approval (requested but not yet approved/rejected)
  IF q.approval_requested_at IS NOT NULL
     AND q.manager_approved_at IS NULL
     AND q.manager_rejected_at IS NULL THEN
    RETURN 'pending_approval';
  END IF;

  -- Still a draft
  RETURN 'draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 4. Update alternative quotes trigger
--    Now also sets archived_at so status computes correctly
-- ============================================

CREATE OR REPLACE FUNCTION trg_auto_decline_alternatives()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.acceptance_status = 'accepted' AND NEW.quote_group IS NOT NULL THEN
    UPDATE quotes
    SET acceptance_status = 'declined',
        archived_at = NOW(),
        archive_reason = 'alternative_selected',
        internal_notes = COALESCE(internal_notes, '') ||
          E'\n[Auto-archived: Alternative quote ' || NEW.quote_number || ' was accepted]'
    WHERE quote_group = NEW.quote_group
      AND id != NEW.id
      AND acceptance_status NOT IN ('accepted', 'declined', 'superseded');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_quote_accepted_decline_alternatives ON quotes;
CREATE TRIGGER trg_quote_accepted_decline_alternatives
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (OLD.acceptance_status IS DISTINCT FROM 'accepted' AND NEW.acceptance_status = 'accepted')
  EXECUTE FUNCTION trg_auto_decline_alternatives();

-- ============================================
-- 5. Function to auto-expire old quotes
--    Called by scheduled job/cron
-- ============================================

CREATE OR REPLACE FUNCTION expire_stale_quotes()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_settings RECORD;
BEGIN
  -- Get global settings (or could loop through per-BU settings)
  SELECT * INTO v_settings FROM quote_approval_settings WHERE qbo_class_id IS NULL;

  IF v_settings.auto_expire_days IS NULL OR v_settings.auto_expire_days = 0 THEN
    RETURN 0; -- Auto-expire disabled
  END IF;

  -- Expire quotes that have been awaiting response too long
  UPDATE quotes
  SET expired_at = NOW()
  WHERE sent_at IS NOT NULL
    AND sent_at < NOW() - (v_settings.auto_expire_days || ' days')::INTERVAL
    AND client_accepted_at IS NULL
    AND converted_to_job_id IS NULL
    AND lost_reason IS NULL
    AND expired_at IS NULL
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Helper: Check if quote needs follow-up
--    (sent > 3 days, no response)
-- ============================================

CREATE OR REPLACE FUNCTION quote_needs_follow_up(p_quote_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_quote quotes;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Needs follow-up if:
  -- 1. Has been sent
  -- 2. Sent more than 3 days ago
  -- 3. No response yet (not viewed, accepted, converted, lost, expired, archived)
  RETURN v_quote.sent_at IS NOT NULL
    AND v_quote.sent_at < NOW() - INTERVAL '3 days'
    AND v_quote.viewed_at IS NULL
    AND v_quote.client_accepted_at IS NULL
    AND v_quote.converted_to_job_id IS NULL
    AND v_quote.lost_reason IS NULL
    AND v_quote.expired_at IS NULL
    AND v_quote.archived_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_quotes_expired ON quotes(expired_at)
  WHERE expired_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_archive_reason ON quotes(archive_reason)
  WHERE archive_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_follow_up_owner ON quotes(follow_up_owner_id)
  WHERE follow_up_owner_id IS NOT NULL;

-- ============================================
-- 8. Update any existing 'approved' status to 'accepted'
--    for client approvals (data migration)
-- ============================================

-- Note: The old column was client_approved_at, now client_accepted_at
-- The status was computed as 'approved' when client_approved_at was set
-- Now it will compute as 'accepted' - no data change needed, just function update

SELECT 'Migration 225 complete: Quote status cleanup - Approved vs Accepted, Expired, Archive reasons';
