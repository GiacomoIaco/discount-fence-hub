-- Migration 164: FSM Projects
-- Adds Project as a grouping container for Request/Quote/Job/Invoice
-- Projects are created when: converting Request→Quote, Request→Job (direct), or creating Quote from scratch

-- ============================================
-- 1. PROJECTS TABLE
-- ============================================

-- Sequence for project numbers
CREATE SEQUENCE IF NOT EXISTS project_number_seq START 1;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number VARCHAR(50) UNIQUE NOT NULL,

  -- Customer linkage
  client_id UUID REFERENCES clients(id),
  community_id UUID REFERENCES communities(id),
  property_id UUID REFERENCES properties(id),

  -- Project info (can be inherited from first request/quote)
  name VARCHAR(255),  -- Optional friendly name
  description TEXT,
  product_type VARCHAR(100),

  -- Address (copied from first entity if property not linked)
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2) DEFAULT 'TX',
  zip VARCHAR(20),

  -- Assignment
  territory_id UUID REFERENCES territories(id),
  assigned_rep_id UUID REFERENCES sales_reps(id),

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- active, complete, on_hold, cancelled, warranty

  -- Financials (denormalized for quick access)
  total_quoted DECIMAL(12,2) DEFAULT 0,
  total_invoiced DECIMAL(12,2) DEFAULT 0,
  total_paid DECIMAL(12,2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_community ON projects(community_id);
CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_territory ON projects(territory_id);
CREATE INDEX IF NOT EXISTS idx_projects_rep ON projects(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);

-- Generate project number on insert
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_number IS NULL THEN
    NEW.project_number := 'P-' || LPAD(nextval('project_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_number ON projects;
CREATE TRIGGER trg_project_number
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_project_number();

-- ============================================
-- 2. ADD PROJECT_ID TO FSM TABLES
-- ============================================

-- Service Requests
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS converted_to_job_id UUID;  -- For direct Request→Job conversion

CREATE INDEX IF NOT EXISTS idx_requests_project ON service_requests(project_id);

-- Quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_quotes_project ON quotes(project_id);

-- Jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES service_requests(id),  -- Direct from request (no quote)
  ADD COLUMN IF NOT EXISTS is_warranty BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_request ON jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_jobs_warranty ON jobs(is_warranty) WHERE is_warranty = true;

-- Invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);

-- ============================================
-- 3. REQUEST TYPE FOR CHANGE ORDERS/WARRANTY
-- ============================================

-- Add request_type to distinguish between new business, change orders, and warranty
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50) DEFAULT 'new_business';
  -- Values: new_business, change_order, warranty

CREATE INDEX IF NOT EXISTS idx_requests_type ON service_requests(request_type);

-- ============================================
-- 4. HELPER FUNCTION: CREATE PROJECT
-- ============================================

CREATE OR REPLACE FUNCTION create_project_from_request(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
  v_request service_requests%ROWTYPE;
  v_project_id UUID;
BEGIN
  -- Get request data
  SELECT * INTO v_request FROM service_requests WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  -- Check if request already has a project
  IF v_request.project_id IS NOT NULL THEN
    RETURN v_request.project_id;
  END IF;

  -- Create project
  INSERT INTO projects (
    client_id,
    community_id,
    property_id,
    product_type,
    address_line1,
    city,
    state,
    zip,
    territory_id,
    assigned_rep_id,
    created_by
  ) VALUES (
    v_request.client_id,
    v_request.community_id,
    v_request.property_id,
    v_request.product_type,
    v_request.address_line1,
    v_request.city,
    v_request.state,
    v_request.zip,
    v_request.territory_id,
    v_request.assigned_rep_id,
    v_request.created_by
  ) RETURNING id INTO v_project_id;

  -- Link request to project
  UPDATE service_requests SET project_id = v_project_id WHERE id = p_request_id;

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read projects
DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated users to insert projects
DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update projects
DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update" ON projects
  FOR UPDATE TO authenticated
  USING (true);

-- ============================================
-- 6. UPDATE TIMESTAMP TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE projects IS 'Groups related requests, quotes, jobs, and invoices into a single customer engagement';
COMMENT ON COLUMN projects.status IS 'active=in progress, complete=all work done, on_hold=paused, cancelled=abandoned, warranty=warranty period';
COMMENT ON COLUMN service_requests.request_type IS 'new_business=standard sale, change_order=addition to existing project, warranty=warranty claim';
COMMENT ON COLUMN service_requests.converted_to_job_id IS 'For direct Request→Job conversion (skipping quote)';
COMMENT ON COLUMN jobs.request_id IS 'Direct link to request when job created without quote';
COMMENT ON COLUMN jobs.is_warranty IS 'True if this job is warranty work (typically $0 invoice)';
