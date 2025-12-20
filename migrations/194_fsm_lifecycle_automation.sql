-- ============================================================================
-- Migration 194: FSM Lifecycle Automation
-- ============================================================================
-- This migration enforces the FSM lifecycle at the database level:
--   Request → Quote → Job → Invoice
--
-- Features:
-- 1. Computed status functions (status derived from data, not manually set)
-- 2. Lifecycle cascade triggers (conversions auto-update source entities)
-- 3. Validation constraints (prevent orphan/invalid entities)
-- 4. Automatic status history (every status change is logged)
-- ============================================================================

-- ============================================================================
-- PART 1: ADD MISSING TIMESTAMP COLUMNS
-- ============================================================================

-- Add archived_at to requests (makes archived status data-driven)
ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add archived_at to quotes (makes lost/archived status data-driven)
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add invoiced_at to jobs (tracks when invoice was created)
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- ============================================================================
-- PART 2: COMPUTED STATUS FUNCTIONS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- REQUEST STATUS: Computed from data state
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_request_status(
  p_archived_at TIMESTAMPTZ,
  p_converted_to_quote_id UUID,
  p_converted_to_job_id UUID,
  p_assessment_completed_at TIMESTAMPTZ,
  p_assessment_scheduled_at TIMESTAMPTZ,
  p_requires_assessment BOOLEAN
) RETURNS TEXT AS $$
BEGIN
  -- Priority order matters: check terminal states first

  -- 1. Archived (user action)
  IF p_archived_at IS NOT NULL THEN
    RETURN 'archived';
  END IF;

  -- 2. Converted to quote or job
  IF p_converted_to_quote_id IS NOT NULL OR p_converted_to_job_id IS NOT NULL THEN
    RETURN 'converted';
  END IF;

  -- 3. Assessment completed
  IF p_assessment_completed_at IS NOT NULL THEN
    RETURN 'assessment_completed';
  END IF;

  -- 4. Assessment scheduled (check date-based states)
  IF p_assessment_scheduled_at IS NOT NULL THEN
    IF p_assessment_scheduled_at::DATE < CURRENT_DATE THEN
      RETURN 'assessment_overdue';
    ELSIF p_assessment_scheduled_at::DATE = CURRENT_DATE THEN
      RETURN 'assessment_today';
    ELSE
      RETURN 'assessment_scheduled';
    END IF;
  END IF;

  -- 5. Default: pending
  RETURN 'pending';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- QUOTE STATUS: Computed from data state
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_quote_status(
  p_archived_at TIMESTAMPTZ,
  p_converted_to_job_id UUID,
  p_lost_reason TEXT,
  p_client_approved_at TIMESTAMPTZ,
  p_approval_status TEXT,
  p_sent_at TIMESTAMPTZ,
  p_valid_until DATE
) RETURNS TEXT AS $$
BEGIN
  -- Priority order: terminal states first

  -- 1. Archived
  IF p_archived_at IS NOT NULL THEN
    RETURN 'lost';  -- Archived quotes are effectively lost
  END IF;

  -- 2. Converted to job
  IF p_converted_to_job_id IS NOT NULL THEN
    RETURN 'converted';
  END IF;

  -- 3. Lost (explicit)
  IF p_lost_reason IS NOT NULL AND p_lost_reason != '' THEN
    RETURN 'lost';
  END IF;

  -- 4. Client approved
  IF p_client_approved_at IS NOT NULL THEN
    RETURN 'approved';
  END IF;

  -- 5. Pending internal approval
  IF p_approval_status = 'pending' THEN
    RETURN 'pending_approval';
  END IF;

  -- 6. Sent to client
  IF p_sent_at IS NOT NULL THEN
    -- Check if expired
    IF p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE THEN
      RETURN 'follow_up';  -- Expired quotes need follow-up
    END IF;
    -- Check if needs follow-up (sent > 3 days ago, no response)
    IF p_sent_at < (CURRENT_TIMESTAMP - INTERVAL '3 days') THEN
      RETURN 'follow_up';
    END IF;
    RETURN 'sent';
  END IF;

  -- 7. Default: draft
  RETURN 'draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- JOB STATUS: Computed from data state
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_job_status(
  p_invoiced_at TIMESTAMPTZ,
  p_work_completed_at TIMESTAMPTZ,
  p_work_started_at TIMESTAMPTZ,
  p_loaded_at TIMESTAMPTZ,
  p_staging_completed_at TIMESTAMPTZ,
  p_picking_started_at TIMESTAMPTZ,
  p_ready_for_yard_at TIMESTAMPTZ,
  p_scheduled_date DATE,
  p_assigned_crew_id UUID
) RETURNS TEXT AS $$
BEGIN
  -- Priority order: later states first

  -- 1. Invoiced
  IF p_invoiced_at IS NOT NULL THEN
    RETURN 'requires_invoicing';  -- Actually means "has been invoiced"
  END IF;

  -- 2. Work completed
  IF p_work_completed_at IS NOT NULL THEN
    RETURN 'completed';
  END IF;

  -- 3. Work in progress
  IF p_work_started_at IS NOT NULL THEN
    RETURN 'in_progress';
  END IF;

  -- 4. Loaded on truck
  IF p_loaded_at IS NOT NULL THEN
    RETURN 'loaded';
  END IF;

  -- 5. Materials staged
  IF p_staging_completed_at IS NOT NULL THEN
    RETURN 'staged';
  END IF;

  -- 6. Picking in progress
  IF p_picking_started_at IS NOT NULL THEN
    RETURN 'picking';
  END IF;

  -- 7. Ready for yard
  IF p_ready_for_yard_at IS NOT NULL THEN
    RETURN 'ready_for_yard';
  END IF;

  -- 8. Scheduled (has date AND crew)
  IF p_scheduled_date IS NOT NULL AND p_assigned_crew_id IS NOT NULL THEN
    RETURN 'scheduled';
  END IF;

  -- 9. Default: won (just created from quote)
  RETURN 'won';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- INVOICE STATUS: Computed from data state
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_invoice_status(
  p_balance_due NUMERIC,
  p_total NUMERIC,
  p_amount_paid NUMERIC,
  p_due_date DATE,
  p_sent_at TIMESTAMPTZ,
  p_archived_at TIMESTAMPTZ
) RETURNS TEXT AS $$
BEGIN
  -- 1. Bad debt (written off)
  IF p_archived_at IS NOT NULL THEN
    RETURN 'bad_debt';
  END IF;

  -- 2. Fully paid
  IF p_balance_due <= 0 OR p_amount_paid >= p_total THEN
    RETURN 'paid';
  END IF;

  -- 3. Past due
  IF p_sent_at IS NOT NULL AND p_due_date IS NOT NULL AND p_due_date < CURRENT_DATE THEN
    RETURN 'past_due';
  END IF;

  -- 4. Sent
  IF p_sent_at IS NOT NULL THEN
    RETURN 'sent';
  END IF;

  -- 5. Default: draft
  RETURN 'draft';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 3: AUTO-COMPUTE STATUS TRIGGERS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- REQUEST: Auto-compute status on INSERT/UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_compute_request_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
  v_old_status TEXT;
