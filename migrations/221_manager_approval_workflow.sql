-- Migration 221: Manager Approval Workflow
--
-- Implements internal approval process for quotes that violate pricing thresholds.
-- Approval happens BEFORE quote can be sent to client.
--
-- New status: pending_manager_approval (between draft and sent)
-- New settings table: quote_approval_settings (per Business Unit)

-- ============================================
-- 1. Add approval tracking columns to quotes
-- ============================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manager_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_approval_notes TEXT;

COMMENT ON COLUMN quotes.approval_requested_at IS 'When rep requested manager approval';
COMMENT ON COLUMN quotes.approval_requested_by IS 'Rep who requested approval';
COMMENT ON COLUMN quotes.manager_approved_by IS 'Manager who approved the quote';
COMMENT ON COLUMN quotes.manager_approved_at IS 'When manager approved';
COMMENT ON COLUMN quotes.manager_rejected_at IS 'When manager rejected (back to draft)';
COMMENT ON COLUMN quotes.manager_approval_notes IS 'Manager notes on approval/rejection';

-- ============================================
-- 2. Create approval settings table
-- ============================================

CREATE TABLE IF NOT EXISTS quote_approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = global default, otherwise per Business Unit
  qbo_class_id VARCHAR REFERENCES qbo_classes(id) ON DELETE CASCADE,

  -- Enable/disable approval requirements
  enabled BOOLEAN DEFAULT true,

  -- Thresholds (require approval when ANY is violated)
  margin_below_percent DECIMAL(5,2) DEFAULT 15,
  discount_above_percent DECIMAL(5,2) DEFAULT 10,
  total_above_amount DECIMAL(12,2) DEFAULT 25000,

  -- Approver configuration
  approver_type TEXT DEFAULT 'role' CHECK (approver_type IN ('role', 'specific_users', 'bu_manager')),
  approver_roles TEXT[] DEFAULT ARRAY['admin', 'sales_manager'],
  approver_user_ids UUID[],

  -- Notification preferences
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  notify_sms BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One setting per BU (NULL for global default)
  UNIQUE(qbo_class_id)
);

-- RLS
ALTER TABLE quote_approval_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_approval_settings_select" ON quote_approval_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "quote_approval_settings_insert" ON quote_approval_settings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "quote_approval_settings_update" ON quote_approval_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "quote_approval_settings_delete" ON quote_approval_settings
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON quote_approval_settings TO authenticated;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_quote_approval_settings_qbo_class ON quote_approval_settings(qbo_class_id);

-- ============================================
-- 3. Insert default global settings
-- ============================================

INSERT INTO quote_approval_settings (
  qbo_class_id,
  enabled,
  margin_below_percent,
  discount_above_percent,
  total_above_amount,
  approver_type,
  approver_roles
) VALUES (
  NULL,  -- Global default
  true,
  15,
  10,
  25000,
  'role',
  ARRAY['admin', 'sales_manager']
) ON CONFLICT (qbo_class_id) DO NOTHING;

-- ============================================
-- 4. Update compute_quote_status function
-- ============================================

CREATE OR REPLACE FUNCTION compute_quote_status(q quotes)
RETURNS TEXT AS $$
BEGIN
  -- Terminal states
  IF q.converted_to_job_id IS NOT NULL THEN RETURN 'converted'; END IF;
  IF q.lost_at IS NOT NULL THEN RETURN 'lost'; END IF;
  IF q.archived_at IS NOT NULL THEN RETURN 'archived'; END IF;

  -- Pending manager approval (NEW - before sent)
  IF q.approval_requested_at IS NOT NULL
     AND q.manager_approved_at IS NULL
     AND q.manager_rejected_at IS NULL THEN
    RETURN 'pending_manager_approval';
  END IF;

  -- Client has approved
  IF q.client_approved_at IS NOT NULL OR q.approval_status = 'approved' THEN
    RETURN 'approved';
  END IF;

  -- Client requested changes
  IF q.changes_requested_at IS NOT NULL THEN RETURN 'changes_requested'; END IF;

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

-- ============================================
-- 5. Function to get approval settings for a quote
-- ============================================

CREATE OR REPLACE FUNCTION get_quote_approval_settings(p_qbo_class_id VARCHAR)
RETURNS quote_approval_settings AS $$
DECLARE
  v_settings quote_approval_settings;
BEGIN
  -- Try BU-specific settings first
  SELECT * INTO v_settings
  FROM quote_approval_settings
  WHERE qbo_class_id = p_qbo_class_id;

  -- Fall back to global default
  IF NOT FOUND THEN
    SELECT * INTO v_settings
    FROM quote_approval_settings
    WHERE qbo_class_id IS NULL;
  END IF;

  RETURN v_settings;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Function to check if quote needs approval
-- ============================================

CREATE OR REPLACE FUNCTION quote_needs_manager_approval(
  p_quote_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_quote quotes;
  v_settings quote_approval_settings;
BEGIN
  -- Get the quote
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Already approved or rejected
  IF v_quote.manager_approved_at IS NOT NULL THEN RETURN false; END IF;
  IF v_quote.requires_approval = false THEN RETURN false; END IF;

  -- Get settings
  v_settings := get_quote_approval_settings(v_quote.qbo_class_id);
  IF NOT v_settings.enabled THEN RETURN false; END IF;

  -- Check thresholds
  IF v_quote.margin_percent IS NOT NULL
     AND v_quote.margin_percent < v_settings.margin_below_percent THEN
    RETURN true;
  END IF;

  IF v_quote.discount_percent IS NOT NULL
     AND v_quote.discount_percent > v_settings.discount_above_percent THEN
    RETURN true;
  END IF;

  IF v_quote.total IS NOT NULL
     AND v_quote.total > v_settings.total_above_amount THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Function to get approvers for a quote
-- ============================================

CREATE OR REPLACE FUNCTION get_quote_approvers(p_qbo_class_id VARCHAR)
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT) AS $$
DECLARE
  v_settings quote_approval_settings;
BEGIN
  v_settings := get_quote_approval_settings(p_qbo_class_id);

  IF v_settings.approver_type = 'specific_users' THEN
    -- Return specific users
    RETURN QUERY
    SELECT up.id, up.email, up.full_name
    FROM user_profiles up
    WHERE up.id = ANY(v_settings.approver_user_ids)
      AND up.is_active = true;

  ELSIF v_settings.approver_type = 'role' THEN
    -- Return users with matching roles
    RETURN QUERY
    SELECT up.id, up.email, up.full_name
    FROM user_profiles up
    WHERE up.role = ANY(v_settings.approver_roles)
      AND up.is_active = true;

  ELSIF v_settings.approver_type = 'bu_manager' THEN
    -- Return BU managers from FSM team profiles
    RETURN QUERY
    SELECT up.id, up.email, up.full_name
    FROM user_profiles up
    JOIN fsm_team_profiles ftp ON ftp.user_id = up.id
    WHERE p_qbo_class_id = ANY(ftp.assigned_qbo_class_ids)
      AND 'sales_manager' = ANY(ftp.fsm_roles)
      AND ftp.is_active = true
      AND up.is_active = true;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Index for pending approval queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_quotes_pending_approval
ON quotes(approval_requested_at)
WHERE approval_requested_at IS NOT NULL
  AND manager_approved_at IS NULL
  AND manager_rejected_at IS NULL;

SELECT 'Migration 221 complete: Manager approval workflow';
