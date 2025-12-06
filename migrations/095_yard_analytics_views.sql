-- ============================================
-- Migration 095: Yard Analytics Views
-- ============================================
-- Creates views for yard operations analytics:
-- - Worker performance (staging counts by person)
-- - Daily staging volume
-- - Time metrics (staged to loaded, etc.)
-- - Stale projects (3+ business days in yard)

-- ============================================
-- 1. Yard Worker Performance View
-- ============================================
-- Shows staging/loading counts per worker per day
CREATE OR REPLACE VIEW v_yard_worker_performance AS
SELECT
  psh.changed_by as worker_id,
  COALESCE(u.raw_user_meta_data->>'name', 'Unknown') as worker_name,
  DATE_TRUNC('day', psh.changed_at)::date as work_date,
  COUNT(*) FILTER (WHERE psh.new_status = 'staged') as projects_staged,
  COUNT(*) FILTER (WHERE psh.new_status = 'loaded') as projects_loaded,
  COUNT(*) FILTER (WHERE psh.new_status = 'complete') as projects_completed,
  COUNT(*) as total_actions
FROM project_status_history psh
LEFT JOIN auth.users u ON psh.changed_by = u.id
WHERE psh.new_status IN ('staged', 'loaded', 'complete')
  AND psh.changed_by IS NOT NULL
GROUP BY psh.changed_by, u.raw_user_meta_data->>'name', DATE_TRUNC('day', psh.changed_at)::date;

-- Grant access
GRANT SELECT ON v_yard_worker_performance TO authenticated;

-- ============================================
-- 2. Daily Staging Volume View
-- ============================================
-- Shows daily staging count by yard
CREATE OR REPLACE VIEW v_daily_staging_volume AS
SELECT
  DATE_TRUNC('day', psh.changed_at)::date as work_date,
  bu.code as yard_code,
  bu.name as yard_name,
  COUNT(*) as projects_staged,
  COUNT(DISTINCT psh.changed_by) as unique_workers
FROM project_status_history psh
JOIN bom_projects p ON psh.project_id = p.id
JOIN business_units bu ON p.business_unit_id = bu.id
WHERE psh.new_status = 'staged'
GROUP BY DATE_TRUNC('day', psh.changed_at)::date, bu.code, bu.name
ORDER BY work_date DESC;

-- Grant access
GRANT SELECT ON v_daily_staging_volume TO authenticated;

-- ============================================
-- 3. Yard Time Metrics View
-- ============================================
-- Shows time between status changes for each project
CREATE OR REPLACE VIEW v_yard_time_metrics AS
SELECT
  p.id as project_id,
  p.project_code,
  p.project_name,
  bu.code as yard_code,
  staged.changed_at as staged_at,
  loaded.changed_at as loaded_at,
  completed.changed_at as completed_at,
  -- Hours from staged to loaded
  CASE
    WHEN loaded.changed_at IS NOT NULL AND staged.changed_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (loaded.changed_at - staged.changed_at)) / 3600, 1)
    ELSE NULL
  END as hours_staged_to_loaded,
  -- Hours from loaded to complete
  CASE
    WHEN completed.changed_at IS NOT NULL AND loaded.changed_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (completed.changed_at - loaded.changed_at)) / 3600, 1)
    ELSE NULL
  END as hours_loaded_to_complete,
  -- Total hours from staged to complete
  CASE
    WHEN completed.changed_at IS NOT NULL AND staged.changed_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (completed.changed_at - staged.changed_at)) / 3600, 1)
    ELSE NULL
  END as hours_staged_to_complete
FROM bom_projects p
JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'staged'
  ORDER BY changed_at LIMIT 1
) staged ON true
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'loaded'
  ORDER BY changed_at LIMIT 1
) loaded ON true
LEFT JOIN LATERAL (
  SELECT changed_at FROM project_status_history
  WHERE project_id = p.id AND new_status = 'complete'
  ORDER BY changed_at LIMIT 1
) completed ON true
WHERE staged.changed_at IS NOT NULL;

-- Grant access
GRANT SELECT ON v_yard_time_metrics TO authenticated;