BEGIN
  v_old_status := OLD.status;

  v_new_status := compute_request_status(
    NEW.archived_at,
    NEW.converted_to_quote_id,
    NEW.converted_to_job_id,
    NEW.assessment_completed_at,
    NEW.assessment_scheduled_at,
    NEW.requires_assessment
  );

  -- Only update if status actually changed
  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
    NEW.status_changed_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_request_status ON service_requests;
CREATE TRIGGER trg_compute_request_status
  BEFORE INSERT OR UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_request_status();

-- -----------------------------------------------------------------------------
-- QUOTE: Auto-compute status on INSERT/UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_compute_quote_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  v_new_status := compute_quote_status(
    NEW.archived_at,
    NEW.converted_to_job_id,
    NEW.lost_reason,
    NEW.client_approved_at,
    NEW.approval_status,
    NEW.sent_at,
    NEW.valid_until
  );

  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
    NEW.status_changed_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_quote_status ON quotes;
CREATE TRIGGER trg_compute_quote_status
  BEFORE INSERT OR UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_quote_status();

-- -----------------------------------------------------------------------------
-- JOB: Auto-compute status on INSERT/UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_compute_job_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  v_new_status := compute_job_status(
    NEW.invoiced_at,
    NEW.work_completed_at,
    NEW.work_started_at,
    NEW.loaded_at,
    NEW.staging_completed_at,
    NEW.picking_started_at,
    NEW.ready_for_yard_at,
    NEW.scheduled_date,
    NEW.assigned_crew_id
  );

  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
    NEW.status_changed_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_job_status ON jobs;
CREATE TRIGGER trg_compute_job_status
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_job_status();

