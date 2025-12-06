-- Migration: 092_fix_views_archived_filter.sql
-- Description: Fix v_yard_schedule and v_pick_list views to check is_archived field
-- instead of checking for status='archived' which is never set

-- ============================================
-- 1. FIX v_yard_schedule VIEW
-- ============================================

CREATE OR REPLACE VIEW v_yard_schedule AS
SELECT
  bp.id,
  bp.project_code,
  bp.project_name,
  bp.customer_name,
  bp.customer_address,
  bp.expected_pickup_date,
  bp.status,
  bp.crew_name,
  bp.is_bundle,
  bp.bundle_id,
  bp.bundle_name,
  bp.partial_pickup,
  bp.partial_pickup_notes,
  bp.yard_spot_id,
  bp.total_linear_feet,
  bp.total_material_cost,
  bp.business_unit_id,
  y.id as yard_id,
  y.code as yard_code,
  y.name as yard_name,
  ys.spot_code,
  ys.spot_name,
  -- Bundle info: count of projects in bundle
  CASE
    WHEN bp.is_bundle THEN (SELECT COUNT(*) FROM bom_projects WHERE bundle_id = bp.id)
    ELSE NULL
  END as bundle_project_count,
  -- Get child projects if this is a bundle
  CASE
    WHEN bp.is_bundle THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'id', child.id,
        'project_code', child.project_code,
        'project_name', child.project_name,
        'customer_name', child.customer_name
      ))
      FROM bom_projects child
      WHERE child.bundle_id = bp.id
    )
    ELSE NULL
  END as bundle_projects
FROM bom_projects bp
LEFT JOIN yards y ON y.id = bp.yard_id
LEFT JOIN yard_spots ys ON ys.id = bp.yard_spot_id
WHERE bp.bundle_id IS NULL -- Don't show projects that are part of a bundle (show the bundle instead)
  AND bp.status NOT IN ('cancelled', 'draft')
  AND COALESCE(bp.is_archived, false) = false -- Filter out archived projects
ORDER BY bp.expected_pickup_date, bp.project_code;

-- ============================================
-- 2. FIX v_pick_list VIEW
-- ============================================

CREATE OR REPLACE VIEW v_pick_list AS
SELECT
  -- If bundled, use bundle ID, otherwise project ID
  COALESCE(bp.bundle_id, bp.id) as pickup_id,
  COALESCE(bundle.project_code, bp.project_code) as pickup_code,
  COALESCE(bundle.project_name, bp.project_name) as pickup_name,
  COALESCE(bundle.is_bundle, false) as is_bundle,

  -- Material info (aggregated)
  pm.material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_type,
  SUM(pm.final_quantity) as total_quantity,

  -- Project context
  bp.yard_id,
  bp.expected_pickup_date

FROM bom_projects bp
LEFT JOIN bom_projects bundle ON bundle.id = bp.bundle_id
INNER JOIN project_materials pm ON pm.project_id = bp.id
INNER JOIN materials m ON m.id = pm.material_id
WHERE bp.status NOT IN ('cancelled', 'draft', 'completed')
  AND COALESCE(bp.is_archived, false) = false -- Filter out archived projects
GROUP BY
  COALESCE(bp.bundle_id, bp.id),
  COALESCE(bundle.project_code, bp.project_code),
  COALESCE(bundle.project_name, bp.project_name),
  COALESCE(bundle.is_bundle, false),
  pm.material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_type,
  bp.yard_id,
  bp.expected_pickup_date
ORDER BY m.category, m.material_name;
