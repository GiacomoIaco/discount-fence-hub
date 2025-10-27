-- Enhanced Team Communication Schema
-- Run this in Supabase SQL Editor to add new features

-- 1. Add message status and draft support
ALTER TABLE company_messages
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'archived')),
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_edit_responses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_results_after_submit BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS anonymous_responses BOOLEAN DEFAULT false;

-- 2. Enhance survey support for multi-question surveys
-- Modify survey_options to support multiple questions
-- New structure: {questions: [{id, text, type, options, required}]}
ALTER TABLE company_messages
DROP COLUMN IF EXISTS survey_options;

ALTER TABLE company_messages
ADD COLUMN IF NOT EXISTS survey_questions JSONB;

-- Example structure for survey_questions:
-- {
--   "questions": [
--     {
--       "id": "q1",
--       "text": "How was the training?",
--       "type": "multiple_choice",
--       "options": ["Excellent", "Good", "Fair", "Poor"],
--       "allow_multiple": false,
--       "required": true
--     },
--     {
--       "id": "q2",
--       "text": "What would you improve?",
--       "type": "long_text",
--       "required": false
--     }
--   ]
-- }

-- 3. Update message_responses to support multi-question answers
ALTER TABLE message_responses
ADD COLUMN IF NOT EXISTS question_id TEXT,
ADD COLUMN IF NOT EXISTS answer_data JSONB;

-- 4. Add engagement tracking table
CREATE TABLE IF NOT EXISTS message_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES company_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Engagement metrics
  opened_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,

  -- User actions
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  UNIQUE(message_id, user_id)
);

-- 5. Create index for engagement tracking
CREATE INDEX IF NOT EXISTS idx_engagement_message ON message_engagement(message_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user ON message_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_archived ON message_engagement(is_archived);

-- 6. Function to get message state for a user
CREATE OR REPLACE FUNCTION get_message_state(
  msg_id UUID,
  usr_id UUID
) RETURNS TEXT AS $$
DECLARE
  msg_type TEXT;
  requires_ack BOOLEAN;
  has_survey BOOLEAN;
  engagement_rec RECORD;
  response_rec RECORD;
BEGIN
  -- Get message info
  SELECT
    message_type,
    requires_acknowledgment,
    (survey_questions IS NOT NULL) as has_questions
  INTO msg_type, requires_ack, has_survey
  FROM company_messages
  WHERE id = msg_id;

  -- Get engagement record
  SELECT * INTO engagement_rec
  FROM message_engagement
  WHERE message_id = msg_id AND user_id = usr_id;

  -- Get response record
  SELECT * INTO response_rec
  FROM message_responses
  WHERE message_id = msg_id AND user_id = usr_id
  LIMIT 1;

  -- Determine state
  IF engagement_rec.is_archived THEN
    RETURN 'archived';
  ELSIF response_rec.id IS NOT NULL AND response_rec.response_type = 'survey_answer' THEN
    RETURN 'answered';
  ELSIF response_rec.id IS NOT NULL AND response_rec.response_type = 'acknowledgment' THEN
    RETURN 'acknowledged';
  ELSIF engagement_rec.opened_at IS NOT NULL THEN
    IF requires_ack THEN
      RETURN 'read_needs_action';
    ELSIF has_survey THEN
      RETURN 'read_needs_response';
    ELSE
      RETURN 'read';
    END IF;
  ELSE
    RETURN 'unread';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to auto-archive messages based on rules
CREATE OR REPLACE FUNCTION auto_archive_messages() RETURNS void AS $$
BEGIN
  -- Archive announcements after 30 days
  UPDATE message_engagement me
  SET is_archived = true, archived_at = NOW()
  FROM company_messages cm
  WHERE me.message_id = cm.id
    AND cm.message_type = 'announcement'
    AND cm.created_at < NOW() - INTERVAL '30 days'
    AND me.is_archived = false
    AND me.opened_at IS NOT NULL;

  -- Archive surveys after user responds
  UPDATE message_engagement me
  SET is_archived = true, archived_at = NOW()
  FROM message_responses mr
  WHERE me.message_id = mr.message_id
    AND me.user_id = mr.user_id
    AND mr.response_type = 'survey_answer'
    AND me.is_archived = false;

  -- Archive alerts after acknowledged
  UPDATE message_engagement me
  SET is_archived = true, archived_at = NOW()
  FROM message_responses mr
  WHERE me.message_id = mr.message_id
    AND me.user_id = mr.user_id
    AND mr.response_type = 'acknowledgment'
    AND me.is_archived = false;

  -- Archive events after event date
  UPDATE message_engagement me
  SET is_archived = true, archived_at = NOW()
  FROM company_messages cm
  WHERE me.message_id = cm.id
    AND cm.message_type = 'event'
    AND cm.event_details->>'date' < CURRENT_DATE::TEXT
    AND me.is_archived = false;
END;
$$ LANGUAGE plpgsql;

-- 8. View for message states (useful for queries)
CREATE OR REPLACE VIEW message_states AS
SELECT
  cm.id as message_id,
  cm.created_by,
  cm.message_type,
  cm.status as message_status,
  cm.is_draft,
  COUNT(DISTINCT me.user_id) as total_recipients,
  COUNT(DISTINCT CASE WHEN me.opened_at IS NOT NULL THEN me.user_id END) as opened_count,
  COUNT(DISTINCT CASE WHEN me.acknowledged_at IS NOT NULL THEN me.user_id END) as acknowledged_count,
  COUNT(DISTINCT CASE WHEN me.responded_at IS NOT NULL THEN me.user_id END) as responded_count,
  ROUND(
    COUNT(DISTINCT CASE WHEN me.opened_at IS NOT NULL THEN me.user_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT me.user_id), 0) * 100
  ) as open_rate,
  ROUND(
    COUNT(DISTINCT CASE WHEN me.responded_at IS NOT NULL THEN me.user_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT me.user_id), 0) * 100
  ) as response_rate
