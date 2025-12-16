-- ============================================================================
-- MESSAGE CENTER PHASE 1 - CORE TABLES
-- Workiz-style Message Center for SMS, Email, and In-App communication
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Message Channel Enum
DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('sms', 'email', 'in_app', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Message Direction Enum
DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Message Status Enum
DO $$ BEGIN
  CREATE TYPE message_status AS ENUM (
    'sending', 'sent', 'delivered', 'read', 'failed', 'received'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Conversation Type Enum
DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM (
    'client', 'team_direct', 'team_group', 'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CONTACTS TABLE
-- Central contact registry for message center (links to clients/employees)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('client', 'employee', 'vendor')),
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  email_primary TEXT,
  email_secondary TEXT,
  -- Links to existing tables
  client_id UUID REFERENCES clients(id),
  employee_id UUID REFERENCES auth.users(id),
  avatar_url TEXT,
  -- SMS opt-out tracking
  sms_opted_out BOOLEAN DEFAULT FALSE,
  sms_opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_contacts_phone ON mc_contacts(phone_primary);
CREATE INDEX IF NOT EXISTS idx_mc_contacts_client ON mc_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_mc_contacts_employee ON mc_contacts(employee_id);

-- ============================================================================
-- CONVERSATIONS TABLE
-- Represents a conversation thread with a contact
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_type conversation_type NOT NULL DEFAULT 'client',
  title TEXT,
  -- QUO (OpenPhone) integration
  quo_conversation_id TEXT UNIQUE,
  -- Contact reference
  contact_id UUID REFERENCES mc_contacts(id),
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'muted')),
  -- Last message cache for fast list rendering
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction message_direction,
  unread_count INTEGER DEFAULT 0,
  -- Project detection (AI-powered)
  linked_project_id UUID,
  has_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  -- Sentiment analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mc_conversations_contact ON mc_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_status ON mc_conversations(status);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_last_message ON mc_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_project ON mc_conversations(linked_project_id);

-- ============================================================================
-- MESSAGES TABLE
-- Individual messages within conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id) ON DELETE CASCADE,
  -- Channel and direction
  channel message_channel NOT NULL DEFAULT 'sms',
  direction message_direction NOT NULL,
  -- QUO integration
  quo_message_id TEXT UNIQUE,
  -- Content
  body TEXT NOT NULL,
  body_html TEXT,
  subject TEXT, -- For emails
  -- Sender info
  from_contact_id UUID REFERENCES mc_contacts(id),
  from_user_id UUID REFERENCES auth.users(id),
  from_phone TEXT,
  from_email TEXT,
  -- Recipient info
  to_phone TEXT,
  to_email TEXT,
  -- Status tracking
  status message_status DEFAULT 'sending',
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  -- AI Analysis
  ai_analysis JSONB,
  is_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  extracted_data JSONB,
  sentiment TEXT,
  -- Forwarding
  forwarded_from_message_id UUID REFERENCES mc_messages(id),
  forwarded_by UUID REFERENCES auth.users(id),
  forwarded_at TIMESTAMPTZ,
  forward_note TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_mc_messages_conversation ON mc_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mc_messages_created ON mc_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_messages_quo ON mc_messages(quo_message_id);
CREATE INDEX IF NOT EXISTS idx_mc_messages_from_user ON mc_messages(from_user_id);

-- ============================================================================
-- ATTACHMENTS TABLE
-- File attachments for messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES mc_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  quo_media_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_attachments_message ON mc_attachments(message_id);

-- ============================================================================
-- QUICK REPLIES TABLE
-- Pre-defined message templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  shortcut TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGER: Update conversation on new message
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mc_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 100),
    last_message_direction = NEW.direction,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON mc_messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON mc_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE mc_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_quick_replies ENABLE ROW LEVEL SECURITY;

-- Contacts policies
CREATE POLICY "Users can view all contacts" ON mc_contacts FOR SELECT USING (true);
CREATE POLICY "Users can insert contacts" ON mc_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update contacts" ON mc_contacts FOR UPDATE USING (true);

-- Conversations policies
CREATE POLICY "Users can view all conversations" ON mc_conversations FOR SELECT USING (true);
CREATE POLICY "Users can insert conversations" ON mc_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update conversations" ON mc_conversations FOR UPDATE USING (true);

-- Messages policies
CREATE POLICY "Users can view all messages" ON mc_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON mc_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update messages" ON mc_messages FOR UPDATE USING (true);

-- Attachments policies
CREATE POLICY "Users can view all attachments" ON mc_attachments FOR SELECT USING (true);
CREATE POLICY "Users can insert attachments" ON mc_attachments FOR INSERT WITH CHECK (true);

-- Quick replies policies
CREATE POLICY "Users can view all quick replies" ON mc_quick_replies FOR SELECT USING (true);
CREATE POLICY "Admins can manage quick replies" ON mc_quick_replies FOR ALL USING (true);

-- ============================================================================
-- Enable Realtime for live updates
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE mc_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE mc_messages;

-- ============================================================================
-- Add Message Center to menu_visibility
-- ============================================================================
INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile
)
VALUES (
  'message-center',
  'Messages',
  ARRAY['admin', 'operations', 'sales-manager', 'sales'],
  true,
  true,
  true
)
ON CONFLICT (menu_id) DO UPDATE
SET menu_name = EXCLUDED.menu_name,
    visible_for_roles = EXCLUDED.visible_for_roles,
    show_on_desktop = EXCLUDED.show_on_desktop,
    show_on_tablet = EXCLUDED.show_on_tablet,
    show_on_mobile = EXCLUDED.show_on_mobile;
