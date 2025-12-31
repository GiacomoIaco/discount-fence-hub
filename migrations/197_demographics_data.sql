-- Migration 197: Add demographics data to metro_zip_centroids
-- Source: US Census Bureau ACS 5-Year Estimates
-- Variables: B11001_001E (total households), B19013_001E (median household income)

-- 1. Add demographics columns to metro_zip_centroids
ALTER TABLE metro_zip_centroids
ADD COLUMN IF NOT EXISTS household_count INT,
ADD COLUMN IF NOT EXISTS median_income INT;

COMMENT ON COLUMN metro_zip_centroids.household_count IS 'Total households from Census ACS B11001_001E';
COMMENT ON COLUMN metro_zip_centroids.median_income IS 'Median household income from Census ACS B19013_001E';

-- 2. Update territories_with_reps view to include demographics aggregations
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
  -- Assigned reps
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'name', sr.name,
          'is_primary', ta.is_primary
        )
        ORDER BY ta.is_primary DESC, sr.name
      )
      FROM territory_assignments ta
      JOIN sales_reps sr ON ta.sales_rep_id = sr.id
      WHERE ta.territory_id = t.id
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

COMMENT ON VIEW territories_with_reps IS 'Territories with assigned sales reps and aggregated demographics';