FROM company_messages cm
LEFT JOIN message_engagement me ON me.message_id = cm.id
GROUP BY cm.id, cm.created_by, cm.message_type, cm.status, cm.is_draft;

-- 9. Trigger to create engagement records when message is created
CREATE OR REPLACE FUNCTION create_message_engagement()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  user_role TEXT;
BEGIN
  -- Only create engagement for non-draft messages
  IF NEW.is_draft = false THEN
    -- Create engagement records for all targeted users
    FOR target_user_id, user_role IN
      SELECT DISTINCT up.id, up.role
      FROM user_profiles up
      WHERE
        -- Match by role
        (NEW.target_roles IS NOT NULL AND up.role = ANY(NEW.target_roles))
        OR
        -- Match by user ID
        (NEW.target_user_ids IS NOT NULL AND up.id = ANY(NEW.target_user_ids))
    LOOP
      INSERT INTO message_engagement (message_id, user_id)
      VALUES (NEW.id, target_user_id)
      ON CONFLICT (message_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_message_engagement ON company_messages;
CREATE TRIGGER trigger_create_message_engagement
AFTER INSERT ON company_messages
FOR EACH ROW EXECUTE FUNCTION create_message_engagement();

-- 10. Update view_count trigger to use engagement table
CREATE OR REPLACE FUNCTION track_message_opened()
RETURNS TRIGGER AS $$
BEGIN
  -- Update engagement record
  UPDATE message_engagement
  SET opened_at = COALESCE(opened_at, NOW())
  WHERE message_id = NEW.message_id AND user_id = NEW.user_id;

  -- Update message view count
  UPDATE company_messages
  SET view_count = view_count + 1
  WHERE id = NEW.message_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_opened ON message_receipts;
CREATE TRIGGER trigger_track_opened
AFTER INSERT ON message_receipts
FOR EACH ROW EXECUTE FUNCTION track_message_opened();

-- 11. Function to track response
CREATE OR REPLACE FUNCTION track_message_response()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_engagement
  SET
    responded_at = COALESCE(responded_at, NOW()),
    acknowledged_at = CASE WHEN NEW.response_type = 'acknowledgment'
                           THEN COALESCE(acknowledged_at, NOW())
                           ELSE acknowledged_at END
  WHERE message_id = NEW.message_id AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_response ON message_responses;
CREATE TRIGGER trigger_track_response
AFTER INSERT ON message_responses
FOR EACH ROW EXECUTE FUNCTION track_message_response();

-- 12. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_status ON company_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_draft ON company_messages(is_draft);
CREATE INDEX IF NOT EXISTS idx_messages_created_by ON company_messages(created_by);

-- Run auto-archive on a schedule (set up in Supabase cron or call manually)
-- SELECT auto_archive_messages();

COMMENT ON TABLE message_engagement IS 'Tracks individual user engagement with messages';
COMMENT ON FUNCTION get_message_state IS 'Returns the state of a message for a specific user';
COMMENT ON FUNCTION auto_archive_messages IS 'Auto-archives messages based on predefined rules';
COMMENT ON VIEW message_states IS 'Aggregated engagement statistics for messages';
