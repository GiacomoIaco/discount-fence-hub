-- Fix infinite recursion in request_watchers RLS policies
-- The original policies referenced request_watchers inside the check, causing recursion

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view watchers for accessible requests" ON request_watchers;
DROP POLICY IF EXISTS "Authorized users can add watchers" ON request_watchers;
DROP POLICY IF EXISTS "Users can remove watchers appropriately" ON request_watchers;

-- Recreated simplified policies that don't cause recursion

-- Users can view watchers for requests they have access to
-- Simplified: don't check if user is already a watcher (that would cause recursion)
CREATE POLICY "Users can view watchers for accessible requests"
  ON request_watchers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_id
      AND (
        r.submitter_id = auth.uid()
        OR r.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'operations'))
      )
    )
    -- Also allow user to see entries where they are the watcher (direct check, no subquery)
    OR user_id = auth.uid()
  );

-- Users can add watchers to requests they own, are assigned to, or are admin/operations
CREATE POLICY "Authorized users can add watchers"
  ON request_watchers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_id
      AND (
        r.submitter_id = auth.uid()
        OR r.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'operations'))
      )
    )
  );

-- Users can remove themselves as watchers, or admins/owners can remove others
CREATE POLICY "Users can remove watchers appropriately"
  ON request_watchers FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Can always remove yourself
    OR EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_id
      AND (
        r.submitter_id = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'operations'))
      )
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Request watchers RLS policies fixed!';
  RAISE NOTICE 'Removed recursive checks that were causing infinite recursion.';
END $$;
