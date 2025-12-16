-- ============================================================================
-- GROUP CONVERSATIONS SUPPORT
-- Allows multiple participants in a conversation (like Workiz)
-- ============================================================================

-- Conversation Participants - Junction table for group conversations
CREATE TABLE IF NOT EXISTS mc_conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES mc_contacts(id) ON DELETE CASCADE,
  -- Role in conversation
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  -- Notifications
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,
  -- When they joined/left
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  added_by UUID REFERENCES auth.users(id),
  -- Unique constraint - a contact can only be in a conversation once
  CONSTRAINT unique_participant UNIQUE (conversation_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_participants_conversation ON mc_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mc_participants_contact ON mc_conversation_participants(contact_id);

-- RLS policies for participants
ALTER TABLE mc_conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all participants" ON mc_conversation_participants;
DROP POLICY IF EXISTS "Users can insert participants" ON mc_conversation_participants;
DROP POLICY IF EXISTS "Users can update participants" ON mc_conversation_participants;
DROP POLICY IF EXISTS "Users can delete participants" ON mc_conversation_participants;

CREATE POLICY "Users can view all participants" ON mc_conversation_participants FOR SELECT USING (true);
CREATE POLICY "Users can insert participants" ON mc_conversation_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update participants" ON mc_conversation_participants FOR UPDATE USING (true);
CREATE POLICY "Users can delete participants" ON mc_conversation_participants FOR DELETE USING (true);

-- Add group-specific fields to conversations
ALTER TABLE mc_conversations
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS group_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 1;

-- Function to update participant count
CREATE OR REPLACE FUNCTION update_conversation_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE mc_conversations
    SET participant_count = (
      SELECT COUNT(*) FROM mc_conversation_participants
      WHERE conversation_id = NEW.conversation_id AND left_at IS NULL
    )
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE mc_conversations
    SET participant_count = (
      SELECT COUNT(*) FROM mc_conversation_participants
      WHERE conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id) AND left_at IS NULL
    )
    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
    RETURN COALESCE(NEW, OLD);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_participant_count ON mc_conversation_participants;
CREATE TRIGGER trg_update_participant_count
AFTER INSERT OR UPDATE OR DELETE ON mc_conversation_participants
FOR EACH ROW
EXECUTE FUNCTION update_conversation_participant_count();

-- Enable realtime for participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mc_conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mc_conversation_participants;
  END IF;
END $$;
