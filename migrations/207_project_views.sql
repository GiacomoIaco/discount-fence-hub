-- Migration 207: Project Views
-- Creates comprehensive views for project data with aggregates

-- ============================================
-- 1. Full Project View with all relations
-- ============================================

CREATE OR REPLACE VIEW v_projects_full AS
SELECT
  p.*,

  -- Client info
  c.name as client_name,
  c.company_name as client_company,
  c.email as client_email,
  c.phone as client_phone,
  COALESCE(c.company_name, c.name) as client_display_name,

  -- Property info
  prop.address_line1 as property_address,
  prop.address_line2 as property_address2,
  prop.city as property_city,
  prop.state as property_state,
  prop.zip as property_zip,
  prop.latitude as property_lat,
  prop.longitude as property_lng,

  -- Community info
  comm.name as community_name,
  comm.code as community_code,

  -- QBO Class info
  qbo.name as qbo_class_name,
  qbo.labor_code as qbo_labor_code,
  qbo.bu_type as qbo_bu_type,
  qbo.location_code as qbo_location_code,

  -- Assigned rep info
  rep.full_name as rep_name,
  rep.email as rep_email,
  rep.phone as rep_phone,

  -- Parent project (for warranty/follow-up)
  parent.name as parent_project_name,
  parent.project_number as parent_project_number,

  -- Counts
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id) as quote_count,
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id AND q.acceptance_status = 'pending') as pending_quote_count,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id) as job_count,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.status NOT IN ('completed', 'cancelled')) as active_job_count,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id) as invoice_count,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt')) as unpaid_invoice_count,

  -- Financial totals
  (SELECT COALESCE(SUM(q.total), 0)
   FROM quotes q
   WHERE q.project_id = p.id AND q.acceptance_status = 'accepted'
  ) as accepted_quote_total,

  (SELECT COALESCE(SUM(j.quoted_total), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as total_job_value,

  (SELECT COALESCE(SUM(i.total_amount), 0)
   FROM invoices i
   WHERE i.project_id = p.id
  ) as total_invoiced,

  (SELECT COALESCE(SUM(i.amount_paid), 0)
   FROM invoices i
   WHERE i.project_id = p.id
  ) as total_paid,

  (SELECT COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)), 0)
   FROM invoices i
   WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt')
  ) as total_balance_due,

  -- Budget vs Actual (from jobs)
  (SELECT COALESCE(SUM(j.budgeted_total_cost), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as total_budgeted_cost,

  (SELECT COALESCE(SUM(j.actual_total_cost), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as total_actual_cost,

  -- Has rework
  EXISTS (
    SELECT 1 FROM jobs j WHERE j.project_id = p.id AND j.has_rework = true
  ) as has_rework,

  -- Related projects count (warranty, change orders)
  (SELECT COUNT(*) FROM projects child WHERE child.parent_project_id = p.id) as child_project_count

FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN properties prop ON p.property_id = prop.id
LEFT JOIN communities comm ON p.community_id = comm.id
LEFT JOIN qbo_classes qbo ON p.qbo_class_id = qbo.id
LEFT JOIN user_profiles rep ON p.assigned_rep_user_id = rep.id
LEFT JOIN projects parent ON p.parent_project_id = parent.id;

GRANT SELECT ON v_projects_full TO authenticated;

-- ============================================
-- 2. Project Quotes View
-- ============================================

CREATE OR REPLACE VIEW v_project_quotes AS
SELECT
  q.*,
  p.name as project_name,
  p.project_number,
  c.name as client_name,
  c.company_name as client_company,
  COALESCE(c.company_name, c.name) as client_display_name,
  rep.full_name as sales_rep_name,
  (SELECT COUNT(*) FROM quote_line_items qli WHERE qli.quote_id = q.id) as line_item_count,
  superseded.quote_number as superseded_by_quote_number
FROM quotes q
LEFT JOIN projects p ON q.project_id = p.id
LEFT JOIN clients c ON q.client_id = c.id
LEFT JOIN user_profiles rep ON q.sales_rep_user_id = rep.id
LEFT JOIN quotes superseded ON q.superseded_by_quote_id = superseded.id;

GRANT SELECT ON v_project_quotes TO authenticated;

-- ============================================
-- 3. Project Jobs View
-- ============================================

CREATE OR REPLACE VIEW v_project_jobs AS
SELECT
  j.*,
  p.name as project_name,
  p.project_number,
  c.name as client_name,
  c.company_name as client_company,
  COALESCE(c.company_name, c.name) as client_display_name,
  crew.name as crew_name,
  crew.code as crew_code,
  depends_on.job_number as depends_on_job_number,
  depends_on.name as depends_on_job_name,
  -- Visit counts
  (SELECT COUNT(*) FROM job_visits jv WHERE jv.job_id = j.id) as visit_count,
  (SELECT COUNT(*) FROM job_visits jv WHERE jv.job_id = j.id AND jv.status = 'completed') as completed_visit_count,
  (SELECT COUNT(*) FROM job_visits jv WHERE jv.job_id = j.id AND jv.visit_type IN ('rework', 'callback', 'warranty')) as rework_visit_count,
  -- Variance calculations
  CASE
    WHEN j.budgeted_total_cost > 0
    THEN ROUND(((j.actual_total_cost - j.budgeted_total_cost) / j.budgeted_total_cost * 100)::numeric, 1)
    ELSE 0
  END as cost_variance_pct
FROM jobs j
LEFT JOIN projects p ON j.project_id = p.id
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN crews crew ON j.assigned_crew_id = crew.id
LEFT JOIN jobs depends_on ON j.depends_on_job_id = depends_on.id;

GRANT SELECT ON v_project_jobs TO authenticated;

-- ============================================
-- 4. Project Invoices View
-- ============================================

CREATE OR REPLACE VIEW v_project_invoices AS
SELECT
  i.*,
  p.name as project_name,
  p.project_number,
  c.name as client_name,
  c.company_name as client_company,
  COALESCE(c.company_name, c.name) as client_display_name,
  j.job_number,
  j.name as job_name,
  -- Balance calculation
  (i.total_amount - COALESCE(i.amount_paid, 0)) as balance_due,
  -- Payment count
  (SELECT COUNT(*) FROM payments pay WHERE pay.invoice_id = i.id) as payment_count,
  -- Days past due
  CASE
    WHEN i.status = 'sent' AND i.due_date < CURRENT_DATE
    THEN CURRENT_DATE - i.due_date
    ELSE 0
  END as days_past_due
FROM invoices i
LEFT JOIN projects p ON i.project_id = p.id
LEFT JOIN clients c ON i.client_id = c.id
LEFT JOIN jobs j ON i.job_id = j.id;

GRANT SELECT ON v_project_invoices TO authenticated;

-- ============================================
-- 5. Project Timeline View (Activity)
-- ============================================

CREATE OR REPLACE VIEW v_project_timeline AS
WITH timeline_events AS (
  -- Project created
  SELECT
    project_id,
    'project_created' as event_type,
    'Project created' as event_description,
    NULL as entity_id,
    NULL as entity_number,
    created_at as event_time
  FROM projects
  WHERE project_id IS NOT NULL

  UNION ALL

  -- Quotes
  SELECT
    project_id,
    CASE
      WHEN acceptance_status = 'accepted' THEN 'quote_accepted'
      WHEN acceptance_status = 'declined' THEN 'quote_declined'
      WHEN status = 'sent' THEN 'quote_sent'
      ELSE 'quote_created'
    END as event_type,
    CASE
      WHEN acceptance_status = 'accepted' THEN 'Quote accepted'
      WHEN acceptance_status = 'declined' THEN 'Quote declined'
      WHEN status = 'sent' THEN 'Quote sent to client'
      ELSE 'Quote created'
    END as event_description,
    id as entity_id,
    quote_number as entity_number,
    COALESCE(accepted_at, declined_at, sent_at, created_at) as event_time
  FROM quotes
  WHERE project_id IS NOT NULL

  UNION ALL

  -- Jobs
  SELECT
    project_id,
    CASE
      WHEN status = 'completed' THEN 'job_completed'
      WHEN status = 'in_progress' THEN 'job_started'
      WHEN status = 'scheduled' THEN 'job_scheduled'
      ELSE 'job_created'
    END as event_type,
    CASE
      WHEN status = 'completed' THEN 'Job completed'
      WHEN status = 'in_progress' THEN 'Work started'
      WHEN status = 'scheduled' THEN 'Job scheduled'
      ELSE 'Job created'
    END as event_description,
    id as entity_id,
    job_number as entity_number,
    COALESCE(work_completed_at, work_started_at, scheduled_date::timestamptz, created_at) as event_time
  FROM jobs
  WHERE project_id IS NOT NULL

  UNION ALL

  -- Invoices
  SELECT
    project_id,
    CASE
      WHEN status = 'paid' THEN 'invoice_paid'
      WHEN status = 'sent' THEN 'invoice_sent'
      ELSE 'invoice_created'
    END as event_type,
    CASE
      WHEN status = 'paid' THEN 'Invoice paid in full'
      WHEN status = 'sent' THEN 'Invoice sent'
      ELSE 'Invoice created'
    END as event_description,
    id as entity_id,
    invoice_number as entity_number,
    COALESCE(paid_at, sent_at, created_at) as event_time
  FROM invoices
  WHERE project_id IS NOT NULL
)
SELECT * FROM timeline_events
ORDER BY event_time DESC;

GRANT SELECT ON v_project_timeline TO authenticated;

-- ============================================
-- 6. Helper function: Get project entities
-- ============================================

CREATE OR REPLACE FUNCTION get_project_entities(p_project_id UUID)
RETURNS TABLE (
  quotes JSONB,
  jobs JSONB,
  invoices JSONB,
  visits JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(jsonb_agg(q.*), '[]'::jsonb)
     FROM v_project_quotes q
     WHERE q.project_id = p_project_id
    ) as quotes,

    (SELECT COALESCE(jsonb_agg(j.*), '[]'::jsonb)
     FROM v_project_jobs j
     WHERE j.project_id = p_project_id
    ) as jobs,

    (SELECT COALESCE(jsonb_agg(i.*), '[]'::jsonb)
     FROM v_project_invoices i
     WHERE i.project_id = p_project_id
    ) as invoices,

    (SELECT COALESCE(jsonb_agg(jv.*), '[]'::jsonb)
     FROM job_visits jv
     INNER JOIN jobs j ON jv.job_id = j.id
     WHERE j.project_id = p_project_id
    ) as visits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Migration 207 complete: Project views created';
