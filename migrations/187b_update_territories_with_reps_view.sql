-- Migration 187b: Update territories_with_reps view to include location info
-- This adds location_code and location_name to the existing view

-- Must drop and recreate to add new columns
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
  array_length(t.zip_codes, 1) as zip_count
FROM territories t
LEFT JOIN business_units bu ON t.business_unit_id = bu.id
LEFT JOIN locations l ON t.location_code = l.code;
