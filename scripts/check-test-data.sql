-- ============================================================================
-- VERIFY TEST DATA FOR FSM END-TO-END TESTING
-- Run with: npm run migrate:direct scripts/check-test-data.sql
-- ============================================================================

-- 1. Locations
SELECT 'LOCATIONS' as table_name, count(*) as count FROM locations;
SELECT id, code, name FROM locations;

-- 2. QBO Classes (selectable)
SELECT 'QBO_CLASSES' as table_name, count(*) as count FROM qbo_classes WHERE is_selectable = true;
SELECT id, name, labor_code, location_code, bu_type FROM qbo_classes WHERE is_selectable = true ORDER BY name;

-- 3. Territories
SELECT 'TERRITORIES' as table_name, count(*) as count FROM territories WHERE is_active = true;
SELECT id, name, code, array_length(zip_codes, 1) as zip_count, location_code FROM territories WHERE is_active = true ORDER BY name;

-- 4. Crews
SELECT 'CREWS' as table_name, count(*) as count FROM crews WHERE is_active = true;
SELECT id, name, code, location_code, crew_size FROM crews WHERE is_active = true ORDER BY name;

-- 5. FSM Team Profiles (reps)
SELECT 'FSM_TEAM_PROFILES (reps)' as table_name, count(*) as count
FROM fsm_team_profiles ftp
WHERE 'rep' = ANY(ftp.fsm_roles) AND ftp.is_active = true;

SELECT ftp.user_id, up.full_name, up.email, ftp.fsm_roles
FROM fsm_team_profiles ftp
JOIN user_profiles up ON up.id = ftp.user_id
WHERE 'rep' = ANY(ftp.fsm_roles) AND ftp.is_active = true
ORDER BY up.full_name;

-- 6. Territory Coverage (who covers what)
SELECT 'TERRITORY_COVERAGE' as table_name, count(*) as count FROM fsm_territory_coverage WHERE is_active = true;

SELECT
  up.full_name as rep_name,
  t.name as territory_name,
  t.code as territory_code,
  ftc.is_primary,
  ftc.coverage_days
FROM fsm_territory_coverage ftc
JOIN territories t ON t.id = ftc.territory_id
JOIN user_profiles up ON up.id = ftc.user_id
WHERE ftc.is_active = true
ORDER BY up.full_name, t.name;
