-- Migration 218: Update v_projects_full to include source request info
-- Adds request_number and request info for "From Request" badge display

-- Need to drop and recreate because p.* now includes request_id column
DROP VIEW IF EXISTS v_projects_full CASCADE;

CREATE VIEW v_projects_full AS
SELECT
  p.*,

  -- Client info
  c.name as client_name,
  c.company_name as client_company,
  c.primary_contact_phone as client_phone,
  COALESCE(c.company_name, c.name) as client_display_name,

  -- Property info
  prop.address_line1 as property_address,
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

  -- Source request info (NEW - for "From Request" badge)
  source_req.request_number as request_number,
  source_req.request_type as request_type,
  source_req.source as request_source,

  -- Computed counts
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id) as cnt_quotes,
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id AND q.acceptance_status = 'pending') as cnt_pending_quotes,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id) as cnt_jobs,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.status NOT IN ('completed', 'cancelled')) as cnt_active_jobs,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id) as cnt_invoices,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt')) as cnt_unpaid_invoices,

  -- Financial totals (computed)
  (SELECT COALESCE(SUM(q.total), 0)
   FROM quotes q
   WHERE q.project_id = p.id AND q.acceptance_status = 'accepted'
  ) as sum_accepted_quotes,

  (SELECT COALESCE(SUM(j.quoted_total), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as sum_job_value,

  (SELECT COALESCE(SUM(i.total), 0)
   FROM invoices i
   WHERE i.project_id = p.id
  ) as sum_invoiced,

  (SELECT COALESCE(SUM(i.amount_paid), 0)
   FROM invoices i
   WHERE i.project_id = p.id
  ) as sum_paid,

  (SELECT COALESCE(SUM(i.total - COALESCE(i.amount_paid, 0)), 0)
   FROM invoices i
   WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt')
  ) as sum_balance_due,

  -- Budget vs Actual (computed from jobs)
  (SELECT COALESCE(SUM(j.budgeted_total_cost), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as sum_budgeted_cost,

  (SELECT COALESCE(SUM(j.actual_total_cost), 0)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as sum_actual_cost,

  -- Rework flag (computed)
  EXISTS (
    SELECT 1 FROM jobs j WHERE j.project_id = p.id AND j.has_rework = true
  ) as has_rework_jobs,

  -- Related projects (warranty, change orders)
  (SELECT COUNT(*) FROM projects child WHERE child.parent_project_id = p.id) as cnt_child_projects

FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN properties prop ON p.property_id = prop.id
LEFT JOIN communities comm ON p.community_id = comm.id
LEFT JOIN qbo_classes qbo ON p.qbo_class_id = qbo.id
LEFT JOIN user_profiles rep ON p.assigned_rep_user_id = rep.id
LEFT JOIN projects parent ON p.parent_project_id = parent.id
LEFT JOIN service_requests source_req ON p.request_id = source_req.id;

GRANT SELECT ON v_projects_full TO authenticated;

SELECT 'Migration 218 complete: v_projects_full now includes source request info';
