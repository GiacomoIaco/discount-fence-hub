-- Message Reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('sms', 'team_chat', 'ticket_chat')),
  message_id uuid NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_type, message_id, reaction)
);

-- Index for efficient batch queries
CREATE INDEX IF NOT EXISTS idx_message_reactions_lookup
  ON message_reactions (message_type, message_id);

-- RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on messages they can see"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('290', 'message_reactions', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
