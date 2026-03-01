-- Pinned messages per conversation
CREATE TABLE IF NOT EXISTS pinned_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('sms', 'team_chat', 'ticket_chat')),
  message_id uuid NOT NULL,
  conversation_ref text NOT NULL,
  pinned_at timestamptz DEFAULT now(),
  UNIQUE(message_type, message_id)
);

-- Index for querying pins in a conversation
CREATE INDEX IF NOT EXISTS idx_pinned_messages_conversation
  ON pinned_messages (conversation_ref);

-- RLS
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pinned messages"
  ON pinned_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can pin messages"
  ON pinned_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unpin their own pins"
  ON pinned_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('293', 'pinned_messages', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
