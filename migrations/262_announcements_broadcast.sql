-- ============================================================================
-- UNIFIED COMMUNICATION HUB - PHASE 6: Announcements as Broadcast Threads
-- Adds support for announcements within the mc_conversations/mc_messages system
-- ============================================================================

-- ============================================================================
-- 1. ADD ANNOUNCEMENT MESSAGE TYPE
-- ============================================================================

-- Add announcement_type column to mc_messages for message subtypes
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Add metadata column for rich announcement content (surveys, polls, etc.)
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS announcement_metadata JSONB;

-- ============================================================================
-- 2. ADD ACKNOWLEDGMENT TRACKING
-- ============================================================================

-- Table for tracking who has acknowledged/read announcements
CREATE TABLE IF NOT EXISTS mc_message_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES mc_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
  -- Optional: Response for surveys/polls
  response JSONB,
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_message_ack_message ON mc_message_acknowledgments(message_id);
CREATE INDEX IF NOT EXISTS idx_mc_message_ack_user ON mc_message_acknowledgments(user_id);

-- ============================================================================
-- 3. CREATE HELPER FUNCTION TO CREATE ANNOUNCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION create_announcement(
  p_title TEXT,
  p_body TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_target_roles TEXT[] DEFAULT NULL,
  p_from_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
  v_message_id UUID;
  v_from_user UUID := COALESCE(p_from_user_id, auth.uid());
BEGIN
  -- Create announcement conversation
  INSERT INTO mc_conversations (
    conversation_type,
    title,
    is_broadcast,
    target_roles,
    status,
    created_by
  )
  VALUES (
    'announcement',
    p_title,
    true,
    p_target_roles,
    'active',
    v_from_user
  )
  RETURNING id INTO v_conv_id;

  -- Create the announcement message
  INSERT INTO mc_messages (
    conversation_id,
    channel,
    direction,
    body,
    message_type,
    from_user_id,
    status,
    sent_at,
    announcement_metadata
  )
  VALUES (
    v_conv_id,
    'in_app',
    'outbound',
    p_body,
    p_message_type,
    v_from_user,
    'sent',
    NOW(),
    p_metadata
  )
  RETURNING id INTO v_message_id;

  -- Update conversation with last message info
  UPDATE mc_conversations
  SET
    last_message_at = NOW(),
    last_message_preview = LEFT(p_body, 100)
  WHERE id = v_conv_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CREATE HELPER FUNCTION TO ACKNOWLEDGE ANNOUNCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION acknowledge_announcement(
  p_message_id UUID,
  p_response JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO mc_message_acknowledgments (message_id, user_id, response)
  VALUES (p_message_id, auth.uid(), p_response)
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    acknowledged_at = NOW(),
    response = COALESCE(EXCLUDED.response, mc_message_acknowledgments.response);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE VIEW FOR USER'S ANNOUNCEMENTS
-- ============================================================================

CREATE OR REPLACE VIEW user_announcements AS
SELECT
  m.id as message_id,
  c.id as conversation_id,
  c.title,
  m.body,
  m.message_type,
  m.announcement_metadata,
  m.from_user_id,
  up.full_name as author_name,
  up.avatar_url as author_avatar,
  m.created_at,
  c.target_roles,
  EXISTS (
    SELECT 1 FROM mc_message_acknowledgments ack
    WHERE ack.message_id = m.id AND ack.user_id = auth.uid()
  ) as is_acknowledged,
  (
    SELECT ack.acknowledged_at
    FROM mc_message_acknowledgments ack
    WHERE ack.message_id = m.id AND ack.user_id = auth.uid()
    LIMIT 1
  ) as acknowledged_at,
  (
    SELECT COUNT(*)
    FROM mc_message_acknowledgments ack
    WHERE ack.message_id = m.id
  ) as acknowledgment_count
FROM mc_messages m
JOIN mc_conversations c ON c.id = m.conversation_id
LEFT JOIN user_profiles up ON up.id = m.from_user_id
WHERE c.conversation_type = 'announcement'
  AND c.is_broadcast = true
  AND c.status = 'active';

-- ============================================================================
-- 6. CREATE FUNCTION TO GET USER'S UNREAD ANNOUNCEMENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_announcements(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  title TEXT,
  body TEXT,
  message_type TEXT,
  author_name TEXT,
  created_at TIMESTAMPTZ,
  target_roles TEXT[]
) AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_user_role TEXT;
BEGIN
  -- Get user's role for filtering
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT
    m.id as message_id,
    c.id as conversation_id,
    c.title,
    m.body,
    m.message_type,
    up.full_name as author_name,
    m.created_at,
    c.target_roles
  FROM mc_messages m
  JOIN mc_conversations c ON c.id = m.conversation_id
  LEFT JOIN user_profiles up ON up.id = m.from_user_id
  WHERE c.conversation_type = 'announcement'
    AND c.is_broadcast = true
    AND c.status = 'active'
    -- Not yet acknowledged by this user
    AND NOT EXISTS (
      SELECT 1 FROM mc_message_acknowledgments ack
      WHERE ack.message_id = m.id AND ack.user_id = v_user_id
    )
    -- Either no target roles (broadcast to all) or user's role is in target
    AND (
      c.target_roles IS NULL
      OR array_length(c.target_roles, 1) IS NULL
      OR v_user_role = ANY(c.target_roles)
    )
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 7. RLS POLICIES FOR ACKNOWLEDGMENTS
-- ============================================================================

ALTER TABLE mc_message_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view acknowledgments" ON mc_message_acknowledgments;
CREATE POLICY "Users can view acknowledgments"
  ON mc_message_acknowledgments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can acknowledge messages" ON mc_message_acknowledgments;
CREATE POLICY "Users can acknowledge messages"
  ON mc_message_acknowledgments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own acknowledgments" ON mc_message_acknowledgments;
CREATE POLICY "Users can update their own acknowledgments"
  ON mc_message_acknowledgments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON COLUMN mc_messages.message_type IS 'Type of message: text, survey, poll, recognition, alert';
COMMENT ON COLUMN mc_messages.announcement_metadata IS 'Rich metadata for announcements (survey options, poll choices, etc.)';
COMMENT ON TABLE mc_message_acknowledgments IS 'Tracks user acknowledgments of announcements';
COMMENT ON FUNCTION create_announcement IS 'Creates a new broadcast announcement';
COMMENT ON FUNCTION acknowledge_announcement IS 'Acknowledges an announcement for the current user';
COMMENT ON VIEW user_announcements IS 'All announcements visible to users with read status';
COMMENT ON FUNCTION get_unread_announcements IS 'Returns unread announcements for a user, filtered by role';

SELECT 'Migration 262 complete: Announcements as broadcast threads ready';
