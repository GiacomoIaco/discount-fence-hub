-- ============================================
-- QUICK FIX: Refresh Schema Cache
-- ============================================
-- If migration 005 was already run but the function isn't found,
-- the PostgREST schema cache might be stale.
--
-- OPTION 1: Refresh via Supabase Dashboard (Easiest)
-- --------------------------------------------
-- 1. Go to: Supabase Dashboard → Settings → API
-- 2. Find: "Schema Cache" section
-- 3. Click: "Refresh now" button
-- 4. Wait 30 seconds
-- 5. Test the app again
--
-- OPTION 2: Re-create the function (Forces cache refresh)
-- --------------------------------------------

-- Just re-run the function creation from migration 005:

CREATE OR REPLACE FUNCTION get_user_conversations()
RETURNS TABLE (
  conversation_id UUID,
  other_user_id UUID,
  other_user_name TEXT,
  other_user_email TEXT,
  other_user_status TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count BIGINT,
  last_read_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as conversation_id,
    up.id as other_user_id,
    up.full_name as other_user_name,
    au.email as other_user_email,
    COALESCE(presence.status, 'offline') as other_user_status,
    dm_last.content as last_message,
    c.last_message_at,
    COUNT(dm.id) FILTER (
      WHERE dm.created_at > cp.last_read_at
      AND dm.sender_id != auth.uid()
      AND dm.is_deleted = FALSE
    ) as unread_count,
    cp.last_read_at
  FROM conversations c
  INNER JOIN conversation_participants cp ON cp.conversation_id = c.id
  INNER JOIN conversation_participants cp_other
    ON cp_other.conversation_id = c.id
    AND cp_other.user_id != auth.uid()
  INNER JOIN user_profiles up ON up.id = cp_other.user_id
  INNER JOIN auth.users au ON au.id = up.id
  LEFT JOIN user_presence presence ON presence.user_id = up.id
  LEFT JOIN LATERAL (
    SELECT content
    FROM direct_messages
    WHERE conversation_id = c.id
      AND is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  ) dm_last ON true
  LEFT JOIN direct_messages dm ON dm.conversation_id = c.id
  WHERE cp.user_id = auth.uid()
    AND cp.is_archived = FALSE
  GROUP BY
    c.id,
    up.id,
    up.full_name,
    au.email,
    presence.status,
    dm_last.content,
    c.last_message_at,
    cp.last_read_at
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_conversations() TO authenticated;

-- Test it works
SELECT * FROM get_user_conversations();

-- ============================================
-- OPTION 3: Make PostgREST reload
-- ============================================
-- Send a notification to PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Schema cache refresh attempted!';
  RAISE NOTICE '';
  RAISE NOTICE 'What to do next:';
  RAISE NOTICE '1. Wait 30-60 seconds for cache to refresh';
  RAISE NOTICE '2. Reload your app (Ctrl+F5 / Cmd+Shift+R)';
  RAISE NOTICE '3. Click Chat again';
  RAISE NOTICE '';
  RAISE NOTICE 'If still not working, check VERIFY_MIGRATION_005.sql';
END $$;
