-- Migration 198: Update territories to use FSM team system
-- Changes from old sales_reps + territory_assignments to
-- new fsm_team_profiles + fsm_territory_coverage

-- 1. Update territories_with_reps view to use fsm_territory_coverage
DROP VIEW IF EXISTS territories_with_reps;

CREATE VIEW territories_with_reps AS
SELECT
  t.id,
  t.name,
  t.code,
  t.zip_codes,
  t.business_unit_id,
  t.location_code,
  t.disabled_qbo_class_ids,
  t.is_active,
  t.created_at,
  t.updated_at,
  t.center_lat,
  t.center_lng,
  t.boundary_geojson,
  t.geometry,
  t.color,
  t.description,
  bu.name as business_unit_name,
  bu.code as business_unit_code,
  l.name as location_name,
  CASE
    WHEN t.location_code = 'ATX' THEN 'austin'
    WHEN t.location_code = 'SA' THEN 'san_antonio'
    WHEN t.location_code = 'HOU' THEN 'houston'
    ELSE NULL
  END as metro,
  -- Assigned reps from fsm_territory_coverage + user_profiles
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', up.id,
          'name', COALESCE(up.full_name, up.email),
          'is_primary', ftc.is_primary
        )
        ORDER BY ftc.is_primary DESC, up.full_name
      )
      FROM fsm_territory_coverage ftc
      JOIN user_profiles up ON ftc.user_id = up.id
      WHERE ftc.territory_id = t.id
    ),
    '[]'::jsonb
  ) as assigned_reps,
  -- Zip count
  COALESCE(array_length(t.zip_codes, 1), 0) as zip_count,
  -- Demographics aggregations
  (
    SELECT COALESCE(SUM(m.household_count), 0)
    FROM metro_zip_centroids m
    WHERE m.zip_code = ANY(t.zip_codes)
  ) as total_households,
  (
    SELECT COALESCE(SUM(m.population), 0)
    FROM metro_zip_centroids m
    WHERE m.zip_code = ANY(t.zip_codes)
  ) as total_population,
  (
    SELECT ROUND(AVG(m.median_income))::INT
    FROM metro_zip_centroids m
    WHERE m.zip_code = ANY(t.zip_codes)
      AND m.median_income IS NOT NULL
  ) as avg_median_income
FROM territories t
LEFT JOIN business_units bu ON t.business_unit_id = bu.id
LEFT JOIN locations l ON t.location_code = l.code;

COMMENT ON VIEW territories_with_reps IS 'Territories with assigned reps from FSM team system';
