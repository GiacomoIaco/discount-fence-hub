-- ============================================================================
-- Migration 176: Security Fixes
-- Addresses Supabase Security Advisor findings:
-- 1. Enable RLS on tables with existing policies (sales_resources_*)
-- 2. Enable RLS on public tables without RLS
-- 3. Revoke anon access from views that expose auth.users
-- 4. Review and secure security_definer views
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on tables with policies already defined
-- These tables have policies but RLS was never enabled
-- ============================================================================

ALTER TABLE IF EXISTS public.sales_resources_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_resources_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_resources_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_resources_views ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: Enable RLS on public tables without any RLS
-- These tables need both RLS enabled AND policies created
-- ============================================================================

-- 2a. message_attachments - if it exists (older table naming)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_attachments' AND table_schema = 'public') THEN
    ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "message_attachments_read" ON public.message_attachments;
    DROP POLICY IF EXISTS "message_attachments_write" ON public.message_attachments;

    -- Create policies
    CREATE POLICY "message_attachments_read" ON public.message_attachments
      FOR SELECT USING (true);
    CREATE POLICY "message_attachments_write" ON public.message_attachments
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2b. message_responses
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_responses' AND table_schema = 'public') THEN
    ALTER TABLE public.message_responses ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "message_responses_read" ON public.message_responses;
    DROP POLICY IF EXISTS "message_responses_write" ON public.message_responses;

    CREATE POLICY "message_responses_read" ON public.message_responses
      FOR SELECT USING (true);
    CREATE POLICY "message_responses_write" ON public.message_responses
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2c. message_receipts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_receipts' AND table_schema = 'public') THEN
    ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "message_receipts_read" ON public.message_receipts;
    DROP POLICY IF EXISTS "message_receipts_write" ON public.message_receipts;

    CREATE POLICY "message_receipts_read" ON public.message_receipts
      FOR SELECT USING (true);
    CREATE POLICY "message_receipts_write" ON public.message_receipts
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2d. message_engagement
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_engagement' AND table_schema = 'public') THEN
    ALTER TABLE public.message_engagement ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "message_engagement_read" ON public.message_engagement;
    DROP POLICY IF EXISTS "message_engagement_write" ON public.message_engagement;

    CREATE POLICY "message_engagement_read" ON public.message_engagement
      FOR SELECT USING (true);
    CREATE POLICY "message_engagement_write" ON public.message_engagement
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2e. company_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_messages' AND table_schema = 'public') THEN
    ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "company_messages_read" ON public.company_messages;
    DROP POLICY IF EXISTS "company_messages_write" ON public.company_messages;

    CREATE POLICY "company_messages_read" ON public.company_messages
      FOR SELECT USING (true);
    CREATE POLICY "company_messages_write" ON public.company_messages
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2f. photos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'photos' AND table_schema = 'public') THEN
    ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "photos_read" ON public.photos;
    DROP POLICY IF EXISTS "photos_write" ON public.photos;

    CREATE POLICY "photos_read" ON public.photos
      FOR SELECT USING (true);
    CREATE POLICY "photos_write" ON public.photos
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2g. user_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "user_profiles_read" ON public.user_profiles;
    DROP POLICY IF EXISTS "user_profiles_write" ON public.user_profiles;

    CREATE POLICY "user_profiles_read" ON public.user_profiles
      FOR SELECT USING (true);
    CREATE POLICY "user_profiles_write" ON public.user_profiles
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2h. schema_migrations - internal table, only service role should access
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations' AND table_schema = 'public') THEN
    ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "schema_migrations_read" ON public.schema_migrations;
    DROP POLICY IF EXISTS "schema_migrations_write" ON public.schema_migrations;

    -- Only authenticated users can read migration history
    CREATE POLICY "schema_migrations_read" ON public.schema_migrations
      FOR SELECT USING (auth.role() = 'authenticated');
    -- Only service role should write (handled by Supabase)
  END IF;
END $$;

-- ============================================================================
-- PART 3: Revoke anon access from views that expose auth.users
-- These views join with auth.users and should NOT be accessible to anon role
-- ============================================================================

-- Revoke anon access from auth.users-exposing views
REVOKE ALL ON public.user_unread_messages FROM anon;
REVOKE ALL ON public.v_yard_worker_performance FROM anon;
REVOKE ALL ON public.v_yard_worker_leaderboard FROM anon;
REVOKE ALL ON public.v_project_analytics FROM anon;
REVOKE ALL ON public.v_estimator_leaderboard FROM anon;
REVOKE ALL ON public.fsm_team_full FROM anon;
REVOKE ALL ON public.available_reps_by_territory FROM anon;
REVOKE ALL ON public.crews_with_leads FROM anon;

-- Ensure authenticated users still have access
GRANT SELECT ON public.user_unread_messages TO authenticated;
GRANT SELECT ON public.v_yard_worker_performance TO authenticated;
GRANT SELECT ON public.v_yard_worker_leaderboard TO authenticated;
GRANT SELECT ON public.v_project_analytics TO authenticated;
GRANT SELECT ON public.v_estimator_leaderboard TO authenticated;
GRANT SELECT ON public.fsm_team_full TO authenticated;
GRANT SELECT ON public.available_reps_by_territory TO authenticated;
GRANT SELECT ON public.crews_with_leads TO authenticated;

-- ============================================================================
-- PART 4: Revoke anon access from all SECURITY DEFINER views
-- These views bypass RLS and should only be accessible to authenticated users
-- ============================================================================

-- Revoke anon from all security definer views
DO $$
DECLARE
  view_name TEXT;
  views_to_secure TEXT[] := ARRAY[
    'request_summary',
    'v_material_price_trends',
    'v_stale_yard_projects',
    'v_component_eligible_materials',
    'v_project_status_summary',
    'crew_skills_summary',
    'popular_tags',
    'v_fence_type_performance',
    'photo_stats_summary',
    'price_change_summary',
    'v_product_type_variable_values',
    'v_product_type_components_full',
    'v_fence_type_components',
    'v_business_unit_comparison',
    'territory_details',
    'v_material_category_summary',
    'v_pick_list',
    'v_sku_usage_analytics',
    'photo_upload_trends',
    'v_monthly_trends',
    'v_material_top_movers',
    'v_yard_summary_stats',
    'requests_with_access',
    'v_labor_rate_history_summary',
    'v_material_locations',
    'message_states',
    'v_labor_rate_comparison',
    'migration_status',
    'photo_analytics_by_uploader',
    'sales_reps_view',
    'v_component_eligible_materials_v2',
    'v_yard_schedule',
    'all_skus_queue',
    'v_daily_staging_volume',
    'v_yard_time_metrics'
  ];
BEGIN
  FOREACH view_name IN ARRAY views_to_secure
  LOOP
    -- Check if view exists before revoking
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = view_name AND table_schema = 'public'
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', view_name);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', view_name);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 5: Summary and verification query (for debugging)
-- Run this after migration to verify fixes
-- ============================================================================

-- Create a function to check security status (can be run manually)
CREATE OR REPLACE FUNCTION check_security_status()
RETURNS TABLE (
  object_type TEXT,
  object_name TEXT,
  has_rls BOOLEAN,
  anon_access TEXT
) AS $$
BEGIN
  -- Check tables without RLS
  RETURN QUERY
  SELECT
    'table'::TEXT,
    t.tablename::TEXT,
    t.rowsecurity,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_name = t.tablename AND grantee = 'anon'
    ) THEN 'YES' ELSE 'NO' END
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%';

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_security_status IS 'Diagnostic function to verify RLS and permissions status';

-- ============================================================================
-- Done!
-- ============================================================================
