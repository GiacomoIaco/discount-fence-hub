-- Reply-to-message threading
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES direct_messages(id);
ALTER TABLE request_notes ADD COLUMN IF NOT EXISTS reply_to_note_id uuid REFERENCES request_notes(id);

-- Index for efficient reply lookups
CREATE INDEX IF NOT EXISTS idx_direct_messages_reply_to
  ON direct_messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_notes_reply_to
  ON request_notes (reply_to_note_id) WHERE reply_to_note_id IS NOT NULL;

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('291', 'reply_threading', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
