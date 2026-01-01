-- Migration 200: Auto-create FSM team profiles for Sales users
-- Users with role='Sales' should automatically appear in FSM Team Management
-- so they can be configured with territories, skills, and schedules.

-- Create fsm_team_profiles for Sales users who don't already have one
INSERT INTO fsm_team_profiles (user_id, fsm_roles, is_active, max_daily_assessments)
SELECT
  up.id,
  ARRAY['rep']::text[],
  true,
  8  -- Default max daily assessments
FROM user_profiles up
WHERE up.role = 'Sales'
  AND NOT EXISTS (
    SELECT 1 FROM fsm_team_profiles fp WHERE fp.user_id = up.id
  );

-- Also ensure any existing profiles for Sales users have 'rep' in their fsm_roles
UPDATE fsm_team_profiles fp
SET fsm_roles = CASE
  WHEN 'rep' = ANY(fsm_roles) THEN fsm_roles
  ELSE array_append(COALESCE(fsm_roles, ARRAY[]::text[]), 'rep')
END
FROM user_profiles up
WHERE fp.user_id = up.id
  AND up.role = 'Sales'
  AND (fsm_roles IS NULL OR NOT ('rep' = ANY(fsm_roles)));

COMMENT ON TABLE fsm_team_profiles IS 'FSM team profiles - auto-created for Sales users, configurable via Settings > Team Management';
