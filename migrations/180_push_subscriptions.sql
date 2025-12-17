-- Migration: 180_push_subscriptions
-- Description: Store web push notification subscriptions for mobile/browser notifications
-- Date: 2024-12-17

-- ============================================================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================================================
-- Stores browser push subscription info for each user/device combo

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User who subscribed
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Push subscription data (from browser's PushSubscription object)
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,  -- Public key
  auth TEXT NOT NULL,     -- Auth secret

  -- Device/browser info for debugging
  user_agent TEXT,
  device_name TEXT,  -- e.g., "iPhone 12", "Chrome on Windows"

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One subscription per endpoint per user
  UNIQUE(user_id, endpoint)
);

-- Index for quick lookups
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id) WHERE is_active = true;
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- ============================================================================
-- NOTIFICATION SETTINGS FOR PUSH
-- ============================================================================
-- Add push notification toggle to notification preferences

ALTER TABLE mc_notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTION: Get active subscriptions for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_push_subscriptions(target_user_id UUID)
RETURNS TABLE (
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.endpoint,
    ps.p256dh,
    ps.auth
  FROM push_subscriptions ps
  WHERE ps.user_id = target_user_id
    AND ps.is_active = true
    AND ps.error_count < 3;  -- Skip subscriptions that have failed multiple times
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_subscription_updated
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();

-- ============================================================================
-- NOTIFICATION LOG (for debugging/analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,

  -- Notification content
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  url TEXT,
  tag TEXT,  -- For replacing notifications

  -- Result
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, delivered, failed
  error_message TEXT,

  -- Source
  source_type TEXT,  -- 'message', 'notification', 'system'
  source_id UUID,    -- ID of the source entity

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Index for analytics
CREATE INDEX idx_push_notification_log_user ON push_notification_log(user_id, created_at DESC);
CREATE INDEX idx_push_notification_log_status ON push_notification_log(status, created_at DESC);

-- RLS for notification log (admin only read, system write)
ALTER TABLE push_notification_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own notification history
CREATE POLICY "Users can view own notification log"
  ON push_notification_log FOR SELECT
  USING (auth.uid() = user_id);