-- -----------------------------------------------------------------------------
-- INVOICE: Auto-compute status on INSERT/UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_compute_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  -- First recalculate balance_due from payments
  NEW.balance_due := NEW.total - NEW.amount_paid;

  v_new_status := compute_invoice_status(
    NEW.balance_due,
    NEW.total,
    NEW.amount_paid,
    NEW.due_date,
    NEW.sent_at,
    NULL  -- archived_at not yet implemented for invoices
  );

  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
    NEW.status_changed_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_invoice_status ON invoices;
CREATE TRIGGER trg_compute_invoice_status
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compute_invoice_status();

-- ============================================================================
-- PART 4: LIFECYCLE CASCADE TRIGGERS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- When a QUOTE is created with request_id → mark Request as converted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_quote_created_from_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_id IS NOT NULL THEN
    UPDATE service_requests
    SET converted_to_quote_id = NEW.id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.request_id
      AND converted_to_quote_id IS NULL;  -- Don't overwrite if already set
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_created_from_request ON quotes;
CREATE TRIGGER trg_quote_created_from_request
  AFTER INSERT ON quotes
  FOR EACH ROW
  WHEN (NEW.request_id IS NOT NULL)
  EXECUTE FUNCTION trigger_quote_created_from_request();

-- -----------------------------------------------------------------------------
-- When a JOB is created with quote_id → mark Quote as converted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_job_created_from_quote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_id IS NOT NULL THEN
    UPDATE quotes
    SET converted_to_job_id = NEW.id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.quote_id
      AND converted_to_job_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_created_from_quote ON jobs;
CREATE TRIGGER trg_job_created_from_quote
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.quote_id IS NOT NULL)
  EXECUTE FUNCTION trigger_job_created_from_quote();

-- -----------------------------------------------------------------------------
-- When a JOB is created with request_id (direct) → mark Request as converted
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_job_created_from_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_id IS NOT NULL AND NEW.quote_id IS NULL THEN
    UPDATE service_requests
    SET converted_to_job_id = NEW.id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.request_id
      AND converted_to_job_id IS NULL
      AND converted_to_quote_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_created_from_request ON jobs;
CREATE TRIGGER trg_job_created_from_request
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.request_id IS NOT NULL AND NEW.quote_id IS NULL)
  EXECUTE FUNCTION trigger_job_created_from_request();

-- -----------------------------------------------------------------------------
-- When an INVOICE is created with job_id → mark Job as invoiced
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_invoice_created_from_job()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    UPDATE jobs
    SET invoice_id = NEW.id,
        invoiced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.job_id
      AND invoice_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_created_from_job ON invoices;
CREATE TRIGGER trg_invoice_created_from_job
  AFTER INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.job_id IS NOT NULL)
  EXECUTE FUNCTION trigger_invoice_created_from_job();

-- -----------------------------------------------------------------------------
-- When PAYMENT is recorded → update Invoice amount_paid
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_payment_updates_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
BEGIN
  -- Calculate total paid for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Update invoice
  UPDATE invoices
  SET amount_paid = v_total_paid,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_updates_invoice ON payments;
CREATE TRIGGER trg_payment_updates_invoice
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_payment_updates_invoice();

-- ============================================================================
-- PART 5: AUTOMATIC STATUS HISTORY
-- ============================================================================

