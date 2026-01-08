-- Migration 213: Add Lifecycle Date Fields to v_projects_full
-- Adds computed date columns for project lifecycle tracking

-- Must drop and recreate since we're adding columns (CREATE OR REPLACE can't change column list)
DROP VIEW IF EXISTS v_projects_full;

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

  -- Computed counts
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id) as cnt_quotes,
  (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id AND q.acceptance_status = 'pending') as cnt_pending_quotes,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id) as cnt_jobs,
  (SELECT COUNT(*) FROM jobs j WHERE j.project_id = p.id AND j.status NOT IN ('completed', 'cancelled')) as cnt_active_jobs,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id) as cnt_invoices,
  (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt')) as cnt_unpaid_invoices,

  -- =============================================
  -- NEW: Lifecycle Date Fields
  -- =============================================

  -- First quote sent date
  (SELECT MIN(q.sent_at)
   FROM quotes q
   WHERE q.project_id = p.id AND q.sent_at IS NOT NULL
  ) as first_quote_sent_at,

  -- Quote accepted date (from the accepted quote)
  (SELECT q.client_approved_at
   FROM quotes q
   WHERE q.project_id = p.id AND q.id = p.accepted_quote_id
   LIMIT 1
  ) as quote_accepted_at,

  -- First job created date
  (SELECT MIN(j.created_at)
   FROM jobs j
   WHERE j.project_id = p.id
  ) as first_job_created_at,

  -- Work started date (first job that started)
  (SELECT MIN(j.work_started_at)
   FROM jobs j
   WHERE j.project_id = p.id AND j.work_started_at IS NOT NULL
  ) as work_started_at,

  -- Work completed date (last job completion, only if ALL jobs are done)
  (SELECT MAX(j.work_completed_at)
   FROM jobs j
   WHERE j.project_id = p.id
     AND j.work_completed_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jobs j2
       WHERE j2.project_id = p.id
         AND j2.status NOT IN ('completed', 'cancelled')
     )
  ) as work_completed_at,

  -- First invoice sent date
  (SELECT MIN(i.sent_at)
   FROM invoices i
   WHERE i.project_id = p.id AND i.sent_at IS NOT NULL
  ) as first_invoice_sent_at,

  -- Last payment date (fully paid date)
  (SELECT MAX(pay.payment_date)
   FROM payments pay
   INNER JOIN invoices i ON pay.invoice_id = i.id
   WHERE i.project_id = p.id
  ) as last_payment_at,

  -- Days in current stage (for aging)
  CASE
    -- If quoting: days since first quote sent
    WHEN p.accepted_quote_id IS NULL
      AND EXISTS (SELECT 1 FROM quotes q WHERE q.project_id = p.id AND q.sent_at IS NOT NULL)
    THEN EXTRACT(DAY FROM NOW() - (SELECT MIN(q.sent_at) FROM quotes q WHERE q.project_id = p.id))::integer

    -- If invoiced: days since first invoice sent (unpaid)
    WHEN EXISTS (SELECT 1 FROM invoices i WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'bad_debt'))
    THEN EXTRACT(DAY FROM NOW() - (SELECT MIN(i.sent_at) FROM invoices i WHERE i.project_id = p.id AND i.sent_at IS NOT NULL))::integer

    ELSE NULL
  END as days_in_stage,

  -- =============================================
  -- Financial totals (computed)
  -- =============================================
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
LEFT JOIN projects parent ON p.parent_project_id = parent.id;

GRANT SELECT ON v_projects_full TO authenticated;

SELECT 'Migration 213 complete: Added lifecycle date fields to v_projects_full';
