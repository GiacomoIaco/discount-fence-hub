-- ============================================
-- Migration 096: Advanced Analytics Views
-- ============================================
-- Creates views for comprehensive analytics:
-- - Material price trends and top movers
-- - Labor rate analytics
-- - Project analytics
-- - SKU performance
-- - Business unit comparison

-- ============================================
-- 1. Material Price Trends View
-- ============================================
CREATE OR REPLACE VIEW v_material_price_trends AS
SELECT
  m.id as material_id,
  m.material_sku as material_code,
  m.material_name,
  m.category,
  m.sub_category as subcategory,
  m.unit_cost as current_price,
  mph.id as history_id,
  mph.old_price,
  mph.new_price,
  mph.price_change,
  mph.price_change_percent,
  mph.changed_at,
  DATE_TRUNC('week', mph.changed_at)::date as week,
  DATE_TRUNC('month', mph.changed_at)::date as month
FROM materials m
LEFT JOIN material_price_history mph ON m.id = mph.material_id
WHERE m.status = 'Active'
ORDER BY mph.changed_at DESC NULLS LAST;

GRANT SELECT ON v_material_price_trends TO authenticated;

-- ============================================
-- 2. Material Top Movers View (30 days)
-- ============================================
CREATE OR REPLACE VIEW v_material_top_movers AS
SELECT
  m.id as material_id,
  m.material_sku as material_code,
  m.material_name,
  m.category,
  m.unit_cost as current_price,
  COUNT(mph.id) as change_count,
  SUM(mph.price_change) as total_change,
  ROUND(AVG(mph.price_change_percent)::numeric, 2) as avg_change_percent,
  MIN(mph.old_price) as min_price_30d,
  MAX(mph.new_price) as max_price_30d,
  MAX(mph.changed_at) as last_change
FROM materials m
JOIN material_price_history mph ON m.id = mph.material_id
WHERE mph.changed_at >= NOW() - INTERVAL '30 days'
  AND m.status = 'Active'
GROUP BY m.id, m.material_sku, m.material_name, m.category, m.unit_cost
ORDER BY ABS(SUM(mph.price_change)) DESC;

GRANT SELECT ON v_material_top_movers TO authenticated;

-- ============================================
-- 3. Material Category Summary View
-- ============================================
CREATE OR REPLACE VIEW v_material_category_summary AS
SELECT
  m.category,
  COUNT(*) as material_count,
  ROUND(AVG(m.unit_cost)::numeric, 2) as avg_cost,
  ROUND(MIN(m.unit_cost)::numeric, 2) as min_cost,
  ROUND(MAX(m.unit_cost)::numeric, 2) as max_cost,
  COUNT(DISTINCT mph.material_id) FILTER (WHERE mph.changed_at >= NOW() - INTERVAL '30 days') as changed_last_30d,
  ROUND(SUM(mph.price_change) FILTER (WHERE mph.changed_at >= NOW() - INTERVAL '30 days')::numeric, 2) as total_change_30d
FROM materials m
LEFT JOIN material_price_history mph ON m.id = mph.material_id
WHERE m.status = 'Active'
GROUP BY m.category
ORDER BY material_count DESC;

GRANT SELECT ON v_material_category_summary TO authenticated;

-- ============================================
-- 4. Labor Rate Comparison View
-- ============================================
CREATE OR REPLACE VIEW v_labor_rate_comparison AS
SELECT
  lc.id as labor_code_id,
  lc.labor_sku as labor_code,
  lc.description as labor_description,
  bu.id as business_unit_id,
  bu.code as bu_code,
  bu.name as bu_name,
  lr.rate as current_rate,
  (
    SELECT COUNT(*) FROM labor_rate_history lrh
    WHERE lrh.labor_rate_id = lr.id
    AND lrh.changed_at >= NOW() - INTERVAL '90 days'
  ) as changes_90d,
  (
    SELECT lrh.rate_change FROM labor_rate_history lrh
    WHERE lrh.labor_rate_id = lr.id
    ORDER BY lrh.changed_at DESC LIMIT 1
  ) as last_change_amount,
  (
    SELECT lrh.changed_at FROM labor_rate_history lrh
    WHERE lrh.labor_rate_id = lr.id
    ORDER BY lrh.changed_at DESC LIMIT 1
  ) as last_change_date
FROM labor_codes lc
CROSS JOIN business_units bu
LEFT JOIN labor_rates lr ON lr.labor_code_id = lc.id AND lr.business_unit_id = bu.id
ORDER BY lc.labor_sku, bu.code;

GRANT SELECT ON v_labor_rate_comparison TO authenticated;

-- ============================================
-- 5. Labor Rate History Summary
-- ============================================
CREATE OR REPLACE VIEW v_labor_rate_history_summary AS
SELECT
  lrh.labor_code,
  lrh.business_unit_code,
  DATE_TRUNC('month', lrh.changed_at)::date as month,
  COUNT(*) as change_count,
  ROUND(SUM(lrh.rate_change)::numeric, 2) as total_change,
  ROUND(AVG(lrh.rate_change_percent)::numeric, 2) as avg_change_percent
