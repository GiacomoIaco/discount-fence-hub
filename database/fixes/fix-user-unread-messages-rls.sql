-- Fix RLS for user_unread_messages view
-- Run this in Supabase SQL Editor

-- Option 1: Grant SELECT permission on the view to authenticated users
GRANT SELECT ON user_unread_messages TO authenticated;

-- Option 2: If the above doesn't work, recreate as a security definer function instead
CREATE OR REPLACE FUNCTION get_user_unread_count(user_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  user_role TEXT,
  unread_count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id as user_id,
    up.role as user_role,
    COUNT(DISTINCT m.id) as unread_count
  FROM auth.users u
  JOIN user_profiles up ON up.id = u.id
  CROSS JOIN company_messages m
  LEFT JOIN message_receipts mr ON mr.message_id = m.id AND mr.user_id = u.id
  WHERE
    u.id = user_uuid
    AND m.is_archived = false
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND (
      up.role = ANY(m.target_roles)
      OR u.id = ANY(COALESCE(m.target_user_ids, ARRAY[]::UUID[]))
    )
    AND mr.id IS NULL
  GROUP BY u.id, up.role;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_unread_count(UUID) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed user_unread_messages access!';
  RAISE NOTICE 'Use: SELECT * FROM get_user_unread_count(auth.uid())';
END $$;
