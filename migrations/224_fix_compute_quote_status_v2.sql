-- Migration 224: Fix compute_quote_status to remove non-existent column references
--
-- Problem: Migration 223 still references q.changes_requested_at which doesn't exist
-- Solution: Remove that check since the column was never created

CREATE OR REPLACE FUNCTION compute_quote_status(q quotes)
RETURNS TEXT AS $$
BEGIN
  -- Terminal states first
  IF q.converted_to_job_id IS NOT NULL THEN RETURN 'converted'; END IF;
  IF q.lost_reason IS NOT NULL AND q.lost_reason != '' THEN RETURN 'lost'; END IF;
  IF q.archived_at IS NOT NULL THEN RETURN 'archived'; END IF;

  -- Pending manager approval (before sent)
  IF q.approval_requested_at IS NOT NULL
     AND q.manager_approved_at IS NULL
     AND q.manager_rejected_at IS NULL THEN
    RETURN 'pending_manager_approval';
  END IF;

  -- Client has approved
  IF q.client_approved_at IS NOT NULL OR q.approval_status = 'approved' THEN
    RETURN 'approved';
  END IF;

  -- Follow-up needed (sent > 3 days ago without response)
  IF q.sent_at IS NOT NULL
     AND q.sent_at < NOW() - INTERVAL '3 days'
     AND q.viewed_at IS NULL THEN
    RETURN 'follow_up';
  END IF;

  -- Sent to client
  IF q.sent_at IS NOT NULL THEN RETURN 'sent'; END IF;

  -- Still a draft
  RETURN 'draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

SELECT 'Migration 224 complete: Fixed compute_quote_status - removed changes_requested_at reference';