-- ============================================
-- 4. Stale Yard Projects View
-- ============================================
-- Projects that have been staged/loaded for 3+ business days
CREATE OR REPLACE VIEW v_stale_yard_projects AS
WITH staged_projects AS (
  SELECT
    p.id,
    p.project_code,
    p.project_name,
    p.customer_name,
    bu.code as yard_code,
    p.status,
    p.expected_pickup_date,
    (
      SELECT changed_at FROM project_status_history
      WHERE project_id = p.id AND new_status = 'staged'
      ORDER BY changed_at DESC LIMIT 1
    ) as staged_at
  FROM bom_projects p
  JOIN business_units bu ON p.business_unit_id = bu.id
  WHERE p.status IN ('staged', 'loaded')
    AND p.is_archived = false
)
SELECT
  sp.*,
  -- Calculate business days since staged (excluding weekends)
  (
    SELECT COUNT(*)::integer FROM generate_series(
      sp.staged_at::date + 1,
      CURRENT_DATE,
      '1 day'::interval
    ) d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
  ) as business_days_staged
FROM staged_projects sp
WHERE sp.staged_at IS NOT NULL
  AND (
    SELECT COUNT(*) FROM generate_series(
      sp.staged_at::date + 1,
      CURRENT_DATE,
      '1 day'::interval
    ) d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
  ) >= 3
ORDER BY business_days_staged DESC;

-- Grant access
GRANT SELECT ON v_stale_yard_projects TO authenticated;

-- ============================================
-- 5. Yard Summary Stats View
-- ============================================
-- Quick summary stats for yard operations
CREATE OR REPLACE VIEW v_yard_summary_stats AS
SELECT
  bu.code as yard_code,
  bu.name as yard_name,
  -- Today's staging
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND DATE_TRUNC('day', psh.changed_at) = CURRENT_DATE
  ) as staged_today,
  -- This week's staging
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND psh.changed_at >= DATE_TRUNC('week', CURRENT_DATE)
  ) as staged_this_week,
  -- Today's loaded
  COUNT(*) FILTER (
    WHERE psh.new_status = 'loaded'
    AND DATE_TRUNC('day', psh.changed_at) = CURRENT_DATE
  ) as loaded_today,
  -- Today's completed
  COUNT(*) FILTER (
    WHERE psh.new_status = 'complete'
    AND DATE_TRUNC('day', psh.changed_at) = CURRENT_DATE
  ) as completed_today,
  -- Currently in yard (staged or loaded)
  (
    SELECT COUNT(*) FROM bom_projects bp
    WHERE bp.business_unit_id = bu.id
    AND bp.status IN ('staged', 'loaded')
    AND bp.is_archived = false
  ) as currently_in_yard
FROM business_units bu
LEFT JOIN bom_projects p ON p.business_unit_id = bu.id
LEFT JOIN project_status_history psh ON psh.project_id = p.id
GROUP BY bu.id, bu.code, bu.name;

-- Grant access
GRANT SELECT ON v_yard_summary_stats TO authenticated;

-- ============================================
-- 6. Worker Leaderboard View (aggregated)
-- ============================================
-- Leaderboard with total counts for different time periods
CREATE OR REPLACE VIEW v_yard_worker_leaderboard AS
SELECT
  psh.changed_by as worker_id,
  COALESCE(u.raw_user_meta_data->>'name', 'Unknown') as worker_name,
  -- Today
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND DATE_TRUNC('day', psh.changed_at) = CURRENT_DATE
  ) as staged_today,
  -- This week
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND psh.changed_at >= DATE_TRUNC('week', CURRENT_DATE)
  ) as staged_this_week,
  -- This month
  COUNT(*) FILTER (
    WHERE psh.new_status = 'staged'
    AND psh.changed_at >= DATE_TRUNC('month', CURRENT_DATE)
  ) as staged_this_month,
  -- All time
  COUNT(*) FILTER (WHERE psh.new_status = 'staged') as staged_all_time,
  -- Loaded counts
  COUNT(*) FILTER (WHERE psh.new_status = 'loaded') as loaded_all_time,
  COUNT(*) FILTER (WHERE psh.new_status = 'complete') as completed_all_time
FROM project_status_history psh
LEFT JOIN auth.users u ON psh.changed_by = u.id
WHERE psh.new_status IN ('staged', 'loaded', 'complete')
  AND psh.changed_by IS NOT NULL
GROUP BY psh.changed_by, u.raw_user_meta_data->>'name'
ORDER BY staged_this_week DESC;

-- Grant access
GRANT SELECT ON v_yard_worker_leaderboard TO authenticated;
