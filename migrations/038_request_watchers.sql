-- Add request watchers feature
-- Allows adding additional users to a request who can see it and get notified of changes
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE REQUEST WATCHERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  -- Notification preferences for this watcher
  notify_on_comments BOOLEAN DEFAULT TRUE,
  notify_on_status_change BOOLEAN DEFAULT TRUE,
  notify_on_assignment BOOLEAN DEFAULT TRUE,
  UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_request_watchers_request_id ON request_watchers(request_id);
CREATE INDEX IF NOT EXISTS idx_request_watchers_user_id ON request_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_request_watchers_user_request ON request_watchers(user_id, request_id);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE request_watchers ENABLE ROW LEVEL SECURITY;

-- Users can view watchers for requests they have access to
DROP POLICY IF EXISTS "Users can view watchers for accessible requests" ON request_watchers;
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
        OR EXISTS (SELECT 1 FROM request_watchers rw WHERE rw.request_id = r.id AND rw.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'operations'))
      )
    )
  );

-- Users can add watchers to requests they own, are assigned to, or are admin/operations
DROP POLICY IF EXISTS "Authorized users can add watchers" ON request_watchers;
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
DROP POLICY IF EXISTS "Users can remove watchers appropriately" ON request_watchers;
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

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Function to add a watcher to a request
CREATE OR REPLACE FUNCTION add_request_watcher(
  req_id UUID,
  watcher_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO request_watchers (request_id, user_id, added_by)
  VALUES (req_id, watcher_id, auth.uid())
  ON CONFLICT (request_id, user_id) DO NOTHING;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a watcher from a request
CREATE OR REPLACE FUNCTION remove_request_watcher(
  req_id UUID,
  watcher_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM request_watchers
  WHERE request_id = req_id AND user_id = watcher_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all requests a user is watching
CREATE OR REPLACE FUNCTION get_watched_requests(usr_id UUID)
RETURNS TABLE(request_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT rw.request_id
  FROM request_watchers rw
  WHERE rw.user_id = usr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. UPDATE REQUESTS QUERY TO INCLUDE WATCHED
-- ============================================

-- Create a view for requests including watcher status
CREATE OR REPLACE VIEW requests_with_access AS
SELECT
  r.*,
  CASE
    WHEN r.submitter_id = auth.uid() THEN 'submitter'
    WHEN r.assigned_to = auth.uid() THEN 'assignee'
    WHEN EXISTS (SELECT 1 FROM request_watchers rw WHERE rw.request_id = r.id AND rw.user_id = auth.uid()) THEN 'watcher'
    ELSE 'viewer'
  END as access_type
FROM requests r
WHERE
  r.submitter_id = auth.uid()
  OR r.assigned_to = auth.uid()
  OR EXISTS (SELECT 1 FROM request_watchers rw WHERE rw.request_id = r.id AND rw.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role IN ('admin', 'operations'));

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Request watchers feature installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Add additional users as watchers to requests';
  RAISE NOTICE '• Watchers can see and follow request updates';
  RAISE NOTICE '• Notification preferences per watcher';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT add_request_watcher(request_id, user_id);';
  RAISE NOTICE '  SELECT remove_request_watcher(request_id, user_id);';
END $$;
