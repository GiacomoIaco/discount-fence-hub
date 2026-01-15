-- ============================================================================
-- FSM TEST DATA: Territory Coverage
-- Assigns reps to territories for testing Request → Quote → Job flow
-- ============================================================================

-- Assign first 3 sales reps to "North Austin" territory
WITH north_austin AS (
  SELECT id FROM territories WHERE code = 'ATX-N' LIMIT 1
),
reps AS (
  SELECT ftp.user_id
  FROM fsm_team_profiles ftp
  JOIN user_profiles up ON up.id = ftp.user_id
  WHERE 'rep' = ANY(ftp.fsm_roles) AND ftp.is_active = true
  ORDER BY up.full_name
  LIMIT 3
)
INSERT INTO fsm_territory_coverage (user_id, territory_id, is_primary, coverage_days, is_active)
SELECT r.user_id, na.id, true, ARRAY['mon', 'tue', 'wed', 'thu', 'fri']::text[], true
FROM reps r, north_austin na
ON CONFLICT (user_id, territory_id) DO UPDATE SET is_active = true;

-- Assign next 2 reps to "Test area" territory
WITH test_area AS (
  SELECT id FROM territories WHERE code = 'TEST-AREA' LIMIT 1
),
reps AS (
  SELECT ftp.user_id
  FROM fsm_team_profiles ftp
  JOIN user_profiles up ON up.id = ftp.user_id
  WHERE 'rep' = ANY(ftp.fsm_roles) AND ftp.is_active = true
  ORDER BY up.full_name
  OFFSET 3 LIMIT 2
)
INSERT INTO fsm_territory_coverage (user_id, territory_id, is_primary, coverage_days, is_active)
SELECT r.user_id, ta.id, true, ARRAY['mon', 'tue', 'wed', 'thu', 'fri']::text[], true
FROM reps r, test_area ta
ON CONFLICT (user_id, territory_id) DO UPDATE SET is_active = true;

-- Verify coverage was created
SELECT up.full_name, t.name as territory, t.code, ftc.is_primary, ftc.is_active
FROM fsm_territory_coverage ftc
JOIN territories t ON t.id = ftc.territory_id
JOIN user_profiles up ON up.id = ftc.user_id
WHERE ftc.is_active = true
ORDER BY t.name, up.full_name;
