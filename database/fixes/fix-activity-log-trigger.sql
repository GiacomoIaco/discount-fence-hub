-- Better fix: Make the trigger function run with SECURITY DEFINER
-- This allows the trigger to bypass RLS policies safely

-- First, let's remove the overly permissive policy we just added
DROP POLICY IF EXISTS "Service role can insert activity logs" ON request_activity_log;

-- Recreate the trigger function with SECURITY DEFINER
-- This makes it run with the permissions of the function owner (postgres/service role)
CREATE OR REPLACE FUNCTION log_request_activity()
RETURNS TRIGGER
SECURITY DEFINER  -- This is the key change
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log assignment changes
  IF (TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO request_activity_log (request_id, action, user_id, details)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.assigned_to IS NULL THEN 'unassigned'
        ELSE 'assigned'
      END,
      auth.uid(),
      jsonb_build_object(
        'message',
        CASE
          WHEN NEW.assigned_to IS NULL THEN 'Request unassigned'
          ELSE 'Request assigned'
        END
      )
    );
  END IF;

  -- Log stage changes
  IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO request_activity_log (request_id, action, user_id, details)
    VALUES (
      NEW.id,
      'stage_changed',
      auth.uid(),
      jsonb_build_object(
        'from', OLD.stage,
        'to', NEW.stage,
        'message', 'Stage changed from ' || OLD.stage || ' to ' || NEW.stage
      )
    );
  END IF;

  -- Log quote status changes
  IF (TG_OP = 'UPDATE' AND OLD.quote_status IS DISTINCT FROM NEW.quote_status) THEN
    INSERT INTO request_activity_log (request_id, action, user_id, details)
    VALUES (
      NEW.id,
      'quote_status_changed',
      auth.uid(),
      jsonb_build_object(
        'from', OLD.quote_status,
        'to', NEW.quote_status,
        'message', 'Quote status changed to ' || COALESCE(NEW.quote_status, 'none')
      )
    );
  END IF;

  -- Log creation
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO request_activity_log (request_id, action, user_id, details)
    VALUES (
      NEW.id,
      'created',
      auth.uid(),
      jsonb_build_object('message', 'Request created')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Keep the user-level policies for manual inserts from the app
-- These are more restrictive and appropriate for direct app usage

-- Drop and recreate to ensure they're correct
DROP POLICY IF EXISTS "Users can view activity for their requests" ON request_activity_log;
CREATE POLICY "Users can view activity for their requests"
ON request_activity_log
FOR SELECT
USING (
  request_id IN (
    SELECT id FROM requests
    WHERE submitter_id = auth.uid()
    OR assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create activity for their requests" ON request_activity_log;
CREATE POLICY "Users can create activity for their requests"
ON request_activity_log
FOR INSERT
WITH CHECK (
  request_id IN (
    SELECT id FROM requests
    WHERE submitter_id = auth.uid()
    OR assigned_to = auth.uid()
  )
);

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS log_request_changes ON requests;
CREATE TRIGGER log_request_changes
  AFTER INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_activity();
