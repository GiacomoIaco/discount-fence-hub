-- Migration 301: Add translations_off toggle to conversation_preferences
ALTER TABLE conversation_preferences
  ADD COLUMN IF NOT EXISTS translations_off BOOLEAN DEFAULT false;
