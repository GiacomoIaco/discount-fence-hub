-- Fix: Add unique constraint for survey responses
-- This allows upsert operations to work correctly when users submit survey responses

-- First, remove any duplicate responses (keep the most recent)
-- Only clean up response types that should be unique per user
DELETE FROM message_responses a
USING message_responses b
WHERE
  a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.response_type = b.response_type
  AND a.response_type IN ('survey_answer', 'acknowledgment', 'rsvp')
  AND a.created_at < b.created_at;

-- Drop any existing constraint or index
DROP INDEX IF EXISTS unique_survey_response_per_user;
ALTER TABLE message_responses
DROP CONSTRAINT IF EXISTS unique_survey_response_per_user;

-- Create a partial unique index that only applies to certain response types
-- This allows multiple comments and reactions, but enforces uniqueness for:
-- - survey_answer: one per user per message
-- - acknowledgment: one per user per message
-- - rsvp: one per user per message
-- Comments and reactions can have multiple entries per user
CREATE UNIQUE INDEX unique_survey_response_per_user
ON message_responses (message_id, user_id, response_type)
WHERE response_type IN ('survey_answer', 'acknowledgment', 'rsvp');

-- Note: This partial index ensures:
-- - One survey_answer per user per message
-- - One acknowledgment per user per message
-- - One rsvp per user per message
-- - But allows multiple comments and reactions per user per message