-- Ensure fsm_status_history table exists
CREATE TABLE IF NOT EXISTS fsm_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsm_status_history_entity
  ON fsm_status_history(entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Generic status history trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_record_status_history()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
BEGIN
  -- Determine entity type from table name
  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'service_requests' THEN 'request'
    WHEN 'quotes' THEN 'quote'
    WHEN 'jobs' THEN 'job'
    WHEN 'invoices' THEN 'invoice'
    ELSE TG_TABLE_NAME
  END;

  -- Only record if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO fsm_status_history (entity_type, entity_id, from_status, to_status, changed_by)
    VALUES (v_entity_type, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all FSM entities
DROP TRIGGER IF EXISTS trg_request_status_history ON service_requests;
CREATE TRIGGER trg_request_status_history
  AFTER UPDATE ON service_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_record_status_history();

DROP TRIGGER IF EXISTS trg_quote_status_history ON quotes;
CREATE TRIGGER trg_quote_status_history
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_record_status_history();

DROP TRIGGER IF EXISTS trg_job_status_history ON jobs;
CREATE TRIGGER trg_job_status_history
  AFTER UPDATE ON jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_record_status_history();

DROP TRIGGER IF EXISTS trg_invoice_status_history ON invoices;
CREATE TRIGGER trg_invoice_status_history
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trigger_record_status_history();

-- ============================================================================
-- PART 6: VALIDATION CONSTRAINTS
-- ============================================================================

-- Jobs must have a source (quote OR request, not orphan)
-- Note: Allowing NULL for both during transition period - can tighten later
-- ALTER TABLE jobs ADD CONSTRAINT chk_job_has_source
--   CHECK (quote_id IS NOT NULL OR request_id IS NOT NULL);

-- ============================================================================
-- PART 7: REFRESH FUNCTION FOR TIME-BASED STATUSES
-- ============================================================================
-- Call this daily via cron to update assessment_today → assessment_overdue

CREATE OR REPLACE FUNCTION refresh_time_based_statuses()
RETURNS TABLE(entity_type TEXT, entity_id UUID, old_status TEXT, new_status TEXT) AS $$
DECLARE
  r RECORD;
BEGIN
  -- Refresh request statuses (assessment_today → assessment_overdue)
  FOR r IN
    SELECT id, status AS old_status
    FROM service_requests
    WHERE status IN ('assessment_today', 'assessment_scheduled')
      AND assessment_scheduled_at IS NOT NULL
      AND assessment_completed_at IS NULL
      AND archived_at IS NULL
      AND converted_to_quote_id IS NULL
      AND converted_to_job_id IS NULL
  LOOP
    -- Touch the row to trigger status recomputation
    UPDATE service_requests
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = r.id;

    -- Return what changed
    SELECT sr.status INTO new_status
    FROM service_requests sr
    WHERE sr.id = r.id;

    IF r.old_status IS DISTINCT FROM new_status THEN
      entity_type := 'request';
      entity_id := r.id;
      old_status := r.old_status;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Refresh quote statuses (sent → follow_up after 3 days)
  FOR r IN
    SELECT id, status AS old_status
    FROM quotes
    WHERE status = 'sent'
      AND sent_at IS NOT NULL
      AND sent_at < (CURRENT_TIMESTAMP - INTERVAL '3 days')
      AND client_approved_at IS NULL
      AND lost_reason IS NULL
      AND converted_to_job_id IS NULL
  LOOP
    UPDATE quotes
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = r.id;

    SELECT q.status INTO new_status
    FROM quotes q
    WHERE q.id = r.id;

    IF r.old_status IS DISTINCT FROM new_status THEN
      entity_type := 'quote';
      entity_id := r.id;
      old_status := r.old_status;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Refresh invoice statuses (sent → past_due)
  FOR r IN
    SELECT id, status AS old_status
    FROM invoices
    WHERE status = 'sent'
      AND due_date IS NOT NULL
      AND due_date < CURRENT_DATE
      AND balance_due > 0
  LOOP
    UPDATE invoices
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = r.id;

    SELECT i.status INTO new_status
    FROM invoices i
    WHERE i.id = r.id;

    IF r.old_status IS DISTINCT FROM new_status THEN
      entity_type := 'invoice';
      entity_id := r.id;
      old_status := r.old_status;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 8: MIGRATE EXISTING DATA
-- ============================================================================

-- Touch all existing records to recompute their status
-- This ensures existing data is consistent with new computed statuses
-- Note: WHERE id IS NOT NULL required for Supabase RLS compliance

UPDATE service_requests SET updated_at = CURRENT_TIMESTAMP WHERE id IS NOT NULL;
UPDATE quotes SET updated_at = CURRENT_TIMESTAMP WHERE id IS NOT NULL;
UPDATE jobs SET updated_at = CURRENT_TIMESTAMP WHERE id IS NOT NULL;
UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id IS NOT NULL;

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON FUNCTION compute_request_status IS
  'Computes request status from data state. Status is derived, not manually set.';
COMMENT ON FUNCTION compute_quote_status IS
  'Computes quote status from data state. Status is derived, not manually set.';
COMMENT ON FUNCTION compute_job_status IS
  'Computes job status from data state. Status is derived, not manually set.';
COMMENT ON FUNCTION compute_invoice_status IS
  'Computes invoice status from data state. Status is derived, not manually set.';
COMMENT ON FUNCTION refresh_time_based_statuses IS
  'Call daily via cron to update time-based statuses (assessment_today→overdue, sent→follow_up, etc.)';
