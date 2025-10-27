-- ============================================
-- FIX: Column Name Conflict in get_user_conversations
-- ============================================
-- The function has ambiguous column references.
-- This fixes it by fully qualifying all column names.

DROP FUNCTION IF EXISTS get_user_conversations();

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
    c.id,                                            -- Changed: removed 'as conversation_id'
    up.id,                                           -- Changed: removed 'as other_user_id'
    up.full_name,                                    -- Changed: removed 'as other_user_name'
    au.email,                                        -- Changed: removed 'as other_user_email'
    COALESCE(presence.status, 'offline')::TEXT,     -- Changed: removed 'as other_user_status', added ::TEXT cast
    dm_last.content,                                 -- Changed: removed 'as last_message'
    c.last_message_at,                               -- Same
    COUNT(dm.id) FILTER (
      WHERE dm.created_at > cp.last_read_at
      AND dm.sender_id != auth.uid()
      AND dm.is_deleted = FALSE
    ),                                               -- Changed: removed 'as unread_count'
    cp.last_read_at                                  -- Same
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
    FROM direct_messages dm_inner
    WHERE dm_inner.conversation_id = c.id
      AND dm_inner.is_deleted = FALSE
    ORDER BY dm_inner.created_at DESC
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

-- Test it
SELECT * FROM get_user_conversations();

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Function fixed and recreated!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Go to Settings → API → Refresh Schema Cache';
  RAISE NOTICE '2. Wait 30 seconds';
  RAISE NOTICE '3. Reload app and test Chat';
END $$;
