-- ============================================
-- VERIFICATION SCRIPT FOR MIGRATION 005
-- Run this in Supabase SQL Editor to check setup
-- ============================================

-- 1. Check if file attachment columns exist
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'direct_messages'
  AND column_name IN ('file_url', 'file_name', 'file_type', 'file_size')
ORDER BY column_name;
-- Expected: 4 rows (file_url, file_name, file_type, file_size)

-- 2. Check if user_presence table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'user_presence'
) as user_presence_table_exists;
-- Expected: true

-- 3. Check if get_user_conversations function exists
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_conversations';
-- Expected: 1 row showing the function

-- 4. Get detailed function signature
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_user_conversations';
-- Expected: Shows function with no arguments and TABLE return type

-- 5. Check if update_user_presence function exists
SELECT EXISTS (
  SELECT FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'update_user_presence'
) as update_user_presence_exists;
-- Expected: true

-- 6. Check Realtime publications (which tables are enabled)
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('direct_messages', 'conversation_participants', 'user_presence')
ORDER BY tablename;
-- Expected: 3 rows (all three tables)

-- 7. Check storage bucket exists
SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE name = 'chat-files';
-- Expected: 1 row showing chat-files bucket

-- 8. Test calling the function (should return empty list)
SELECT * FROM get_user_conversations();
-- Expected: Empty result set (no error)

-- ============================================
-- SUMMARY INTERPRETATION
-- ============================================
/*
If any of the above queries return empty or false:

Query 1 (file columns):
  - If 0 rows: Migration 005 Part 1 NOT run
  - Run: ALTER TABLE direct_messages ADD COLUMN file_url TEXT, ...

Query 2 (user_presence table):
  - If false: Migration 005 Part 2 NOT run
  - Run: CREATE TABLE user_presence...

Query 3 & 4 (get_user_conversations):
  - If 0 rows: Migration 005 Part 4 NOT run OR schema cache issue
  - Solution 1: Re-run the CREATE OR REPLACE FUNCTION statement
  - Solution 2: In Supabase Dashboard → API → Refresh Schema Cache

Query 5 (update_user_presence):
  - If false: Migration 005 Part 3 NOT run
  - Run: CREATE OR REPLACE FUNCTION update_user_presence...

Query 6 (Realtime tables):
  - If <3 rows: Not all tables enabled for Realtime
  - Go to: Dashboard → Database → Replication → Enable missing tables

Query 7 (storage bucket):
  - If 0 rows: Storage bucket not created
  - Go to: Dashboard → Storage → New Bucket → "chat-files"

Query 8 (test function):
  - If ERROR: Function doesn't exist or has wrong signature
  - If empty result: Function works! (just no conversations yet)
*/
