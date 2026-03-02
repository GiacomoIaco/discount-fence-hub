-- Migration 300: Multilingual Foundation
-- Adds language preference to user profiles, detected_language to messages,
-- and creates message_translations table for caching translations.

-- 1. Add preferred_language to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'es'));

-- 2. Add detected_language to direct_messages
ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS detected_language TEXT;

-- 3. Add detected_language to request_notes
ALTER TABLE request_notes
  ADD COLUMN IF NOT EXISTS detected_language TEXT;

-- 4. Add detected_language to mc_messages (Contact Center SMS)
ALTER TABLE mc_messages
  ADD COLUMN IF NOT EXISTS detected_language TEXT;

-- 5. Create message_translations table
CREATE TABLE IF NOT EXISTS message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,        -- 'direct_message', 'request_note', 'mc_message'
  source_id UUID NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, source_id, target_language)
);

-- Index for fast lookups by source
CREATE INDEX IF NOT EXISTS idx_message_translations_source
  ON message_translations(source_type, source_id);

-- 6. RLS: users can SELECT translations; only service_role can INSERT
ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read translations"
  ON message_translations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert translations"
  ON message_translations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to insert too (from Netlify functions via anon/authenticated)
CREATE POLICY "Authenticated can insert translations"
  ON message_translations FOR INSERT
  TO authenticated
  WITH CHECK (true);
