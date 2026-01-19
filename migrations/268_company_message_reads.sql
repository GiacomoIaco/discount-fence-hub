-- ============================================================================
-- Migration 268: Create company_message_reads table
-- Tracks which users have read which company announcements
-- ============================================================================

-- Create the company_message_reads table if it doesn't exist
CREATE TABLE IF NOT EXISTS company_message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES company_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure each user can only have one read record per message
  UNIQUE(message_id, user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_company_message_reads_message ON company_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_company_message_reads_user ON company_message_reads(user_id);

-- Enable RLS
ALTER TABLE company_message_reads ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view all read receipts" ON company_message_reads;
CREATE POLICY "Users can view all read receipts" ON company_message_reads
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can mark messages as read" ON company_message_reads;
CREATE POLICY "Users can mark messages as read" ON company_message_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own read receipts" ON company_message_reads;
CREATE POLICY "Users can update their own read receipts" ON company_message_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'company_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_message_reads;
  END IF;
END $$;

-- Grant permissions
GRANT ALL ON company_message_reads TO authenticated;
