-- Fix user_unread_messages view to use correct profiles table
-- Run this in Supabase SQL Editor

-- Drop existing view
DROP VIEW IF EXISTS user_unread_messages;

-- Recreate view with correct table name (profiles instead of user_profiles)
CREATE OR REPLACE VIEW user_unread_messages AS
SELECT
  u.id as user_id,
  p.role as user_role,
  COUNT(DISTINCT m.id) as unread_count
FROM auth.users u
JOIN profiles p ON p.id = u.id
CROSS JOIN company_messages m
LEFT JOIN message_receipts mr ON mr.message_id = m.id AND mr.user_id = u.id
WHERE
  m.is_archived = false
  AND (m.expires_at IS NULL OR m.expires_at > NOW())
  AND (
    p.role = ANY(m.target_roles)
    OR u.id = ANY(COALESCE(m.target_user_ids, ARRAY[]::UUID[]))
  )
  AND mr.id IS NULL -- not read yet
GROUP BY u.id, p.role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed user_unread_messages view!';
  RAISE NOTICE 'View now uses profiles table instead of user_profiles';
END $$;
