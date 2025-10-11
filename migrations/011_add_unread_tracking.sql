-- Add unread message tracking for requests
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE REQUEST VIEWS TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_request_views_request_id ON request_views(request_id);
CREATE INDEX IF NOT EXISTS idx_request_views_user_id ON request_views(user_id);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE request_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own request views" ON request_views;
CREATE POLICY "Users can view their own request views"
  ON request_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own request views" ON request_views;
CREATE POLICY "Users can insert their own request views"
  ON request_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own request views" ON request_views;
CREATE POLICY "Users can update their own request views"
  ON request_views FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. FUNCTION TO GET UNREAD COUNT
-- ============================================

CREATE OR REPLACE FUNCTION get_unread_count(req_id UUID, usr_id UUID)
RETURNS INTEGER AS $$
DECLARE
  last_view TIMESTAMPTZ;
  unread_count INTEGER;
BEGIN
  -- Get the last time user viewed this request
  SELECT last_viewed_at INTO last_view
  FROM request_views
  WHERE request_id = req_id AND user_id = usr_id;

  -- If never viewed, count all notes
  IF last_view IS NULL THEN
    SELECT COUNT(*) INTO unread_count
    FROM request_notes
    WHERE request_id = req_id;
  ELSE
    -- Count notes created after last view
    SELECT COUNT(*) INTO unread_count
    FROM request_notes
    WHERE request_id = req_id
    AND created_at > last_view
    AND user_id != usr_id; -- Don't count user's own messages
  END IF;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. FUNCTION TO MARK REQUEST AS VIEWED
-- ============================================

CREATE OR REPLACE FUNCTION mark_request_viewed(req_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO request_views (request_id, user_id, last_viewed_at)
  VALUES (req_id, auth.uid(), NOW())
  ON CONFLICT (request_id, user_id)
  DO UPDATE SET last_viewed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Unread message tracking installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Track when users last viewed requests';
  RAISE NOTICE '• Count unread messages per request';
  RAISE NOTICE '• Helper functions: get_unread_count() and mark_request_viewed()';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT get_unread_count(request_id, user_id) AS unread_count;';
  RAISE NOTICE '  SELECT mark_request_viewed(request_id);';
END $$;
