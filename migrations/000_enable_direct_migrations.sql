-- ============================================
-- ENABLE DIRECT MIGRATIONS
-- Purpose: Create a helper function to allow programmatic SQL execution
-- ============================================
--
-- This function allows migrations to be applied programmatically via scripts
-- instead of manually through the Supabase SQL Editor.
--
-- SECURITY: This function is SECURITY DEFINER and only accessible to service_role
-- to ensure it can only be called by trusted server-side code.
--
-- Usage:
--   Run this SQL once in your Supabase SQL Editor, then you can use:
--   npm run migrate:direct <migration-file.sql>
--
-- ============================================

CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission ONLY to service role (not public users)
REVOKE ALL ON FUNCTION exec_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION exec_sql(TEXT) IS 'Execute arbitrary SQL statements. Only accessible to service_role for programmatic migrations.';
