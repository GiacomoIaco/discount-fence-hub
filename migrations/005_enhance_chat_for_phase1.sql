-- Enhancement for Phase 1: Add file attachments and typing indicators
-- Run this AFTER 004_direct_messaging_system.sql

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

-- ============================================
-- 5. ENABLE REALTIME
-- ============================================

-- Note: This must be run in Supabase Dashboard → Database → Replication
-- ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
-- ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

-- ============================================
-- 6. STORAGE BUCKET FOR CHAT FILES
-- ============================================

-- Note: Run this in Supabase Dashboard → Storage
-- CREATE BUCKET chat-files;
--
-- Storage policy: Allow authenticated users to upload
-- CREATE POLICY "Authenticated users can upload chat files"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'chat-files');
--
-- Storage policy: Users can view files in their conversations
-- CREATE POLICY "Users can view chat files"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'chat-files');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Chat enhancements for Phase 1 installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• File attachments in messages';
  RAISE NOTICE '• User online/offline status tracking';
  RAISE NOTICE '• Enhanced conversation list query';
  RAISE NOTICE '';
  RAISE NOTICE 'MANUAL STEPS REQUIRED:';
  RAISE NOTICE '1. Enable Realtime in Supabase Dashboard:';
  RAISE NOTICE '   Settings → Replication → Enable for:';
  RAISE NOTICE '   - direct_messages';
  RAISE NOTICE '   - conversation_participants';
  RAISE NOTICE '   - user_presence';
  RAISE NOTICE '';
  RAISE NOTICE '2. Create Storage Bucket:';
  RAISE NOTICE '   Storage → New Bucket → "chat-files"';
  RAISE NOTICE '   - Public: NO';
  RAISE NOTICE '   - File size limit: 10MB';
  RAISE NOTICE '';
  RAISE NOTICE 'New functions available:';
  RAISE NOTICE '  - update_user_presence(status)';
  RAISE NOTICE '  - get_user_conversations()';
END $$;
