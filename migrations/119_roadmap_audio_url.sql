-- ============================================
-- Migration 119: Add audio_url to roadmap_items
-- ============================================
-- Allows saving voice recordings with roadmap ideas
-- so they're not lost if transcription fails.

ALTER TABLE roadmap_items
ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN roadmap_items.audio_url IS 'URL to voice recording in storage (voice-samples bucket)';
