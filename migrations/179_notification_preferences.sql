-- ============================================
-- MIGRATION 179: Notification Preferences
-- Phase 7E: Schedule notifications system
-- ============================================

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email notification preferences
  email_morning_digest BOOLEAN DEFAULT true,
  email_schedule_changes BOOLEAN DEFAULT true,
  email_new_assignments BOOLEAN DEFAULT true,
  email_conflict_alerts BOOLEAN DEFAULT true,

  -- Morning digest settings
  digest_time TIME DEFAULT '06:00:00',  -- When to send morning digest
  digest_days_ahead INTEGER DEFAULT 1,   -- How many days ahead to include

  -- Schedule change notification settings
  notify_on_reschedule BOOLEAN DEFAULT true,
  notify_on_crew_change BOOLEAN DEFAULT true,
  notify_on_cancellation BOOLEAN DEFAULT true,

  -- Quiet hours (no notifications during these times)
  quiet_hours_start TIME DEFAULT '20:00:00',
  quiet_hours_end TIME DEFAULT '07:00:00',
  respect_quiet_hours BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- Notification log for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  notification_type TEXT NOT NULL,  -- 'morning_digest', 'schedule_change', 'new_assignment', 'conflict_alert'
  subject TEXT,
  body TEXT,

  -- Related entities
  schedule_entry_id UUID REFERENCES schedule_entries(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'skipped'
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding user preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Index for finding pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON notification_log(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);

-- Function to get or create notification preferences for a user
CREATE OR REPLACE FUNCTION get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  prefs notification_preferences;
BEGIN
  SELECT * INTO prefs FROM notification_preferences WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO prefs;
  END IF;

  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for users who should receive morning digest
CREATE OR REPLACE VIEW users_for_morning_digest AS
SELECT
  np.user_id,
  np.digest_time,
  np.digest_days_ahead,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name
FROM notification_preferences np
JOIN auth.users u ON u.id = np.user_id
WHERE np.email_morning_digest = true;

-- RLS policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own notification log
CREATE POLICY "Users can view own notification log" ON notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all notifications
CREATE POLICY "Service role can manage all notification preferences" ON notification_preferences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all notification log" ON notification_log
  FOR ALL USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE notification_preferences IS 'User preferences for schedule-related notifications';
COMMENT ON TABLE notification_log IS 'Log of sent notifications for tracking and debugging';
COMMENT ON VIEW users_for_morning_digest IS 'Users who should receive morning digest emails';
