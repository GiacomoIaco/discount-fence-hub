-- Migration 144: FSM Core Tables
-- Creates the foundation for Field Service Management capabilities
-- Pipeline: Request -> Quote -> Job -> Invoice

-- ============================================
-- 1. TERRITORIES
-- ============================================
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,

  -- Geographic bounds
  zip_codes TEXT[] DEFAULT '{}',

  -- Assignment
  business_unit_id UUID REFERENCES business_units(id),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_territories_bu ON territories(business_unit_id);
CREATE INDEX idx_territories_active ON territories(is_active);

-- ============================================
-- 2. SALES REPS
-- ============================================
CREATE TABLE IF NOT EXISTS sales_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),

  -- Profile
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Assignment criteria
  territory_ids UUID[] DEFAULT '{}',
  product_skills TEXT[] DEFAULT '{}',  -- e.g., ['Wood Vertical', 'Iron', 'Chain Link']

  -- Capacity
  max_daily_assessments INT DEFAULT 4,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_reps_user ON sales_reps(user_id);
CREATE INDEX idx_sales_reps_active ON sales_reps(is_active);
CREATE INDEX idx_sales_reps_territories ON sales_reps USING GIN(territory_ids);
CREATE INDEX idx_sales_reps_skills ON sales_reps USING GIN(product_skills);

-- ============================================
-- 3. CREWS
-- ============================================
CREATE TABLE IF NOT EXISTS crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,

  -- Capacity
  crew_size INT DEFAULT 2,
  max_daily_lf INT DEFAULT 200,  -- Linear feet capacity per day

  -- Skills
  product_skills TEXT[] DEFAULT '{}',  -- e.g., ['Wood Vertical', 'Iron']

  -- Assignment
  business_unit_id UUID REFERENCES business_units(id),
  home_territory_id UUID REFERENCES territories(id),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crews_bu ON crews(business_unit_id);
CREATE INDEX idx_crews_territory ON crews(home_territory_id);
CREATE INDEX idx_crews_active ON crews(is_active);
CREATE INDEX idx_crews_skills ON crews USING GIN(product_skills);

-- ============================================
-- 4. CREW MEMBERS (link to users)
-- ============================================
CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),

  is_lead BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX idx_crew_members_user ON crew_members(user_id);

-- ============================================
-- 5. SERVICE REQUESTS
-- ============================================

-- Sequence for request numbers
CREATE SEQUENCE IF NOT EXISTS request_number_seq START 1;

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) UNIQUE NOT NULL,

  -- Customer
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Contact info (for new/non-client requests)
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),

  -- Address (if not linked to property)
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Request details
  source VARCHAR(50) DEFAULT 'phone',  -- phone, web, referral, walk_in, builder_portal
  product_type VARCHAR(100),
  linear_feet_estimate DECIMAL(10,2),
  description TEXT,
  notes TEXT,

  -- Assessment
  requires_assessment BOOLEAN DEFAULT true,
  assessment_scheduled_at TIMESTAMPTZ,
  assessment_completed_at TIMESTAMPTZ,
  assessment_rep_id UUID REFERENCES sales_reps(id),
  assessment_notes TEXT,

  -- Status (action-driven like Jobber)
  status VARCHAR(50) DEFAULT 'pending',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Assignment
  assigned_rep_id UUID REFERENCES sales_reps(id),
  territory_id UUID REFERENCES territories(id),

  -- Priority
  priority VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, urgent

  -- Conversion tracking
  converted_to_quote_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Auto-generate request number
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    NEW.request_number := 'REQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('request_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_request_number ON service_requests;
CREATE TRIGGER trigger_generate_request_number
  BEFORE INSERT ON service_requests
  FOR EACH ROW EXECUTE FUNCTION generate_request_number();

CREATE INDEX idx_requests_status ON service_requests(status);
CREATE INDEX idx_requests_client ON service_requests(client_id);
CREATE INDEX idx_requests_community ON service_requests(community_id);
CREATE INDEX idx_requests_property ON service_requests(property_id);
CREATE INDEX idx_requests_assessment_date ON service_requests(assessment_scheduled_at);
CREATE INDEX idx_requests_assigned_rep ON service_requests(assigned_rep_id);
CREATE INDEX idx_requests_territory ON service_requests(territory_id);
CREATE INDEX idx_requests_created ON service_requests(created_at DESC);

