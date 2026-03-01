-- Unified dismiss/archive mechanism for inbox items across all message types

CREATE TABLE IF NOT EXISTS inbox_dismissed_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  item_type text NOT NULL,  -- 'sms' | 'team_chat' | 'team_announcement' | 'system_notification' | 'ticket_chat'
  item_id text NOT NULL,    -- the actionId from UnifiedMessage
  dismissed_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, item_type, item_id)
);

ALTER TABLE inbox_dismissed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissed items"
  ON inbox_dismissed_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_inbox_dismissed_user_type
  ON inbox_dismissed_items (user_id, item_type);
