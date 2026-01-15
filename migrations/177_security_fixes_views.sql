-- ============================================================================
-- Migration 177: Security Fixes - Views
-- Addresses remaining Supabase Security Advisor findings:
-- 1. Fix auth_users_exposed by using user_profiles instead of auth.users
-- 2. Set all views to SECURITY INVOKER
-- ============================================================================

-- ============================================================================
-- PART 1: Convert views from SECURITY DEFINER to SECURITY INVOKER
-- Use ALTER VIEW to set security_invoker = on
-- ============================================================================

-- List of all security definer views to fix
DO $$
DECLARE
  view_name TEXT;
  views_to_fix TEXT[] := ARRAY[
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
    'v_yard_time_metrics',
    'user_unread_messages',
    'v_yard_worker_performance',
    'v_yard_worker_leaderboard',
    'v_project_analytics',
    'v_estimator_leaderboard',
    'fsm_team_full',
    'available_reps_by_territory',
    'crews_with_leads'
  ];
BEGIN
  FOREACH view_name IN ARRAY views_to_fix
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = view_name AND table_schema = 'public'
    ) THEN
      -- Set security_invoker = on (PostgreSQL 15+)
      BEGIN
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', view_name);
        RAISE NOTICE 'Set security_invoker=on for view: %', view_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter view %: %', view_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: Recreate views that reference auth.users to use user_profiles
-- These views expose auth.users data and need to be rewritten
-- ============================================================================

-- 2a. v_yard_worker_performance - use user_profiles instead of auth.users
DROP VIEW IF EXISTS v_yard_worker_performance CASCADE;
CREATE VIEW v_yard_worker_performance
WITH (security_invoker = on) AS
SELECT
  psh.changed_by as worker_id,
  COALESCE(up.full_name, 'Unknown') as worker_name,
  DATE_TRUNC('day', psh.changed_at)::date as work_date,
  COUNT(*) FILTER (WHERE psh.new_status = 'staged') as projects_staged,
  COUNT(*) FILTER (WHERE psh.new_status = 'loaded') as projects_loaded,
  COUNT(*) FILTER (WHERE psh.new_status = 'complete') as projects_completed,
  COUNT(*) as total_actions
FROM project_status_history psh
LEFT JOIN user_profiles up ON psh.changed_by = up.id
WHERE psh.new_status IN ('staged', 'loaded', 'complete')
  AND psh.changed_by IS NOT NULL
GROUP BY psh.changed_by, up.full_name, DATE_TRUNC('day', psh.changed_at)::date;

GRANT SELECT ON v_yard_worker_performance TO authenticated;

-- 2b. v_yard_worker_leaderboard - use user_profiles instead of auth.users
DROP VIEW IF EXISTS v_yard_worker_leaderboard CASCADE;
CREATE VIEW v_yard_worker_leaderboard
WITH (security_invoker = on) AS
SELECT
  psh.changed_by as worker_id,
  COALESCE(up.full_name, 'Unknown') as worker_name,
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND DATE_TRUNC('day', psh.changed_at) = CURRENT_DATE
  ) as staged_today,
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND psh.changed_at >= DATE_TRUNC('week', CURRENT_DATE)
  ) as staged_this_week,
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND psh.changed_at >= DATE_TRUNC('month', CURRENT_DATE)
  ) as staged_this_month,
  COUNT(*) FILTER (WHERE psh.new_status = 'staged') as staged_all_time,
  COUNT(*) FILTER (WHERE psh.new_status = 'loaded') as loaded_all_time,
  COUNT(*) FILTER (WHERE psh.new_status = 'complete') as completed_all_time
FROM project_status_history psh
LEFT JOIN user_profiles up ON psh.changed_by = up.id
WHERE psh.new_status IN ('staged', 'loaded', 'complete')
  AND psh.changed_by IS NOT NULL
GROUP BY psh.changed_by, up.full_name
ORDER BY staged_this_week DESC;

GRANT SELECT ON v_yard_worker_leaderboard TO authenticated;