FROM labor_rate_history lrh
GROUP BY lrh.labor_code, lrh.business_unit_code, DATE_TRUNC('month', lrh.changed_at)::date
ORDER BY month DESC, labor_code;

GRANT SELECT ON v_labor_rate_history_summary TO authenticated;

-- ============================================
-- 6. Project Analytics View
-- ============================================
CREATE OR REPLACE VIEW v_project_analytics AS
SELECT
  p.id,
  p.project_name,
  p.project_code,
  p.customer_name,
  p.status,
  p.is_archived,
  p.created_at,
  p.updated_at,
  p.created_by,
  COALESCE(u.raw_user_meta_data->>'name', 'Unknown') as created_by_name,
  bu.id as business_unit_id,
  bu.code as bu_code,
  bu.name as bu_name,
  DATE_TRUNC('week', p.created_at)::date as created_week,
  DATE_TRUNC('month', p.created_at)::date as created_month,
  (
    SELECT COUNT(*) FROM bom_project_lines pl WHERE pl.project_id = p.id
  ) as line_count,
  (
    SELECT COALESCE(SUM(pl.footage), 0) FROM bom_project_lines pl WHERE pl.project_id = p.id
  ) as total_footage,
  (
    SELECT COALESCE(SUM(pl.material_cost), 0) FROM bom_project_lines pl WHERE pl.project_id = p.id
  ) as total_material_cost,
  (
    SELECT COALESCE(SUM(pl.labor_cost), 0) FROM bom_project_lines pl WHERE pl.project_id = p.id
  ) as total_labor_cost
FROM bom_projects p
LEFT JOIN business_units bu ON p.business_unit_id = bu.id
LEFT JOIN auth.users u ON p.created_by = u.id
WHERE p.is_archived = false;

GRANT SELECT ON v_project_analytics TO authenticated;

-- ============================================
-- 7. Project Status Summary View
-- ============================================
CREATE OR REPLACE VIEW v_project_status_summary AS
SELECT
  status,
  COUNT(*) as count,
  DATE_TRUNC('week', created_at)::date as week,
  DATE_TRUNC('month', created_at)::date as month
FROM bom_projects
WHERE is_archived = false
GROUP BY status, DATE_TRUNC('week', created_at)::date, DATE_TRUNC('month', created_at)::date
ORDER BY month DESC, week DESC, status;

GRANT SELECT ON v_project_status_summary TO authenticated;

