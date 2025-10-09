-- ============================================
-- FIX: Duplicate Group Conversations in List
-- ============================================
-- The issue: LEFT JOIN on cp_other creates multiple rows for group chats
-- Solution: Use DISTINCT ON to return only one row per conversation

DROP FUNCTION IF EXISTS get_user_conversations();

CREATE FUNCTION get_user_conversations()
RETURNS TABLE (
  conversation_id UUID,
  conversation_name TEXT,
  is_group BOOLEAN,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_email TEXT,
  other_user_status TEXT,
  participant_count BIGINT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  last_read_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (c.id)
    c.id::UUID,
    c.name::TEXT,
    COALESCE(c.is_group, false)::BOOLEAN,
    up.id::UUID,
    up.full_name::TEXT,
    au.email::TEXT,
    COALESCE(presence.status, 'offline')::TEXT,
    (SELECT COUNT(*)::BIGINT FROM conversation_participants cp_count
     WHERE cp_count.conversation_id = c.id),
    dm_last.content::TEXT,
    c.last_message_at::TIMESTAMPTZ,
    COALESCE(COUNT(dm.id) FILTER (
      WHERE dm.sender_id != auth.uid()
        AND dm.created_at > cp.last_read_at
        AND dm.is_deleted = FALSE
    ), 0)::BIGINT,
    cp.last_read_at::TIMESTAMPTZ
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
  LEFT JOIN conversation_participants cp_other
    ON cp_other.conversation_id = c.id
    AND cp_other.user_id != auth.uid()
  LEFT JOIN user_profiles up ON up.id = cp_other.user_id
  LEFT JOIN auth.users au ON au.id = cp_other.user_id
  LEFT JOIN user_presence presence ON presence.user_id = cp_other.user_id
  LEFT JOIN direct_messages dm
    ON dm.conversation_id = c.id
    AND dm.created_at > cp.last_read_at
    AND dm.sender_id != auth.uid()
    AND dm.is_deleted = FALSE
  LEFT JOIN LATERAL (
    SELECT content FROM direct_messages dm2
    WHERE dm2.conversation_id = c.id
      AND dm2.is_deleted = FALSE
    ORDER BY dm2.created_at DESC
    LIMIT 1
  ) dm_last ON true
  WHERE cp.user_id = auth.uid()
    AND cp.is_archived = FALSE
  GROUP BY
    c.id,
    c.name,
    c.is_group,
    up.id,
    up.full_name,
    au.email,
    presence.status,
    dm_last.content,
    c.last_message_at,
    cp.last_read_at
  ORDER BY c.id, c.last_message_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Test the fix
SELECT conversation_id, conversation_name, is_group, participant_count
FROM get_user_conversations()
ORDER BY last_message_at DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Duplicate Groups Fixed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Each conversation now appears only once';
  RAISE NOTICE 'Refresh your app to see the fix';
  RAISE NOTICE '========================================';
END $$;