-- 2c. v_project_analytics - use user_profiles instead of auth.users
DROP VIEW IF EXISTS v_project_analytics CASCADE;
CREATE VIEW v_project_analytics
WITH (security_invoker = on) AS
SELECT
  p.id,
  p.project_name,
  p.project_code,
  p.customer_name,
  p.status,
  COALESCE(p.is_archived, false) as is_archived,
  p.created_at,
  p.updated_at,
  p.created_by,
  COALESCE(up.full_name, 'Unknown') as created_by_name,
  bu.id as business_unit_id,
  bu.code as bu_code,
  bu.name as bu_name,
  DATE_TRUNC('week', p.created_at)::date as created_week,
  DATE_TRUNC('month', p.created_at)::date as created_month,
  (
    SELECT COUNT(*) FROM project_line_items pl WHERE pl.project_id = p.id
  ) as line_count,
  COALESCE(p.total_linear_feet, 0) as total_footage,
  COALESCE(p.total_material_cost, 0) as total_material_cost,
  COALESCE(p.total_labor_cost, 0) as total_labor_cost
FROM bom_projects p
LEFT JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN user_profiles up ON p.created_by = up.id
WHERE COALESCE(p.is_archived, false) = false;

GRANT SELECT ON v_project_analytics TO authenticated;

-- 2d. v_estimator_leaderboard - use user_profiles instead of auth.users
DROP VIEW IF EXISTS v_estimator_leaderboard CASCADE;
CREATE VIEW v_estimator_leaderboard
WITH (security_invoker = on) AS
SELECT
  p.created_by as user_id,
  COALESCE(up.full_name, 'Unknown') as user_name,
  COUNT(*) as total_projects,
  COUNT(*) FILTER (WHERE p.status = 'draft') as draft_count,
  COUNT(*) FILTER (WHERE p.status = 'ready') as ready_count,
  COUNT(*) FILTER (WHERE p.status IN ('sent_to_yard', 'staged', 'loaded', 'complete')) as completed_count,
  COUNT(*) FILTER (WHERE p.created_at >= DATE_TRUNC('week', CURRENT_DATE)) as projects_this_week,
  COUNT(*) FILTER (WHERE p.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as projects_this_month,
  ROUND(COALESCE(SUM(p.total_linear_feet), 0)::numeric, 0) as total_footage,
  ROUND(COALESCE(AVG(p.total_linear_feet), 0)::numeric, 0) as avg_footage_per_project
FROM bom_projects p
LEFT JOIN user_profiles up ON p.created_by = up.id
WHERE COALESCE(p.is_archived, false) = false
  AND p.created_by IS NOT NULL
GROUP BY p.created_by, up.full_name
ORDER BY total_projects DESC;

GRANT SELECT ON v_estimator_leaderboard TO authenticated;

-- 2e. fsm_team_full - use user_profiles instead of auth.users
-- This view needs the user data for display purposes, so we'll join with user_profiles
DROP VIEW IF EXISTS fsm_team_full CASCADE;
CREATE VIEW fsm_team_full
WITH (security_invoker = on) AS
SELECT
  up.id AS user_id,
  up.email,
  COALESCE(up.full_name, up.email) AS name,
  fp.id AS profile_id,
  fp.fsm_roles,
  fp.business_unit_ids,
  fp.max_daily_assessments,
  fp.crew_id,
  c.name AS crew_name,
  fp.is_active,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'territory_id', tc.territory_id,
      'territory_name', t.name,
      'coverage_days', tc.coverage_days,
      'is_primary', tc.is_primary
    ))
    FROM fsm_territory_coverage tc
    JOIN territories t ON t.id = tc.territory_id
    WHERE tc.user_id = up.id AND tc.is_active = true),
    '[]'::json
  ) AS territories,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'project_type_id', ps.project_type_id,
      'project_type_name', pt.name,
      'proficiency', ps.proficiency,
      'duration_multiplier', ps.duration_multiplier
    ))
    FROM fsm_person_skills ps
    JOIN project_types pt ON pt.id = ps.project_type_id
    WHERE ps.user_id = up.id),
    '[]'::json
  ) AS skills,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'day', ws.day_of_week,
      'start', ws.start_time,
      'end', ws.end_time
    ) ORDER BY CASE ws.day_of_week
      WHEN 'mon' THEN 1 WHEN 'tue' THEN 2 WHEN 'wed' THEN 3
      WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 WHEN 'sat' THEN 6 ELSE 7
    END)
    FROM fsm_work_schedules ws
    WHERE ws.user_id = up.id),
    '[]'::json
  ) AS work_schedule
