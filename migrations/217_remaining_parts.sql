-- Migration 217 Remaining Parts (e, f, g, h)
-- Apply this via Supabase SQL Editor if exec_sql is unavailable

-- =============================================
-- PART 5: Ticket Hub <-> FSM Connection (217e)
-- =============================================

-- Connect tickets to FSM entities
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS job_issue_id UUID REFERENCES job_issues(id);

-- Ticket Hub Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_job ON tickets(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_job_issue ON tickets(job_issue_id)
  WHERE job_issue_id IS NOT NULL;

-- =============================================
-- PART 6: Invoice Flexibility (217f)
-- =============================================

-- Make job_id nullable (invoice can cover whole project, not single job)
ALTER TABLE invoices
  ALTER COLUMN job_id DROP NOT NULL;

-- Add job reference to line items for granular tracking
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);

-- =============================================
-- PART 7: Analytics Views (217g)
-- =============================================

-- Marketing Funnel View
CREATE OR REPLACE VIEW v_marketing_funnel AS
SELECT
  r.source,
  COUNT(*) as total_leads,
  COUNT(r.project_id) as converted_to_project,
  COUNT(CASE WHEN p.accepted_quote_id IS NOT NULL THEN 1 END) as won,
  ROUND(100.0 * COUNT(r.project_id) / NULLIF(COUNT(*), 0), 1) as lead_to_project_pct,
  ROUND(100.0 * COUNT(CASE WHEN p.accepted_quote_id IS NOT NULL THEN 1 END) /
        NULLIF(COUNT(r.project_id), 0), 1) as project_to_won_pct
FROM service_requests r
LEFT JOIN projects p ON r.project_id = p.id
WHERE r.request_type = 'new_quote'
GROUP BY r.source;

GRANT SELECT ON v_marketing_funnel TO authenticated;

-- Quote Timeliness View (Rep Accountability)
CREATE OR REPLACE VIEW v_quote_timeliness AS
SELECT
  u.id as rep_id,
  u.full_name as rep_name,
  COUNT(*) as total_assessments,
  AVG(EXTRACT(EPOCH FROM (q.sent_at - r.assessment_completed_at))/3600) as avg_hours_to_quote,
  SUM(CASE WHEN q.sent_at::date = r.assessment_completed_at::date THEN 1 ELSE 0 END)::float /
    NULLIF(COUNT(*), 0) * 100 as same_day_pct,
  SUM(CASE WHEN EXTRACT(EPOCH FROM (q.sent_at - r.assessment_completed_at))/3600 > 48 THEN 1 ELSE 0 END)::float /
    NULLIF(COUNT(*), 0) * 100 as over_48hrs_pct
FROM service_requests r
JOIN projects p ON r.project_id = p.id
JOIN quotes q ON q.project_id = p.id AND q.quote_type = 'original'
JOIN user_profiles u ON r.assessment_rep_user_id = u.id
WHERE r.assessment_completed_at IS NOT NULL
  AND q.sent_at IS NOT NULL
GROUP BY u.id, u.full_name;

GRANT SELECT ON v_quote_timeliness TO authenticated;

-- Change Order Analytics by Rep (KEY ACCOUNTABILITY METRIC)
CREATE OR REPLACE VIEW v_change_orders_by_rep AS
SELECT
  u.id as rep_id,
  u.full_name as rep_name,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(CASE WHEN q.quote_type = 'original' THEN 1 END) as original_quotes,
  COUNT(CASE WHEN q.quote_type = 'change_order' THEN 1 END) as change_orders,
  SUM(CASE WHEN q.quote_type = 'original' AND q.acceptance_status = 'accepted'
      THEN q.total ELSE 0 END) as original_value,
  SUM(CASE WHEN q.quote_type = 'change_order' AND q.acceptance_status = 'accepted'
      THEN q.total ELSE 0 END) as change_order_value,
  ROUND(100.0 * COUNT(CASE WHEN q.quote_type = 'change_order' THEN 1 END) /
        NULLIF(COUNT(DISTINCT p.id), 0), 1) as change_order_rate_pct,
  ROUND(100.0 * SUM(CASE WHEN q.quote_type = 'change_order' THEN q.total ELSE 0 END) /
        NULLIF(SUM(CASE WHEN q.quote_type = 'original' THEN q.total ELSE 0 END), 0), 1)
        as change_order_value_pct
FROM quotes q
JOIN projects p ON q.project_id = p.id
JOIN user_profiles u ON q.sales_rep_user_id = u.id
WHERE q.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.id, u.full_name
ORDER BY change_order_rate_pct DESC;

GRANT SELECT ON v_change_orders_by_rep TO authenticated;

