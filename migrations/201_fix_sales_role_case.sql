-- Migration 201: Fix case sensitivity for Sales role
-- The user_profiles.role column uses lowercase 'sales', not 'Sales'

-- Create fsm_team_profiles for sales users (lowercase) who don't already have one
INSERT INTO fsm_team_profiles (user_id, fsm_roles, is_active, max_daily_assessments)
SELECT
  up.id,
  ARRAY['rep']::text[],
  true,
  8  -- Default max daily assessments
FROM user_profiles up
WHERE LOWER(up.role) = 'sales'
  AND NOT EXISTS (
    SELECT 1 FROM fsm_team_profiles fp WHERE fp.user_id = up.id
  );

-- Also ensure any existing profiles for sales users have 'rep' in their fsm_roles
UPDATE fsm_team_profiles fp
SET fsm_roles = CASE
  WHEN 'rep' = ANY(fsm_roles) THEN fsm_roles
  ELSE array_append(COALESCE(fsm_roles, ARRAY[]::text[]), 'rep')
END
FROM user_profiles up
WHERE fp.user_id = up.id
  AND LOWER(up.role) = 'sales'
  AND (fsm_roles IS NULL OR NOT ('rep' = ANY(fsm_roles)));
