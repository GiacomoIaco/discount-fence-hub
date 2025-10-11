-- ============================================
-- PHASE 2: Group Conversations
-- ============================================
-- Adds support for group conversations with custom names

-- ============================================
-- 1. ALTER CONVERSATIONS TABLE
-- ============================================

-- Add name and is_group columns to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_conversations_is_group ON conversations(is_group);

-- ============================================
-- 2. CREATE GROUP CONVERSATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION create_group_conversation(
  conversation_name TEXT,
  participant_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  new_conversation UUID;
  participant_id UUID;
BEGIN
  -- Validate that we have at least 2 participants (including creator)
  IF array_length(participant_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Group conversation must have at least 2 participants';
  END IF;

  -- Create new group conversation
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (conversation_name, true, auth.uid())
  RETURNING id INTO new_conversation;

  -- Add creator as participant
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (new_conversation, auth.uid());

  -- Add all other participants
  FOREACH participant_id IN ARRAY participant_ids
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (new_conversation, participant_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN new_conversation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. UPDATE get_user_conversations FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_user_conversations()
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
  SELECT
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
  ORDER BY c.last_message_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 4. FUNCTION TO GET GROUP PARTICIPANTS
-- ============================================

CREATE OR REPLACE FUNCTION get_conversation_participants(conv_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id::UUID,
    up.full_name::TEXT,
    au.email::TEXT,
    COALESCE(presence.status, 'offline')::TEXT
  FROM conversation_participants cp
  INNER JOIN user_profiles up ON up.id = cp.user_id
  LEFT JOIN auth.users au ON au.id = cp.user_id
  LEFT JOIN user_presence presence ON presence.user_id = cp.user_id
  WHERE cp.conversation_id = conv_id
  ORDER BY up.full_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 5. UPDATE RLS POLICIES (if needed)
-- ============================================

-- Conversations policies already allow creation and viewing
-- No changes needed since we're using permissive policies

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PHASE 2: Group Conversations Ready!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Create group conversations with custom names';
  RAISE NOTICE '• Add multiple participants to a conversation';
  RAISE NOTICE '• View all participants in a group';
  RAISE NOTICE '';
  RAISE NOTICE 'New functions:';
  RAISE NOTICE '  - create_group_conversation(name, participant_ids[])';
  RAISE NOTICE '  - get_conversation_participants(conversation_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated functions:';
  RAISE NOTICE '  - get_user_conversations() now includes group info';
  RAISE NOTICE '========================================';
END $$;