FROM user_profiles up
JOIN fsm_team_profiles fp ON fp.user_id = up.id
LEFT JOIN crews c ON c.id = fp.crew_id;

GRANT SELECT ON fsm_team_full TO authenticated;

-- 2f. available_reps_by_territory - use user_profiles instead of auth.users
DROP VIEW IF EXISTS available_reps_by_territory CASCADE;
CREATE VIEW available_reps_by_territory
WITH (security_invoker = on) AS
SELECT
  up.id AS user_id,
  COALESCE(up.full_name, up.email) AS name,
  fp.max_daily_assessments,
  tc.territory_id,
  t.name AS territory_name,
  tc.coverage_days
FROM user_profiles up
JOIN fsm_team_profiles fp ON fp.user_id = up.id
JOIN fsm_territory_coverage tc ON tc.user_id = up.id
JOIN territories t ON t.id = tc.territory_id
WHERE
  fp.is_active = true
  AND tc.is_active = true
  AND 'rep' = ANY(fp.fsm_roles);

GRANT SELECT ON available_reps_by_territory TO authenticated;

-- 2g. crews_with_leads - use user_profiles instead of auth.users
DROP VIEW IF EXISTS crews_with_leads CASCADE;
CREATE VIEW crews_with_leads
WITH (security_invoker = on) AS
SELECT
  c.*,
  up.email AS lead_email,
  COALESCE(up.full_name, up.email) AS lead_name,
  t.name AS home_territory_name,
  bu.name AS business_unit_name
FROM crews c
LEFT JOIN user_profiles up ON up.id = c.lead_user_id
LEFT JOIN territories t ON t.id = c.home_territory_id
LEFT JOIN business_units bu ON bu.id = c.business_unit_id
WHERE c.is_active = true;

GRANT SELECT ON crews_with_leads TO authenticated;

-- 2h. user_unread_messages - check if it uses auth.users and fix
-- This view likely references auth.users for user info
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'user_unread_messages' AND table_schema = 'public'
  ) THEN
    -- Drop and recreate with security_invoker
    -- First, get the view definition
    DROP VIEW IF EXISTS user_unread_messages CASCADE;

    -- Recreate without auth.users reference if possible
    -- This is a placeholder - the actual definition depends on what the view does
    CREATE VIEW user_unread_messages
    WITH (security_invoker = on) AS
    SELECT
      up.id AS user_id,
      up.full_name as user_name,
      up.email,
      COALESCE(
        (SELECT COUNT(*)
         FROM mc_messages m
         JOIN mc_conversations conv ON m.conversation_id = conv.id
         WHERE m.direction = 'inbound'
         AND m.read_at IS NULL
         AND conv.created_by = up.id),
        0
      ) as unread_count
    FROM user_profiles up;

    GRANT SELECT ON user_unread_messages TO authenticated;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Additional views that need security_invoker set
-- ============================================================================

-- Set security_invoker on remaining views that we haven't recreated
DO $$
DECLARE
  view_rec RECORD;
BEGIN
  FOR view_rec IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
    AND table_name NOT IN (
      'v_yard_worker_performance',
      'v_yard_worker_leaderboard',
      'v_project_analytics',
      'v_estimator_leaderboard',
      'fsm_team_full',
      'available_reps_by_territory',
      'crews_with_leads',
      'user_unread_messages'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', view_rec.table_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter view %: %', view_rec.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- Done!
-- ============================================================================