-- ============================================
-- 6. QUOTES
-- ============================================

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,

  -- Source
  request_id UUID REFERENCES service_requests(id),
  bom_project_id UUID REFERENCES bom_projects(id),

  -- Customer
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Snapshot addresses (frozen at quote time)
  billing_address JSONB,
  job_address JSONB,

  -- Pricing
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0.0825,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Cost tracking (for margin)
  total_material_cost DECIMAL(12,2) DEFAULT 0,
  total_labor_cost DECIMAL(12,2) DEFAULT 0,
  margin_percent DECIMAL(5,2),

  -- Terms
  valid_until DATE,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  deposit_required DECIMAL(12,2) DEFAULT 0,
  deposit_percent DECIMAL(5,2) DEFAULT 0,

  -- Scope summary
  product_type VARCHAR(100),
  linear_feet DECIMAL(10,2),
  scope_summary TEXT,

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(50),  -- pending, approved, rejected
  approval_reason TEXT,  -- Why approval needed
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Status (Jobber-style)
  status VARCHAR(50) DEFAULT 'draft',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Communication
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(50),  -- email, client_hub, print
  sent_to_email VARCHAR(255),
  viewed_at TIMESTAMPTZ,

  -- Client response
  client_approved_at TIMESTAMPTZ,
  client_signature TEXT,
  client_po_number VARCHAR(100),
  lost_reason TEXT,
  lost_to_competitor VARCHAR(255),

  -- Conversion
  converted_to_job_id UUID,

  -- Assignment
  sales_rep_id UUID REFERENCES sales_reps(id),
  created_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := 'QUO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('quote_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_quote_number ON quotes;
CREATE TRIGGER trigger_generate_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_community ON quotes(community_id);
CREATE INDEX idx_quotes_request ON quotes(request_id);
CREATE INDEX idx_quotes_bom_project ON quotes(bom_project_id);
CREATE INDEX idx_quotes_sales_rep ON quotes(sales_rep_id);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);
CREATE INDEX idx_quotes_approval ON quotes(requires_approval, approval_status);

-- ============================================
-- 7. QUOTE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS quote_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Item details
  line_type VARCHAR(50) NOT NULL,  -- material, labor, service, adjustment, discount
  description TEXT NOT NULL,

  -- Quantity
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_type VARCHAR(50),  -- LF, SF, EA, etc.

  -- Pricing
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2),
  total_price DECIMAL(12,2) NOT NULL,

  -- Source reference
  material_id UUID REFERENCES materials(id),
  labor_code_id UUID REFERENCES labor_codes(id),
  sku_id UUID REFERENCES sku_catalog(id),
  bom_line_item_id UUID REFERENCES bom_line_items(id),

  -- Display
  sort_order INT DEFAULT 0,
  is_visible_to_client BOOLEAN DEFAULT true,
  group_name VARCHAR(100),  -- For grouping related items

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quote_lines_quote ON quote_line_items(quote_id);
CREATE INDEX idx_quote_lines_type ON quote_line_items(line_type);

-- ============================================
-- 8. JOBS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1;

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(50) UNIQUE NOT NULL,

  -- Source
  quote_id UUID REFERENCES quotes(id),

  -- Customer
  client_id UUID NOT NULL REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),
  job_address JSONB NOT NULL,

  -- Scope
  product_type VARCHAR(100),
  linear_feet DECIMAL(10,2),
  description TEXT,
  special_instructions TEXT,

  -- Pricing
  quoted_total DECIMAL(12,2),

  -- Schedule
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_duration_hours DECIMAL(4,1),

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),
  assigned_rep_id UUID REFERENCES sales_reps(id),
  territory_id UUID REFERENCES territories(id),

  -- Status (with yard workflow stages)
  status VARCHAR(50) DEFAULT 'won',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Yard workflow timestamps
  ready_for_yard_at TIMESTAMPTZ,
  picking_started_at TIMESTAMPTZ,
  picking_completed_at TIMESTAMPTZ,
  staging_completed_at TIMESTAMPTZ,

  -- Field workflow timestamps
  loaded_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,

  -- Completion
  completion_photos TEXT[],
  completion_signature TEXT,
  completion_notes TEXT,
  completed_by UUID REFERENCES auth.users(id),

  -- Invoice reference
  invoice_id UUID,

  -- BOM/BOL reference
  bom_project_id UUID REFERENCES bom_projects(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Auto-generate job number
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL THEN
    NEW.job_number := 'JOB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('job_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_job_number ON jobs;
CREATE TRIGGER trigger_generate_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION generate_job_number();

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_community ON jobs(community_id);
CREATE INDEX idx_jobs_property ON jobs(property_id);
CREATE INDEX idx_jobs_quote ON jobs(quote_id);
CREATE INDEX idx_jobs_crew ON jobs(assigned_crew_id);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_date);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- ============================================
-- 9. JOB VISITS (for multi-day jobs)
-- ============================================
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  visit_number INT NOT NULL DEFAULT 1,
  visit_type VARCHAR(50) DEFAULT 'installation',  -- installation, followup, warranty, inspection

  -- Schedule
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,

  -- Assignment
  assigned_crew_id UUID REFERENCES crews(id),

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled',  -- scheduled, in_progress, completed, cancelled

  -- Completion
  completed_at TIMESTAMPTZ,
  notes TEXT,
  photos TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_visits_job ON job_visits(job_id);
