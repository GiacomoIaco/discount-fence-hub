-- Track when users last read ticket/request comments
-- Replaces the heuristic "unread if latest note not by you" approach

CREATE TABLE IF NOT EXISTS request_note_reads (
  user_id uuid REFERENCES auth.users NOT NULL,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE NOT NULL,
  last_read_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE request_note_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
  ON request_note_reads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_request_note_reads_user
  ON request_note_reads (user_id);
