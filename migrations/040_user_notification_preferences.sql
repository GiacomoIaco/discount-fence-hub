-- Migration: User Notification Preferences
-- Allows users to configure their notification preferences per category/type

-- Create the notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'requests', 'chat', 'announcements'
  notification_type TEXT NOT NULL, -- 'assignment', 'comment', 'direct_message', etc.
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  is_admin_forced BOOLEAN NOT NULL DEFAULT false, -- If true, user cannot disable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one preference per user per category/type
  UNIQUE(user_id, category, notification_type)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_category ON user_notification_preferences(category, notification_type);

-- Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can create own notification preferences"
  ON user_notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences (unless admin forced)
CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id AND is_admin_forced = false)
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all preferences (for forcing certain notifications)
CREATE POLICY "Admins can manage all notification preferences"
  ON user_notification_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_prefs_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_prefs_updated_at();

-- Insert default notification types for reference (optional - these define what's available)
-- The actual user preferences are created on-demand when users visit settings
COMMENT ON TABLE user_notification_preferences IS 'User notification preferences. Categories: requests, chat, announcements. Types vary by category.';
