-- Add reminder tracking columns to user_invitations
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
