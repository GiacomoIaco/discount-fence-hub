-- Direct Messaging System with @Mentions
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE DIRECT MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);

-- ============================================
-- 2. CREATE CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- ============================================
-- 3. CREATE CONVERSATION PARTICIPANTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);

-- ============================================
-- 4. CREATE MENTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
  request_note_id UUID REFERENCES request_notes(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  CONSTRAINT mentions_source_check CHECK (
    (message_id IS NOT NULL AND request_note_id IS NULL) OR
    (message_id IS NULL AND request_note_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mentions_mentioned_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_message ON mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_request_note ON mentions(request_note_id);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

-- Direct Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON direct_messages;
CREATE POLICY "Users can view messages in their conversations"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = direct_messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their conversations" ON direct_messages;
CREATE POLICY "Users can send messages to their conversations"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = direct_messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON direct_messages;
CREATE POLICY "Users can update their own messages"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid());

-- Conversations Policies
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
      AND conversation_participants.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Conversation Participants Policies
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add themselves to conversations" ON conversation_participants;
CREATE POLICY "Users can add themselves to conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own participation" ON conversation_participants;
CREATE POLICY "Users can update their own participation"
  ON conversation_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Mentions Policies
DROP POLICY IF EXISTS "Users can view mentions about them" ON mentions;
CREATE POLICY "Users can view mentions about them"
  ON mentions FOR SELECT
  TO authenticated
  USING (
    mentioned_user_id = auth.uid() OR
    mentioner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can create mentions" ON mentions;
CREATE POLICY "Users can create mentions"
  ON mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their mention read status" ON mentions;
CREATE POLICY "Users can update their mention read status"
  ON mentions FOR UPDATE
  TO authenticated
  USING (mentioned_user_id = auth.uid());

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get or create a direct conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_conversation UUID;
  new_conversation UUID;
BEGIN
  -- Check if a conversation already exists between these two users
  SELECT cp1.conversation_id INTO existing_conversation
  FROM conversation_participants cp1
  INNER JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND (
      SELECT COUNT(*) FROM conversation_participants cp3
      WHERE cp3.conversation_id = cp1.conversation_id
    ) = 2;

  IF existing_conversation IS NOT NULL THEN
    RETURN existing_conversation;
  END IF;

  -- Create new conversation
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO new_conversation;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (new_conversation, auth.uid()), (new_conversation, other_user_id);

  RETURN new_conversation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_direct_messages_count()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT dm.id) INTO unread_count
  FROM direct_messages dm
  INNER JOIN conversation_participants cp ON cp.conversation_id = dm.conversation_id
  WHERE cp.user_id = auth.uid()
    AND dm.sender_id != auth.uid()
    AND dm.created_at > cp.last_read_at
    AND dm.is_deleted = FALSE;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(conv_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = conv_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread mentions count
CREATE OR REPLACE FUNCTION get_unread_mentions_count()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM mentions
  WHERE mentioned_user_id = auth.uid()
    AND is_read = FALSE;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Update conversation last_message_at when new message is sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON direct_messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Direct messaging system installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Direct messages between users';
  RAISE NOTICE '• Conversation threads';
  RAISE NOTICE '• @mentions with notifications';
  RAISE NOTICE '• Unread message tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - get_or_create_direct_conversation(user_id)';
  RAISE NOTICE '  - get_unread_direct_messages_count()';
  RAISE NOTICE '  - mark_conversation_read(conversation_id)';
  RAISE NOTICE '  - get_unread_mentions_count()';
END $$;
