-- ============================================================================
-- Migration 269: Fix company_messages schema
-- Adds missing columns that the Unified Inbox expects
-- ============================================================================

-- Add title column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'title'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN title TEXT;
    -- Populate from any existing data
    UPDATE company_messages SET title = 'Announcement' WHERE title IS NULL;
    ALTER TABLE company_messages ALTER COLUMN title SET NOT NULL;
  END IF;
END $$;

-- Add body column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'body'
  ) THEN
    -- Check if content column exists (common alternative name)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'company_messages' AND column_name = 'content'
    ) THEN
      -- Rename content to body
      ALTER TABLE company_messages RENAME COLUMN content TO body;
    ELSE
      -- Add body column
      ALTER TABLE company_messages ADD COLUMN body TEXT DEFAULT '';
    END IF;
  END IF;
END $$;

-- Add message_type column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN message_type TEXT DEFAULT 'announcement';
  END IF;
END $$;

-- Add status column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'status'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;
END $$;

-- Add published_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN published_at TIMESTAMPTZ;
    -- Set published_at to created_at for existing published messages
    UPDATE company_messages SET published_at = created_at WHERE status = 'published' AND published_at IS NULL;
  END IF;
END $$;

-- Add updated_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add metadata column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE company_messages ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
