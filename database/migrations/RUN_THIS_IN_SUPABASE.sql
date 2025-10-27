-- ============================================
-- COMPLETE MIGRATION 005 - RUN THIS IN SUPABASE
-- ============================================
-- This script creates everything needed for Phase 1 chat

-- ============================================
-- 1. ADD FILE ATTACHMENTS TO MESSAGES
-- ============================================

ALTER TABLE direct_messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Index for messages with files
CREATE INDEX IF NOT EXISTS idx_direct_messages_with_files
  ON direct_messages(conversation_id)
  WHERE file_url IS NOT NULL;

-- ============================================
-- 2. ADD ONLINE STATUS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying online users
CREATE INDEX IF NOT EXISTS idx_user_presence_status
  ON user_presence(status, last_seen_at);

-- RLS for user presence
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view user presence" ON user_presence;
CREATE POLICY "Anyone can view user presence"
  ON user_presence FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own presence" ON user_presence;
CREATE POLICY "Users can update their own presence"
  ON user_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their presence" ON user_presence;
CREATE POLICY "Users can update their presence"
  ON user_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. HELPER FUNCTION: UPDATE USER PRESENCE
-- ============================================

CREATE OR REPLACE FUNCTION update_user_presence(new_status TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
  VALUES (auth.uid(), new_status, NOW(), NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = new_status,
    last_seen_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION update_user_presence(TEXT) TO authenticated;

-- ============================================
-- 4. FUNCTION: GET CONVERSATION WITH DETAILS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_conversations()
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_email TEXT,
  other_user_status TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  last_read_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as conversation_id,
    up.id as other_user_id,
    up.full_name as other_user_name,
    au.email as other_user_email,
    COALESCE(presence.status, 'offline') as other_user_status,
    dm_last.content as last_message,
    c.last_message_at,
    COUNT(dm.id) FILTER (
      WHERE dm.created_at > cp.last_read_at
      AND dm.sender_id != auth.uid()
      AND dm.is_deleted = FALSE
    ) as unread_count,
    cp.last_read_at
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
  INNER JOIN conversation_participants cp_other
    ON cp_other.conversation_id = c.id
    AND cp_other.user_id != auth.uid()
  INNER JOIN user_profiles up ON up.id = cp_other.user_id
  INNER JOIN auth.users au ON au.id = up.id
  LEFT JOIN user_presence presence ON presence.user_id = up.id
  LEFT JOIN LATERAL (
    SELECT content
    FROM direct_messages
    WHERE conversation_id = c.id
      AND is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  ) dm_last ON true
  LEFT JOIN direct_messages dm ON dm.conversation_id = c.id
  WHERE cp.user_id = auth.uid()
    AND cp.is_archived = FALSE
  GROUP BY
    c.id,
    up.id,
    up.full_name,
    au.email,
    presence.status,
    dm_last.content,
    c.last_message_at,
    cp.last_read_at
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;

-- ============================================
-- 5. TEST THE FUNCTION
-- ============================================

-- This should work now (returns empty list since no conversations exist)
SELECT * FROM get_user_conversations();

-- ============================================
-- 6. NOTIFY POSTGREST TO RELOAD
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 005 COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  ✓ File attachment columns on direct_messages';
  RAISE NOTICE '  ✓ user_presence table with RLS policies';
  RAISE NOTICE '  ✓ update_user_presence() function';
  RAISE NOTICE '  ✓ get_user_conversations() function';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS (Do these manually):';
  RAISE NOTICE '';
  RAISE NOTICE '1. Enable Realtime:';
  RAISE NOTICE '   Dashboard → Database → Replication';
  RAISE NOTICE '   Toggle ON for these tables:';
  RAISE NOTICE '   • direct_messages';
  RAISE NOTICE '   • conversation_participants';
  RAISE NOTICE '   • user_presence';
  RAISE NOTICE '';
  RAISE NOTICE '2. Create Storage Bucket:';
  RAISE NOTICE '   Dashboard → Storage → New Bucket';
  RAISE NOTICE '   Name: chat-files';
  RAISE NOTICE '   Public: NO';
  RAISE NOTICE '   File size limit: 10MB';
  RAISE NOTICE '';
  RAISE NOTICE '3. Refresh API Schema Cache:';
  RAISE NOTICE '   Dashboard → Settings → API';
  RAISE NOTICE '   Click "Refresh now" button';
  RAISE NOTICE '';
  RAISE NOTICE '4. Test the app:';
  RAISE NOTICE '   Wait 30 seconds, reload app, click Chat';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
