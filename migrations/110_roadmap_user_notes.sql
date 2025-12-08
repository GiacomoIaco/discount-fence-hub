-- ============================================
-- Migration 110: Add user_notes to roadmap_items
-- ============================================
-- Allows users to add additional thoughts after initial idea/analysis
-- Kept separate from raw_idea and claude_analysis for traceability

ALTER TABLE roadmap_items
ADD COLUMN IF NOT EXISTS user_notes TEXT;

-- Add a comment explaining the field
COMMENT ON COLUMN roadmap_items.user_notes IS 'Additional thoughts added by user after initial idea. Used for re-analysis with Claude.';
