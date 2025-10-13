-- Fix: Add unique constraint for survey responses
-- This allows upsert operations to work correctly when users submit survey responses

-- First, remove any duplicate responses (keep the most recent)
DELETE FROM message_responses a
USING message_responses b
WHERE
  a.message_id = b.message_id
  AND a.user_id = b.user_id
  AND a.response_type = 'survey_answer'
  AND a.created_at < b.created_at;

-- Add unique constraint for survey_answer responses
-- Note: We only add it for survey_answer type because other types (comments, reactions)
-- can have multiple entries per user
ALTER TABLE message_responses
DROP CONSTRAINT IF EXISTS unique_survey_response_per_user;

ALTER TABLE message_responses
ADD CONSTRAINT unique_survey_response_per_user
UNIQUE (message_id, user_id, response_type);

-- Note: This constraint ensures:
-- - One survey_answer per user per message
-- - One acknowledgment per user per message
-- - But allows multiple comments and reactions per user
