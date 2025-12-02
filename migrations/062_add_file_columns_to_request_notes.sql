-- Add file columns to request_notes table for inline image/file display in chat
-- This allows files uploaded in the request chat to appear inline in the conversation

ALTER TABLE request_notes
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Added file columns to request_notes table';
END $$;
