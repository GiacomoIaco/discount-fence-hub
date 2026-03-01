-- Conversation preferences: per-user pin/mute for inbox conversations
CREATE TABLE IF NOT EXISTS conversation_preferences (
  user_id uuid REFERENCES auth.users NOT NULL,
  conversation_ref text NOT NULL,
  is_pinned boolean DEFAULT false,
  is_muted boolean DEFAULT false,
  pinned_at timestamptz,
  PRIMARY KEY (user_id, conversation_ref)
);

-- RLS: users can only read/write their own preferences
ALTER TABLE conversation_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversation preferences"
  ON conversation_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_conversation_preferences_user
  ON conversation_preferences (user_id);
