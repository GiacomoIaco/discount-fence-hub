-- ============================================================================
-- MESSAGE CENTER PHASE 4 - SYSTEM NOTIFICATIONS
-- ============================================================================

-- Notification Type Enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'quote_viewed',
    'quote_signed',
    'quote_expired',
    'invoice_paid',
    'invoice_overdue',
    'invoice_partial',
    'job_status_change',
    'job_scheduled',
    'job_completed',
    'booking_request',
    'client_created',
    'message_received',
    'mention',
    'assignment',
    'reminder',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification Priority Enum
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SYSTEM NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mc_system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Type & Content
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority notification_priority DEFAULT 'normal',

  -- Linked Entities
  contact_id UUID REFERENCES mc_contacts(id),
  conversation_id UUID REFERENCES mc_conversations(id),
  client_id UUID,
  project_id UUID,
  quote_id UUID,
  invoice_id UUID,
  job_id UUID,

  -- Targeting
  target_user_id UUID REFERENCES auth.users(id),
  target_role TEXT,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id),
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,

  -- Action
  action_url TEXT,
  action_label TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mc_notifications_type ON mc_system_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_user ON mc_system_notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_read ON mc_system_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_created ON mc_system_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_contact ON mc_system_notifications(contact_id);

-- RLS
ALTER TABLE mc_system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notifications" ON mc_system_notifications;
CREATE POLICY "Users can view notifications" ON mc_system_notifications FOR SELECT USING (
  target_user_id IS NULL OR target_user_id = auth.uid()
);

DROP POLICY IF EXISTS "System can insert notifications" ON mc_system_notifications;
CREATE POLICY "System can insert notifications" ON mc_system_notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their notifications" ON mc_system_notifications;
CREATE POLICY "Users can update their notifications" ON mc_system_notifications FOR UPDATE USING (
  target_user_id IS NULL OR target_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can delete their notifications" ON mc_system_notifications;
CREATE POLICY "Users can delete their notifications" ON mc_system_notifications FOR DELETE USING (
  target_user_id IS NULL OR target_user_id = auth.uid()
);

-- Enable Realtime (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mc_system_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mc_system_notifications;
  END IF;
END $$;

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mc_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Per-type settings
  quote_viewed BOOLEAN DEFAULT TRUE,
  quote_signed BOOLEAN DEFAULT TRUE,
  quote_expired BOOLEAN DEFAULT TRUE,
  invoice_paid BOOLEAN DEFAULT TRUE,
  invoice_overdue BOOLEAN DEFAULT TRUE,
  job_status_change BOOLEAN DEFAULT TRUE,
  booking_request BOOLEAN DEFAULT TRUE,
  client_created BOOLEAN DEFAULT FALSE,
  mention BOOLEAN DEFAULT TRUE,

  -- Delivery channels
  show_in_app BOOLEAN DEFAULT TRUE,
  send_email BOOLEAN DEFAULT FALSE,
  send_sms BOOLEAN DEFAULT FALSE,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

ALTER TABLE mc_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON mc_notification_preferences;
CREATE POLICY "Users can view own preferences" ON mc_notification_preferences FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own preferences" ON mc_notification_preferences;
CREATE POLICY "Users can update own preferences" ON mc_notification_preferences FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own preferences" ON mc_notification_preferences;
CREATE POLICY "Users can insert own preferences" ON mc_notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTION: Create Notification
-- ============================================================================

CREATE OR REPLACE FUNCTION create_system_notification(
  p_type notification_type,
  p_title TEXT,
  p_body TEXT,
  p_contact_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_quote_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_priority notification_priority DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_conversation_id UUID;
BEGIN
  -- Find conversation for this contact if exists
  IF p_contact_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM mc_conversations
    WHERE contact_id = p_contact_id
    AND conversation_type = 'client'
    AND status = 'active'
    LIMIT 1;
  END IF;

  -- Insert notification
  INSERT INTO mc_system_notifications (
    notification_type,
    title,
    body,
    priority,
    contact_id,
    conversation_id,
    client_id,
    project_id,
    quote_id,
    invoice_id,
    job_id,
    target_user_id,
    action_url,
    action_label,
    metadata
  ) VALUES (
    p_type,
    p_title,
    p_body,
    p_priority,
    p_contact_id,
    v_conversation_id,
    p_client_id,
    p_project_id,
    p_quote_id,
    p_invoice_id,
    p_job_id,
    p_target_user_id,
    p_action_url,
    p_action_label,
    p_metadata
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TEST DATA
-- ============================================================================

INSERT INTO mc_system_notifications (notification_type, title, body, priority, action_url, action_label)
VALUES
  ('quote_viewed', 'Quote Viewed', 'John Smith viewed quote #1234 for Lakewood Estates', 'high', '/quotes/1234', 'View Quote'),
  ('invoice_paid', 'Payment Received!', 'DR Horton paid invoice #5678 - $4,500', 'normal', '/invoices/5678', 'View Invoice'),
  ('job_status_change', 'Job Completed', 'Job for Smith residence has been completed', 'normal', '/jobs/9012', 'View Job'),
  ('booking_request', 'New Booking Request', 'Sarah Johnson requested a quote for 200ft cedar fence', 'high', '/leads/3456', 'View Lead'),
  ('quote_signed', 'Quote Signed!', 'Mike Williams signed quote #7890 - Ready to schedule', 'high', '/quotes/7890', 'Schedule Job')
ON CONFLICT DO NOTHING;
