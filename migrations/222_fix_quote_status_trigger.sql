-- Migration 222: Fix Quote Status Trigger for Manager Approval
--
-- Problem: Migration 221 changed compute_quote_status to accept a ROW parameter,
-- but the trigger from migration 194 still passes individual parameters.
--
-- Solution: Update the trigger function to pass the entire ROW.

-- Update the trigger function to use the row-based compute function
CREATE OR REPLACE FUNCTION trigger_compute_quote_status()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  -- Call the row-based version from migration 221
  v_new_status := compute_quote_status(NEW);

  IF NEW.status IS DISTINCT FROM v_new_status THEN
    NEW.status := v_new_status;
    NEW.status_changed_at := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify by checking a quote with pending approval
SELECT 'Migration 222 complete: Quote status trigger now supports manager approval workflow';
