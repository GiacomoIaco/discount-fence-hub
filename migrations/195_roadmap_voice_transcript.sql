-- Migration 195: Add voice_transcript column to roadmap_items
-- This preserves the exact transcription separately from raw_idea (which may be AI-expanded or edited)

-- Add the voice_transcript column
ALTER TABLE roadmap_items
ADD COLUMN IF NOT EXISTS voice_transcript TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN roadmap_items.voice_transcript IS 'Exact transcription from voice recording, preserved separately from raw_idea';

-- Note: audio_url column should already exist from the original implementation
-- If it doesn't exist, add it:
ALTER TABLE roadmap_items
ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN roadmap_items.audio_url IS 'Signed URL to the voice recording audio file in storage';
