-- Add AI tagging fields to request_attachments table
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ADD TAGGING COLUMNS
-- ============================================

ALTER TABLE request_attachments
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suggested_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_score INTEGER,
ADD COLUMN IF NOT EXISTS confidence_score INTEGER,
ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
ADD COLUMN IF NOT EXISTS tagging_status TEXT DEFAULT 'pending' CHECK (tagging_status IN ('pending', 'processing', 'completed', 'failed'));

-- ============================================
-- 2. CREATE INDEX FOR TAGGING STATUS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_request_attachments_tagging_status
ON request_attachments(tagging_status)
WHERE tagging_status IN ('pending', 'failed');

-- ============================================
-- 3. CREATE INDEX FOR TAGS (GIN for array search)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_request_attachments_tags
ON request_attachments USING GIN(tags);

-- ============================================
-- 4. SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Photo tagging fields added successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New fields added to request_attachments:';
  RAISE NOTICE '• tags - Array of applied tags';
  RAISE NOTICE '• suggested_tags - Array of AI-suggested tags';
  RAISE NOTICE '• quality_score - Photo quality (1-10)';
  RAISE NOTICE '• confidence_score - AI confidence (0-100)';
  RAISE NOTICE '• ai_analysis - AI analysis notes';
  RAISE NOTICE '• tagging_status - pending/processing/completed/failed';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes created for efficient querying';
END $$;
