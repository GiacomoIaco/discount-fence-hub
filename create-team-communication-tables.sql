-- Team Communication System
-- Run this in Supabase SQL Editor

-- 1. Messages Table
CREATE TABLE IF NOT EXISTS company_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL CHECK (message_type IN ('announcement', 'urgent_alert', 'recognition', 'survey', 'policy', 'training', 'discussion', 'task', 'event')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Targeting
  target_roles TEXT[] DEFAULT ARRAY['sales', 'operations', 'sales-manager', 'admin'], -- null means all
  target_user_ids UUID[], -- specific users (optional)

  -- Metadata
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  requires_acknowledgment BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,

  -- Additional fields for specific message types
  linked_resource_id UUID, -- link to sales_resources_files
  survey_options JSONB, -- for surveys: {options: [...], allow_multiple: bool}
  event_details JSONB, -- for events: {date, time, location, rsvp_required}
  task_details JSONB, -- for tasks: {due_date, assignees, status}

  -- Recognition specific
  recognized_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Stats
  view_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0
);

-- 2. Message Receipts (Read Tracking)
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES company_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- 3. Message Responses (Acknowledgments, Survey Responses, Comments)
CREATE TABLE IF NOT EXISTS message_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES company_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('acknowledgment', 'survey_answer', 'comment', 'reaction', 'rsvp')),

  -- Response data
  text_response TEXT,
  selected_options TEXT[], -- for survey multiple choice
  reaction_emoji TEXT, -- for reactions (👍, ❤️, etc.)
  rsvp_status TEXT CHECK (rsvp_status IN ('yes', 'no', 'maybe')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Message Attachments (optional for future file attachments)
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES company_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_type ON company_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON company_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_target_roles ON company_messages USING GIN(target_roles);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON company_messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_archived ON company_messages(is_archived);

CREATE INDEX IF NOT EXISTS idx_receipts_message ON message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON message_receipts(user_id);

CREATE INDEX IF NOT EXISTS idx_responses_message ON message_responses(message_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON message_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_type ON message_responses(response_type);

-- Function to update response count
CREATE OR REPLACE FUNCTION update_message_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_messages
    SET response_count = response_count + 1
    WHERE id = NEW.message_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_messages
    SET response_count = response_count - 1
    WHERE id = OLD.message_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_response_count
AFTER INSERT OR DELETE ON message_responses
FOR EACH ROW EXECUTE FUNCTION update_message_response_count();

-- Function to update view count
CREATE OR REPLACE FUNCTION update_message_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE company_messages
  SET view_count = view_count + 1
  WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_view_count
AFTER INSERT ON message_receipts
FOR EACH ROW EXECUTE FUNCTION update_message_view_count();

-- RLS Policies (to be enabled later)
-- ALTER TABLE company_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_responses ENABLE ROW LEVEL SECURITY;

-- View for getting user's unread message count
CREATE OR REPLACE VIEW user_unread_messages AS
SELECT
  u.id as user_id,
  up.role as user_role,
  COUNT(DISTINCT m.id) as unread_count
FROM auth.users u
JOIN user_profiles up ON up.id = u.id
CROSS JOIN company_messages m
LEFT JOIN message_receipts mr ON mr.message_id = m.id AND mr.user_id = u.id
WHERE
  m.is_archived = false
  AND (m.expires_at IS NULL OR m.expires_at > NOW())
  AND (
    up.role = ANY(m.target_roles)
    OR u.id = ANY(COALESCE(m.target_user_ids, ARRAY[]::UUID[]))
  )
  AND mr.id IS NULL -- not read yet
GROUP BY u.id, up.role;

-- Sample data for testing (optional - uncomment to add)
/*
INSERT INTO company_messages (message_type, title, content, created_by, priority, requires_acknowledgment)
VALUES (
  'announcement',
  'Welcome to Team Communication!',
  'This is our new communication hub where leadership can share important updates with the team. You''ll receive announcements, surveys, and policy updates here.',
  (SELECT id FROM auth.users LIMIT 1),
  'high',
  false
);
*/
