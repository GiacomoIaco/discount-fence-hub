-- ============================================
-- Fix: Recreate conversation last_message_at trigger
-- The trigger from migration 004 was never applied or was dropped.
-- This causes conversations to show creation date instead of last activity,
-- and prevents conversations from sorting to top after a reply.
-- ============================================

-- 1. Recreate the trigger function
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recreate the trigger on direct_messages
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON direct_messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- 3. Backfill: update all conversations to have the correct last_message_at
UPDATE conversations c
SET last_message_at = sub.max_created_at,
    updated_at = sub.max_created_at
FROM (
  SELECT conversation_id, MAX(created_at) AS max_created_at
  FROM direct_messages
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND (c.last_message_at IS NULL OR c.last_message_at < sub.max_created_at);