-- Warranty Analytics by Crew
CREATE OR REPLACE VIEW v_warranty_by_crew AS
SELECT
  c.id as crew_id,
  c.name as crew_name,
  COUNT(DISTINCT pj.id) as total_jobs_completed,
  COUNT(DISTINCT pw.id) as warranty_callbacks,
  ROUND(100.0 * COUNT(DISTINCT pw.id) / NULLIF(COUNT(DISTINCT pj.id), 0), 2) as warranty_pct,
  SUM(COALESCE(jw.actual_total_cost, 0)) as warranty_cost
FROM jobs j
JOIN crews c ON j.crew_id = c.id
JOIN projects pj ON j.project_id = pj.id
LEFT JOIN projects pw ON pw.parent_project_id = pj.id AND pw.project_type = 'warranty'
LEFT JOIN jobs jw ON jw.project_id = pw.id
WHERE j.status = 'completed'
GROUP BY c.id, c.name;

GRANT SELECT ON v_warranty_by_crew TO authenticated;

-- Rework Tracking by Crew
CREATE OR REPLACE VIEW v_rework_by_crew AS
SELECT
  c.id as crew_id,
  c.name as crew_name,
  COUNT(*) as rework_issues,
  SUM(COALESCE(ji.actual_cost, ji.estimated_cost, 0)) as total_rework_cost
FROM job_issues ji
JOIN jobs j ON ji.job_id = j.id
JOIN crews c ON j.crew_id = c.id
WHERE ji.issue_type IN ('rework_crew', 'rework_material')
GROUP BY c.id, c.name;

GRANT SELECT ON v_rework_by_crew TO authenticated;

-- Penalization Summary View
CREATE OR REPLACE VIEW v_penalization_summary AS
SELECT
  ji.penalization_type,
  CASE WHEN ji.penalization_type = 'backcharge_crew' THEN c.id END as crew_id,
  CASE WHEN ji.penalization_type = 'backcharge_crew' THEN c.name END as crew_name,
  CASE WHEN ji.penalization_type = 'commission_reduction' THEN u.id END as rep_id,
  CASE WHEN ji.penalization_type = 'commission_reduction' THEN u.full_name END as rep_name,
  COUNT(*) as issue_count,
  SUM(COALESCE(ji.penalization_amount, 0)) as total_amount,
  AVG(COALESCE(ji.penalization_percent, 0)) as avg_percent_reduction,
  DATE_TRUNC('month', ji.penalization_approved_at) as month
FROM job_issues ji
LEFT JOIN crews c ON ji.responsible_crew_id = c.id
LEFT JOIN user_profiles u ON ji.responsible_user_id = u.id
WHERE ji.penalization_type IS NOT NULL
  AND ji.penalization_approved_at IS NOT NULL
GROUP BY
  ji.penalization_type,
  CASE WHEN ji.penalization_type = 'backcharge_crew' THEN c.id END,
  CASE WHEN ji.penalization_type = 'backcharge_crew' THEN c.name END,
  CASE WHEN ji.penalization_type = 'commission_reduction' THEN u.id END,
  CASE WHEN ji.penalization_type = 'commission_reduction' THEN u.full_name END,
  DATE_TRUNC('month', ji.penalization_approved_at);

GRANT SELECT ON v_penalization_summary TO authenticated;

-- =============================================
-- PART 8: Warranty Helper Function (217h)
-- =============================================

CREATE OR REPLACE FUNCTION create_warranty_project(
  p_parent_project_id UUID,
  p_warranty_type TEXT DEFAULT 'workmanship',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_parent projects%ROWTYPE;
  v_new_project_id UUID;
  v_project_number TEXT;
BEGIN
  SELECT * INTO v_parent FROM projects WHERE id = p_parent_project_id;

  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Parent project not found';
  END IF;

  SELECT 'W-' || LPAD(COALESCE(
    (SELECT MAX(SUBSTRING(project_number FROM 3)::integer) + 1
     FROM projects WHERE project_number LIKE 'W-%'), 1)::text, 5, '0')
  INTO v_project_number;

  INSERT INTO projects (
    project_number,
    name,
    client_id,
    property_id,
    community_id,
    qbo_class_id,
    assigned_rep_user_id,
    project_type,
    parent_project_id,
    warranty_type,
    description,
    status
  ) VALUES (
    v_project_number,
    'Warranty: ' || v_parent.name,
    v_parent.client_id,
    v_parent.property_id,
    v_parent.community_id,
    v_parent.qbo_class_id,
    v_parent.assigned_rep_user_id,
    'warranty',
    p_parent_project_id,
    p_warranty_type,
    p_description,
    'active'
  )
  RETURNING id INTO v_new_project_id;

  RETURN v_new_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_warranty_project(UUID, TEXT, TEXT) TO authenticated;

SELECT 'Migration 217 remaining parts complete';