-- ============================================
-- 8. Estimator Leaderboard View
-- ============================================
CREATE OR REPLACE VIEW v_estimator_leaderboard AS
SELECT
  p.created_by as user_id,
  COALESCE(u.raw_user_meta_data->>'name', 'Unknown') as user_name,
  COUNT(*) as total_projects,
  COUNT(*) FILTER (WHERE p.status = 'draft') as draft_count,
  COUNT(*) FILTER (WHERE p.status = 'ready') as ready_count,
  COUNT(*) FILTER (WHERE p.status IN ('sent_to_yard', 'staged', 'loaded', 'complete')) as completed_count,
  COUNT(*) FILTER (WHERE p.created_at >= DATE_TRUNC('week', CURRENT_DATE)) as projects_this_week,
  COUNT(*) FILTER (WHERE p.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as projects_this_month,
  ROUND(COALESCE(SUM(
    (SELECT SUM(pl.footage) FROM bom_project_lines pl WHERE pl.project_id = p.id)
  ), 0)::numeric, 0) as total_footage,
  ROUND(COALESCE(AVG(
    (SELECT SUM(pl.footage) FROM bom_project_lines pl WHERE pl.project_id = p.id)
  ), 0)::numeric, 0) as avg_footage_per_project
FROM bom_projects p
LEFT JOIN auth.users u ON p.created_by = u.id
WHERE p.is_archived = false
  AND p.created_by IS NOT NULL
GROUP BY p.created_by, u.raw_user_meta_data->>'name'
ORDER BY total_projects DESC;

GRANT SELECT ON v_estimator_leaderboard TO authenticated;

-- ============================================
-- 9. SKU Usage Analytics View
-- ============================================
CREATE OR REPLACE VIEW v_sku_usage_analytics AS
SELECT
  pl.sku_code,
  pl.sku_name,
  pl.fence_type,
  COUNT(DISTINCT pl.project_id) as project_count,
  ROUND(SUM(pl.footage)::numeric, 0) as total_footage,
  ROUND(SUM(pl.material_cost)::numeric, 2) as total_material_cost,
  ROUND(SUM(pl.labor_cost)::numeric, 2) as total_labor_cost,
  ROUND(AVG(pl.material_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_material_per_ft,
  ROUND(AVG(pl.labor_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_labor_per_ft,
  ROUND(AVG((pl.material_cost + pl.labor_cost) / NULLIF(pl.footage, 0))::numeric, 2) as avg_total_per_ft,
  MAX(p.created_at) as last_used
FROM bom_project_lines pl
JOIN bom_projects p ON pl.project_id = p.id
WHERE p.is_archived = false
GROUP BY pl.sku_code, pl.sku_name, pl.fence_type
ORDER BY total_footage DESC;

GRANT SELECT ON v_sku_usage_analytics TO authenticated;

-- ============================================
-- 10. Fence Type Performance View
-- ============================================
CREATE OR REPLACE VIEW v_fence_type_performance AS
SELECT
  pl.fence_type,
  COUNT(DISTINCT pl.project_id) as project_count,
  COUNT(*) as line_count,
  ROUND(SUM(pl.footage)::numeric, 0) as total_footage,
  ROUND(AVG(pl.footage)::numeric, 0) as avg_footage_per_line,
  ROUND(AVG(pl.material_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_material_per_ft,
  ROUND(AVG(pl.labor_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_labor_per_ft,
  ROUND(AVG((pl.material_cost + pl.labor_cost) / NULLIF(pl.footage, 0))::numeric, 2) as avg_total_per_ft
FROM bom_project_lines pl
JOIN bom_projects p ON pl.project_id = p.id
WHERE p.is_archived = false
GROUP BY pl.fence_type
ORDER BY total_footage DESC;

GRANT SELECT ON v_fence_type_performance TO authenticated;

-- ============================================
-- 11. Business Unit Comparison View
-- ============================================
CREATE OR REPLACE VIEW v_business_unit_comparison AS
SELECT
  bu.id as business_unit_id,
  bu.code as bu_code,
  bu.name as bu_name,
  -- Project counts
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'complete') as completed_projects,
  COUNT(DISTINCT p.id) FILTER (WHERE p.created_at >= DATE_TRUNC('month', CURRENT_DATE)) as projects_this_month,
  -- Footage
  ROUND(COALESCE(SUM(pl.footage), 0)::numeric, 0) as total_footage,
  ROUND(COALESCE(AVG(pl.footage), 0)::numeric, 0) as avg_footage_per_line,
  -- Costs
  ROUND(COALESCE(SUM(pl.material_cost), 0)::numeric, 2) as total_material_cost,
  ROUND(COALESCE(SUM(pl.labor_cost), 0)::numeric, 2) as total_labor_cost,
  ROUND(COALESCE(AVG(pl.material_cost / NULLIF(pl.footage, 0)), 0)::numeric, 2) as avg_material_per_ft,
  ROUND(COALESCE(AVG(pl.labor_cost / NULLIF(pl.footage, 0)), 0)::numeric, 2) as avg_labor_per_ft,
  ROUND(COALESCE(AVG((pl.material_cost + pl.labor_cost) / NULLIF(pl.footage, 0)), 0)::numeric, 2) as avg_total_per_ft,
  -- Labor rate stats
  (SELECT ROUND(AVG(lr.rate)::numeric, 2) FROM labor_rates lr WHERE lr.business_unit_id = bu.id) as avg_labor_rate,
  (SELECT COUNT(*) FROM labor_rates lr WHERE lr.business_unit_id = bu.id) as labor_rate_count
FROM business_units bu
LEFT JOIN bom_projects p ON p.business_unit_id = bu.id AND p.is_archived = false
LEFT JOIN bom_project_lines pl ON pl.project_id = p.id
GROUP BY bu.id, bu.code, bu.name
ORDER BY total_footage DESC;

GRANT SELECT ON v_business_unit_comparison TO authenticated;

-- ============================================
-- 12. Monthly Trends View
-- ============================================
CREATE OR REPLACE VIEW v_monthly_trends AS
SELECT
  DATE_TRUNC('month', p.created_at)::date as month,
  COUNT(DISTINCT p.id) as project_count,
  ROUND(SUM(pl.footage)::numeric, 0) as total_footage,
  ROUND(SUM(pl.material_cost)::numeric, 2) as total_material_cost,
  ROUND(SUM(pl.labor_cost)::numeric, 2) as total_labor_cost,
  ROUND(AVG(pl.material_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_material_per_ft,
  ROUND(AVG(pl.labor_cost / NULLIF(pl.footage, 0))::numeric, 2) as avg_labor_per_ft,
  ROUND(AVG((pl.material_cost + pl.labor_cost) / NULLIF(pl.footage, 0))::numeric, 2) as avg_total_per_ft
FROM bom_projects p
JOIN bom_project_lines pl ON pl.project_id = p.id
WHERE p.is_archived = false
  AND p.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.created_at)::date
ORDER BY month DESC;

GRANT SELECT ON v_monthly_trends TO authenticated;
