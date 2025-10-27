-- Fix user_unread_messages view - view already exists with correct table name
-- Run this in Supabase SQL Editor

-- The view is already correctly defined in create-team-communication-tables.sql
-- This file is only needed if the view needs to be recreated

-- Drop existing view (if any issues)
DROP VIEW IF EXISTS user_unread_messages;

-- Recreate view (already uses correct user_profiles table)
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully recreated user_unread_messages view!';
  RAISE NOTICE 'View uses user_profiles table';
END $$;