CREATE INDEX idx_job_visits_date ON job_visits(scheduled_date);
CREATE INDEX idx_job_visits_crew ON job_visits(assigned_crew_id);
CREATE INDEX idx_job_visits_status ON job_visits(status);

-- ============================================
-- 10. INVOICES
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,

  -- Source
  job_id UUID REFERENCES jobs(id),
  quote_id UUID REFERENCES quotes(id),

  -- Customer
  client_id UUID NOT NULL REFERENCES clients(id),
  billing_address JSONB NOT NULL,

  -- Amounts
  subtotal DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0.0825,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,

  -- Payments
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) NOT NULL,

  -- Terms
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',

  -- PO reference
  po_number VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'draft',  -- draft, sent, past_due, paid, bad_debt
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Communication
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(50),
  sent_to_email VARCHAR(255),

  -- QBO Integration
  qbo_invoice_id VARCHAR(50),
  qbo_sync_status VARCHAR(50),  -- pending, synced, error
  qbo_synced_at TIMESTAMPTZ,
  qbo_sync_error TEXT,
  qbo_class_id VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_due ON invoices(due_date);
CREATE INDEX idx_invoices_qbo ON invoices(qbo_invoice_id);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);

-- ============================================
-- 11. INVOICE LINE ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,

  -- Source
  quote_line_item_id UUID REFERENCES quote_line_items(id),

  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_line_items(invoice_id);

-- ============================================
-- 12. PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),

  -- Amount
  amount DECIMAL(12,2) NOT NULL,

  -- Method
  payment_method VARCHAR(50) NOT NULL,  -- card, check, cash, ach, qbo_payment

  -- Details
  reference_number VARCHAR(100),  -- Check number, transaction ID
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,

  -- QBO
  qbo_payment_id VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- ============================================
-- 13. STATUS HISTORY (for audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS fsm_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type VARCHAR(50) NOT NULL,  -- request, quote, job, invoice
  entity_id UUID NOT NULL,

  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,

  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT
);

CREATE INDEX idx_fsm_status_history_entity ON fsm_status_history(entity_type, entity_id);
CREATE INDEX idx_fsm_status_history_changed ON fsm_status_history(changed_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_status_history ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read all)
CREATE POLICY "territories_read" ON territories FOR SELECT USING (true);
CREATE POLICY "sales_reps_read" ON sales_reps FOR SELECT USING (true);
CREATE POLICY "crews_read" ON crews FOR SELECT USING (true);
CREATE POLICY "crew_members_read" ON crew_members FOR SELECT USING (true);
CREATE POLICY "service_requests_read" ON service_requests FOR SELECT USING (true);
CREATE POLICY "quotes_read" ON quotes FOR SELECT USING (true);
CREATE POLICY "quote_line_items_read" ON quote_line_items FOR SELECT USING (true);
CREATE POLICY "jobs_read" ON jobs FOR SELECT USING (true);
CREATE POLICY "job_visits_read" ON job_visits FOR SELECT USING (true);
CREATE POLICY "invoices_read" ON invoices FOR SELECT USING (true);
CREATE POLICY "invoice_line_items_read" ON invoice_line_items FOR SELECT USING (true);
CREATE POLICY "payments_read" ON payments FOR SELECT USING (true);
CREATE POLICY "fsm_status_history_read" ON fsm_status_history FOR SELECT USING (true);

-- Write policies (authenticated users can write)
CREATE POLICY "territories_write" ON territories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "sales_reps_write" ON sales_reps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "crews_write" ON crews FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "crew_members_write" ON crew_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_requests_write" ON service_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "quotes_write" ON quotes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "quote_line_items_write" ON quote_line_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "jobs_write" ON jobs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "job_visits_write" ON job_visits FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "invoices_write" ON invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "invoice_line_items_write" ON invoice_line_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "payments_write" ON payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "fsm_status_history_write" ON fsm_status_history FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE territories IS 'Geographic territories for assignment routing';
COMMENT ON TABLE sales_reps IS 'Sales representatives with territory and skill assignments';
COMMENT ON TABLE crews IS 'Installation crews with capacity and skill tracking';
COMMENT ON TABLE service_requests IS 'Incoming service requests (leads) with assessment tracking';
COMMENT ON TABLE quotes IS 'Formal price quotes generated from BOM calculations';
COMMENT ON TABLE jobs IS 'Scheduled work with yard workflow integration';
COMMENT ON TABLE invoices IS 'Invoices with QBO sync support';
COMMENT ON TABLE fsm_status_history IS 'Audit trail of all status changes';
