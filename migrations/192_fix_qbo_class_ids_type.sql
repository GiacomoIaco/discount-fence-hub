-- Migration 192: Fix assigned_qbo_class_ids column type
-- QBO Class IDs from QuickBooks are numeric strings (e.g., "625399"), not UUIDs
-- This migration changes the column type from uuid[] to text[]

-- 1. Drop the view first (it depends on the column we're changing)
DROP VIEW IF EXISTS fsm_team_full;

-- 2. Change column type from uuid[] to text[]
ALTER TABLE fsm_team_profiles
  ALTER COLUMN assigned_qbo_class_ids TYPE text[] USING assigned_qbo_class_ids::text[];

-- 3. Recreate the fsm_team_full view

CREATE OR REPLACE VIEW fsm_team_full AS
SELECT
  u.id as user_id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.email) as name,
  u.email,
  fp.fsm_roles,
  fp.assigned_qbo_class_ids,
  fp.max_daily_assessments,
  fp.crew_id,
  fp.is_active,
  fp.created_at,
  fp.updated_at,
  -- Aggregate territories with coverage info
  COALESCE(
    (SELECT json_agg(json_build_object(
      'territory_id', tc.territory_id,
      'territory_name', t.name,
      'territory_code', t.code,
      'coverage_days', tc.coverage_days,
      'is_primary', tc.is_primary
    ))
    FROM fsm_territory_coverage tc
    JOIN territories t ON t.id = tc.territory_id
    WHERE tc.user_id = u.id AND tc.is_active = true),
    '[]'::json
  ) as territories,
  -- Aggregate skills with project type info
  COALESCE(
    (SELECT json_agg(json_build_object(
      'project_type_id', ps.project_type_id,
      'project_type_name', pt.name,
      'proficiency', ps.proficiency
    ))
    FROM fsm_person_skills ps
    JOIN project_types pt ON pt.id = ps.project_type_id
    WHERE ps.user_id = u.id),
    '[]'::json
  ) as skills,
  -- Aggregate work schedule
  COALESCE(
    (SELECT json_agg(json_build_object(
      'day_of_week', ws.day_of_week,
      'start_time', ws.start_time,
      'end_time', ws.end_time
    ))
    FROM fsm_work_schedules ws
    WHERE ws.user_id = u.id),
    '[]'::json
  ) as work_schedule
FROM auth.users u
JOIN fsm_team_profiles fp ON fp.user_id = u.id
WHERE fp.is_active = true;

-- Grant access to the view
GRANT SELECT ON fsm_team_full TO authenticated;

COMMENT ON TABLE fsm_team_profiles IS 'FSM team profiles with assigned_qbo_class_ids as text[] to match QBO API IDs';
