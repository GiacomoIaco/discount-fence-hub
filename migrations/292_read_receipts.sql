-- Per-message read receipts for direct messages (team chat)
CREATE TABLE IF NOT EXISTS direct_message_reads (
  message_id uuid REFERENCES direct_messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Index for querying read status of own messages
CREATE INDEX IF NOT EXISTS idx_direct_message_reads_message
  ON direct_message_reads (message_id);

-- RLS
ALTER TABLE direct_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read receipts for messages in their conversations"
  ON direct_message_reads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can mark messages as read"
  ON direct_message_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('292', 'read_receipts', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
