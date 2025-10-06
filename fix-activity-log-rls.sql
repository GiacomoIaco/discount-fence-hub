-- Fix RLS policy for request_activity_log to allow trigger inserts
-- This allows the database trigger to create activity logs when requests are updated

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view activity for their requests" ON request_activity_log;
DROP POLICY IF EXISTS "Users can create activity for their requests" ON request_activity_log;
DROP POLICY IF EXISTS "Service role can insert activity logs" ON request_activity_log;

-- Policy for viewing activity logs
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

-- Policy for creating activity logs (for manual inserts from app)
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

-- Policy to allow database triggers to insert (bypasses user context)
CREATE POLICY "Service role can insert activity logs"
ON request_activity_log
FOR INSERT
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE request_activity_log ENABLE ROW LEVEL SECURITY;
