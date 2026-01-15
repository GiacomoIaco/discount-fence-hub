# Database Migrations - FSM Architecture Overhaul

## Overview

This document contains all SQL migrations needed to support the new FSM architecture. Run these in order.

---

## Migration 1: Job Visits Table

Creates the `job_visits` table for tracking multiple trips to a job site.

```sql
-- ============================================================================
-- MIGRATION: Create job_visits table
-- Purpose: Track multiple visits per job for rework/callback tracking
-- ============================================================================

-- Create the job_visits table
CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Visit identification
  visit_number INTEGER NOT NULL,
  
  -- Type/Reason for visit
  visit_type TEXT NOT NULL DEFAULT 'scheduled',
  -- Valid values:
  -- 'scheduled'    - Original planned work
  -- 'continuation' - Multi-day job, continuing work
  -- 'callback'     - Customer called, something wrong
  -- 'rework'       - We identified issue, going back to fix
  -- 'punch_list'   - Final touch-ups before closing
  -- 'inspection'   - Quality check / customer walkthrough
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,
  arrival_window_minutes INTEGER DEFAULT 60,
  assigned_crew_id UUID REFERENCES crews(id),
  
  -- Execution timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Labor tracking
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  labor_rate DECIMAL(10,2),           -- Hourly rate at time of visit
  labor_cost DECIMAL(10,2),           -- actual_hours * labor_rate (or override)
  
  -- For callbacks/rework: what was the issue?
  issue_description TEXT,
  issue_reported_by TEXT,             -- 'customer', 'crew', 'office', 'inspection'
  issue_reported_at TIMESTAMPTZ,
  
  -- Resolution
  resolution_notes TEXT,
  resolution_verified_by UUID REFERENCES auth.users(id),
  
  -- General notes
  instructions TEXT,                  -- Work instructions for crew
  completion_notes TEXT,              -- Notes from crew after completion
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- 'scheduled', 'en_route', 'on_site', 'in_progress', 'completed', 'cancelled', 'rescheduled'
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_job_visit_number UNIQUE(job_id, visit_number),
  CONSTRAINT valid_visit_type CHECK (visit_type IN (
    'scheduled', 'continuation', 'callback', 'rework', 'punch_list', 'inspection'
  )),
  CONSTRAINT valid_visit_status CHECK (status IN (
    'scheduled', 'en_route', 'on_site', 'in_progress', 'completed', 'cancelled', 'rescheduled'
  ))
);

-- Indexes for common queries
CREATE INDEX idx_job_visits_job_id ON job_visits(job_id);
CREATE INDEX idx_job_visits_scheduled_date ON job_visits(scheduled_date);
CREATE INDEX idx_job_visits_assigned_crew ON job_visits(assigned_crew_id);
CREATE INDEX idx_job_visits_type ON job_visits(visit_type);
CREATE INDEX idx_job_visits_status ON job_visits(status);

-- Composite index for crew schedules
CREATE INDEX idx_job_visits_crew_date ON job_visits(assigned_crew_id, scheduled_date) 
  WHERE status NOT IN ('cancelled', 'rescheduled');

-- Index for finding rework/callbacks
CREATE INDEX idx_job_visits_rework ON job_visits(job_id) 
  WHERE visit_type IN ('callback', 'rework');

-- Enable RLS
ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth model)
CREATE POLICY "Users can view job visits" ON job_visits
  FOR SELECT USING (true);

CREATE POLICY "Users can insert job visits" ON job_visits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update job visits" ON job_visits
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete job visits" ON job_visits
  FOR DELETE USING (true);

-- Trigger to auto-increment visit_number
CREATE OR REPLACE FUNCTION set_visit_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_number IS NULL THEN
    SELECT COALESCE(MAX(visit_number), 0) + 1 
    INTO NEW.visit_number
    FROM job_visits 
    WHERE job_id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_visit_number
  BEFORE INSERT ON job_visits
  FOR EACH ROW
  EXECUTE FUNCTION set_visit_number();

-- Trigger to update updated_at
CREATE TRIGGER update_job_visits_updated_at
  BEFORE UPDATE ON job_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE job_visits IS 'Tracks individual visits/trips to job sites. Supports rework and callback tracking with budget vs actual analysis.';
```

---

## Migration 2: Projects Table Enhancements

Add fields to support Project linking (warranty, phase 2, etc.) and source tracking.

```sql
-- ============================================================================
-- MIGRATION: Enhance projects table
-- Purpose: Add parent linking for warranty/related projects, source tracking
-- ============================================================================

-- Add parent project linking
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id);

-- Add relationship type
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS relationship_type TEXT;
-- Valid values: 'warranty', 'callback', 'phase_2', 'add_on', 'related'

-- Add source tracking
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'request';
-- Valid values: 'request', 'direct_quote', 'direct_job', 'warranty', 'migration', 'project_radar'

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS source_reference TEXT;
-- For project_radar: conversation_id; for migration: external_id; etc.

-- Add computed/denormalized fields for quick access
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS has_warranty_claims BOOLEAN DEFAULT false;

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS warranty_cost_total DECIMAL(10,2) DEFAULT 0;

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS child_project_count INTEGER DEFAULT 0;

-- Add constraint for relationship_type
ALTER TABLE projects 
  ADD CONSTRAINT valid_relationship_type 
  CHECK (relationship_type IS NULL OR relationship_type IN (
    'warranty', 'callback', 'phase_2', 'add_on', 'related'
  ));

-- Add constraint for source
ALTER TABLE projects 
  ADD CONSTRAINT valid_project_source 
  CHECK (source IN (
    'request', 'direct_quote', 'direct_job', 'warranty', 'migration', 'project_radar'
  ));

-- Index for finding child projects
CREATE INDEX IF NOT EXISTS idx_projects_parent 
  ON projects(parent_project_id) 
  WHERE parent_project_id IS NOT NULL;

-- Index for finding warranty projects
CREATE INDEX IF NOT EXISTS idx_projects_warranty 
  ON projects(parent_project_id) 
  WHERE relationship_type = 'warranty';

-- Index for source analysis
CREATE INDEX IF NOT EXISTS idx_projects_source ON projects(source);

-- Trigger to update parent project when warranty is created
CREATE OR REPLACE FUNCTION update_parent_project_warranty_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- When a warranty project is created
  IF NEW.relationship_type = 'warranty' AND NEW.parent_project_id IS NOT NULL THEN
    UPDATE projects SET
      has_warranty_claims = true,
      child_project_count = child_project_count + 1
    WHERE id = NEW.parent_project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parent_warranty_stats
  AFTER INSERT ON projects
  FOR EACH ROW
  WHEN (NEW.relationship_type = 'warranty' AND NEW.parent_project_id IS NOT NULL)
  EXECUTE FUNCTION update_parent_project_warranty_stats();

-- Trigger to update warranty cost total on parent
CREATE OR REPLACE FUNCTION update_parent_warranty_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent's warranty_cost_total when child project costs change
  IF NEW.parent_project_id IS NOT NULL AND NEW.relationship_type = 'warranty' THEN
    UPDATE projects SET
      warranty_cost_total = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM projects
        WHERE parent_project_id = NEW.parent_project_id
        AND relationship_type = 'warranty'
      )
    WHERE id = NEW.parent_project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parent_warranty_cost
  AFTER INSERT OR UPDATE OF total_cost ON projects
  FOR EACH ROW
  WHEN (NEW.relationship_type = 'warranty' AND NEW.parent_project_id IS NOT NULL)
  EXECUTE FUNCTION update_parent_warranty_cost();

COMMENT ON COLUMN projects.parent_project_id IS 'Links to original project for warranty/callback/phase work';
COMMENT ON COLUMN projects.relationship_type IS 'Type of relationship to parent: warranty, callback, phase_2, add_on, related';
COMMENT ON COLUMN projects.source IS 'How this project was created: request, direct_quote, direct_job, warranty, migration, project_radar';
```

---

## Migration 3: Jobs Table Enhancements

Add budget vs. actual tracking and rework flags.

```sql
-- ============================================================================
-- MIGRATION: Enhance jobs table
-- Purpose: Add budget vs actual tracking, rework flags, visit aggregation
-- ============================================================================

-- Budget fields (from quote/estimate)
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS budgeted_labor_hours DECIMAL(6,2);

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS budgeted_labor_cost DECIMAL(10,2);

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS budgeted_material_cost DECIMAL(10,2);

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS budgeted_total_cost DECIMAL(10,2);

-- Actual fields (computed from visits + expenses)
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS actual_labor_hours DECIMAL(6,2) DEFAULT 0;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS actual_labor_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS actual_total_cost DECIMAL(10,2) DEFAULT 0;

-- Variance fields (computed: budgeted - actual, negative = over budget)
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS labor_hours_variance DECIMAL(6,2) GENERATED ALWAYS AS (
    COALESCE(budgeted_labor_hours, 0) - COALESCE(actual_labor_hours, 0)
  ) STORED;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS labor_cost_variance DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(budgeted_labor_cost, 0) - COALESCE(actual_labor_cost, 0)
  ) STORED;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS total_cost_variance DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(budgeted_total_cost, 0) - COALESCE(actual_total_cost, 0)
  ) STORED;

-- Rework tracking
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS has_rework BOOLEAN DEFAULT false;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS rework_visit_count INTEGER DEFAULT 0;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS rework_labor_cost DECIMAL(10,2) DEFAULT 0;

-- Visit count
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;

-- Profitability (revenue - actual costs)
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS gross_profit DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(quoted_total, 0) - COALESCE(actual_total_cost, 0)
  ) STORED;

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS gross_margin_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(quoted_total, 0) > 0 
      THEN ROUND(((COALESCE(quoted_total, 0) - COALESCE(actual_total_cost, 0)) / quoted_total * 100)::numeric, 2)
      ELSE 0 
    END
  ) STORED;

-- Index for finding over-budget jobs
CREATE INDEX IF NOT EXISTS idx_jobs_over_budget 
  ON jobs(total_cost_variance) 
  WHERE total_cost_variance < 0;

-- Index for finding jobs with rework
CREATE INDEX IF NOT EXISTS idx_jobs_rework 
  ON jobs(id) 
  WHERE has_rework = true;

-- Trigger to update job stats when visits change
CREATE OR REPLACE FUNCTION update_job_visit_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Get the job_id (handle INSERT, UPDATE, DELETE)
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  -- Update job with aggregated visit data
  UPDATE jobs SET
    visit_count = (
      SELECT COUNT(*) 
      FROM job_visits 
      WHERE job_id = v_job_id
      AND status != 'cancelled'
    ),
    actual_labor_hours = (
      SELECT COALESCE(SUM(actual_hours), 0) 
      FROM job_visits 
      WHERE job_id = v_job_id
      AND status = 'completed'
    ),
    actual_labor_cost = (
      SELECT COALESCE(SUM(labor_cost), 0) 
      FROM job_visits 
      WHERE job_id = v_job_id
      AND status = 'completed'
    ),
    has_rework = EXISTS (
      SELECT 1 
      FROM job_visits 
      WHERE job_id = v_job_id 
      AND visit_type IN ('callback', 'rework')
      AND status != 'cancelled'
    ),
    rework_visit_count = (
      SELECT COUNT(*) 
      FROM job_visits 
      WHERE job_id = v_job_id 
      AND visit_type IN ('callback', 'rework')
      AND status != 'cancelled'
    ),
    rework_labor_cost = (
      SELECT COALESCE(SUM(labor_cost), 0) 
      FROM job_visits 
      WHERE job_id = v_job_id 
      AND visit_type IN ('callback', 'rework')
      AND status = 'completed'
    ),
    updated_at = NOW()
  WHERE id = v_job_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on job_visits changes
DROP TRIGGER IF EXISTS trigger_update_job_visit_stats ON job_visits;
CREATE TRIGGER trigger_update_job_visit_stats
  AFTER INSERT OR UPDATE OR DELETE ON job_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_job_visit_stats();

-- Also update actual_total_cost when labor or material cost changes
CREATE OR REPLACE FUNCTION compute_job_actual_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actual_total_cost := COALESCE(NEW.actual_labor_cost, 0) + COALESCE(NEW.actual_material_cost, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compute_job_actual_total ON jobs;
CREATE TRIGGER trigger_compute_job_actual_total
  BEFORE INSERT OR UPDATE OF actual_labor_cost, actual_material_cost ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION compute_job_actual_total();

COMMENT ON COLUMN jobs.has_rework IS 'True if job has any callback or rework visits';
COMMENT ON COLUMN jobs.rework_labor_cost IS 'Sum of labor costs for callback/rework visits only';
COMMENT ON COLUMN jobs.labor_cost_variance IS 'Budgeted minus actual (negative = over budget)';
```

---

## Migration 4: Auto-Create Project Triggers

Triggers to automatically create Projects when needed.

```sql
-- ============================================================================
-- MIGRATION: Auto-create Project triggers
-- Purpose: Ensure every Quote and standalone Job has a Project
-- ============================================================================

-- Function to create a project for a quote
CREATE OR REPLACE FUNCTION auto_create_project_for_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_project_name TEXT;
  v_source TEXT;
BEGIN
  -- Only if quote doesn't already have a project
  IF NEW.project_id IS NULL THEN
    
    -- Determine source based on whether quote came from request
    IF NEW.request_id IS NOT NULL THEN
      v_source := 'request';
      
      -- Get project name from request or client
      SELECT COALESCE(sr.title, c.name, 'New Project')
      INTO v_project_name
      FROM service_requests sr
      LEFT JOIN clients c ON c.id = sr.client_id
      WHERE sr.id = NEW.request_id;
    ELSE
      v_source := 'direct_quote';
      
      -- Get project name from client
      SELECT COALESCE(c.name, 'New Project')
      INTO v_project_name
      FROM clients c
      WHERE c.id = NEW.client_id;
    END IF;
    
    -- Create the project
    INSERT INTO projects (
      client_id,
      community_id,
      property_id,
      name,
      product_type,
      address_line1,
      city,
      state,
      zip,
      source,
      status
    ) VALUES (
      NEW.client_id,
      NEW.community_id,
      NEW.property_id,
      v_project_name,
      NEW.product_type,
      (NEW.job_address->>'line1')::TEXT,
      (NEW.job_address->>'city')::TEXT,
      COALESCE((NEW.job_address->>'state')::TEXT, 'TX'),
      (NEW.job_address->>'zip')::TEXT,
      v_source,
      'active'
    )
    RETURNING id INTO v_project_id;
    
    -- Set the project_id on the quote
    NEW.project_id := v_project_id;
    
    -- Also link the request to the project if exists
    IF NEW.request_id IS NOT NULL THEN
      UPDATE service_requests 
      SET project_id = v_project_id
      WHERE id = NEW.request_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_project_for_quote ON quotes;
CREATE TRIGGER trigger_auto_create_project_for_quote
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_project_for_quote();

-- Function to create a project for a standalone job (no quote)
CREATE OR REPLACE FUNCTION auto_create_project_for_job()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_project_name TEXT;
BEGIN
  -- Only if job doesn't have a project AND doesn't have a quote (which would have created project)
  IF NEW.project_id IS NULL AND NEW.quote_id IS NULL THEN
    
    -- Get project name from client
    SELECT COALESCE(c.name, 'Direct Job')
    INTO v_project_name
    FROM clients c
    WHERE c.id = NEW.client_id;
    
    -- Create the project
    INSERT INTO projects (
      client_id,
      community_id,
      property_id,
      name,
      product_type,
      address_line1,
      city,
      state,
      zip,
      source,
      status
    ) VALUES (
      NEW.client_id,
      NEW.community_id,
      NEW.property_id,
      v_project_name,
      NEW.product_type,
      (NEW.job_address->>'line1')::TEXT,
      (NEW.job_address->>'city')::TEXT,
      COALESCE((NEW.job_address->>'state')::TEXT, 'TX'),
      (NEW.job_address->>'zip')::TEXT,
      'direct_job',
      'active'
    )
    RETURNING id INTO v_project_id;
    
    -- Set the project_id on the job
    NEW.project_id := v_project_id;
    
  -- If job has a quote but no project_id, inherit from quote
  ELSIF NEW.project_id IS NULL AND NEW.quote_id IS NOT NULL THEN
    SELECT project_id INTO NEW.project_id
    FROM quotes
    WHERE id = NEW.quote_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_project_for_job ON jobs;
CREATE TRIGGER trigger_auto_create_project_for_job
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_project_for_job();

-- Ensure service_requests has project_id column
ALTER TABLE service_requests 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_service_requests_project 
  ON service_requests(project_id) 
  WHERE project_id IS NOT NULL;

COMMENT ON FUNCTION auto_create_project_for_quote IS 'Auto-creates a Project container when a Quote is created without one';
COMMENT ON FUNCTION auto_create_project_for_job IS 'Auto-creates a Project container when a Job is created without one (and without a Quote)';
```

---

## Migration 5: Initial Visit Creation

When a job is scheduled, auto-create the first visit.

```sql
-- ============================================================================
-- MIGRATION: Auto-create first visit when job is scheduled
-- Purpose: Jobs with scheduled_date should have at least one visit
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_initial_visit()
RETURNS TRIGGER AS $$
BEGIN
  -- When a job gets scheduled_date AND assigned_crew_id for the first time
  IF NEW.scheduled_date IS NOT NULL 
     AND NEW.assigned_crew_id IS NOT NULL
     AND (OLD.scheduled_date IS NULL OR OLD.assigned_crew_id IS NULL)
  THEN
    -- Check if job already has visits
    IF NOT EXISTS (SELECT 1 FROM job_visits WHERE job_id = NEW.id) THEN
      -- Create the initial visit
      INSERT INTO job_visits (
        job_id,
        visit_type,
        scheduled_date,
        assigned_crew_id,
        estimated_hours,
        status,
        instructions
      ) VALUES (
        NEW.id,
        'scheduled',
        NEW.scheduled_date,
        NEW.assigned_crew_id,
        NEW.budgeted_labor_hours,
        'scheduled',
        NEW.special_instructions
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_initial_visit ON jobs;
CREATE TRIGGER trigger_auto_create_initial_visit
  AFTER INSERT OR UPDATE OF scheduled_date, assigned_crew_id ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_initial_visit();

COMMENT ON FUNCTION auto_create_initial_visit IS 'Auto-creates the first visit when a job is scheduled with a date and crew';
```

---

## Migration 6: Helper Functions

Useful functions for querying and reporting.

```sql
-- ============================================================================
-- MIGRATION: Helper functions for FSM
-- Purpose: Reusable functions for common operations
-- ============================================================================

-- Function to get all entities for a project
CREATE OR REPLACE FUNCTION get_project_entities(p_project_id UUID)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  entity_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  total_value DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  
  -- Requests
  SELECT 
    'request'::TEXT,
    sr.id,
    sr.request_number,
    sr.status,
    sr.created_at,
    NULL::DECIMAL
  FROM service_requests sr
  WHERE sr.project_id = p_project_id
  
  UNION ALL
  
  -- Quotes
  SELECT 
    'quote'::TEXT,
    q.id,
    q.quote_number,
    q.status,
    q.created_at,
    q.total
  FROM quotes q
  WHERE q.project_id = p_project_id
  
  UNION ALL
  
  -- Jobs
  SELECT 
    'job'::TEXT,
    j.id,
    j.job_number,
    j.status,
    j.created_at,
    j.quoted_total
  FROM jobs j
  WHERE j.project_id = p_project_id
  
  UNION ALL
  
  -- Invoices
  SELECT 
    'invoice'::TEXT,
    i.id,
    i.invoice_number,
    i.status,
    i.created_at,
    i.total
  FROM invoices i
  WHERE i.project_id = p_project_id
  
  ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get project with all relationships
CREATE OR REPLACE FUNCTION get_project_with_children(p_project_id UUID)
RETURNS TABLE (
  project_id UUID,
  project_number TEXT,
  project_name TEXT,
  relationship_type TEXT,
  status TEXT,
  total_value DECIMAL,
  warranty_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  
  -- Original project
  SELECT 
    p.id,
    p.project_number,
    p.name,
    NULL::TEXT,
    p.status,
    p.total_quoted,
    p.warranty_cost_total
  FROM projects p
  WHERE p.id = p_project_id
  
  UNION ALL
  
  -- Child projects (warranty, phase 2, etc.)
  SELECT 
    p.id,
    p.project_number,
    p.name,
    p.relationship_type,
    p.status,
    p.total_quoted,
    NULL::DECIMAL
  FROM projects p
  WHERE p.parent_project_id = p_project_id
  
  ORDER BY relationship_type NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate true profitability (including warranty costs)
CREATE OR REPLACE FUNCTION calculate_true_profitability(p_project_id UUID)
RETURNS TABLE (
  revenue DECIMAL,
  direct_cost DECIMAL,
  warranty_cost DECIMAL,
  gross_profit DECIMAL,
  true_profit DECIMAL,
  gross_margin_percent DECIMAL,
  true_margin_percent DECIMAL
) AS $$
DECLARE
  v_revenue DECIMAL;
  v_direct_cost DECIMAL;
  v_warranty_cost DECIMAL;
BEGIN
  -- Get revenue and direct costs from project
  SELECT 
    COALESCE(p.total_invoiced, p.total_quoted, 0),
    COALESCE(p.total_cost, 0),
    COALESCE(p.warranty_cost_total, 0)
  INTO v_revenue, v_direct_cost, v_warranty_cost
  FROM projects p
  WHERE p.id = p_project_id;
  
  RETURN QUERY SELECT
    v_revenue,
    v_direct_cost,
    v_warranty_cost,
    v_revenue - v_direct_cost,
    v_revenue - v_direct_cost - v_warranty_cost,
    CASE WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_direct_cost) / v_revenue * 100)::numeric, 2) ELSE 0 END,
    CASE WHEN v_revenue > 0 THEN ROUND(((v_revenue - v_direct_cost - v_warranty_cost) / v_revenue * 100)::numeric, 2) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Function to get crew rework statistics
CREATE OR REPLACE FUNCTION get_crew_rework_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  crew_id UUID,
  crew_name TEXT,
  total_jobs INTEGER,
  jobs_with_rework INTEGER,
  rework_rate DECIMAL,
  total_rework_cost DECIMAL,
  total_rework_hours DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    COUNT(DISTINCT j.id)::INTEGER,
    COUNT(DISTINCT CASE WHEN j.has_rework THEN j.id END)::INTEGER,
    ROUND(
      (COUNT(DISTINCT CASE WHEN j.has_rework THEN j.id END)::DECIMAL / 
       NULLIF(COUNT(DISTINCT j.id), 0) * 100)::numeric, 
      2
    ),
    COALESCE(SUM(j.rework_labor_cost), 0),
    COALESCE(SUM(
      (SELECT SUM(actual_hours) FROM job_visits 
       WHERE job_id = j.id AND visit_type IN ('callback', 'rework'))
    ), 0)
  FROM crews c
  LEFT JOIN jobs j ON j.assigned_crew_id = c.id
    AND (p_start_date IS NULL OR j.created_at >= p_start_date)
    AND (p_end_date IS NULL OR j.created_at <= p_end_date)
  GROUP BY c.id, c.name
  ORDER BY rework_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_project_entities IS 'Returns all requests, quotes, jobs, invoices for a project';
COMMENT ON FUNCTION get_project_with_children IS 'Returns project with any warranty/related child projects';
COMMENT ON FUNCTION calculate_true_profitability IS 'Calculates profit including warranty costs from child projects';
COMMENT ON FUNCTION get_crew_rework_stats IS 'Returns rework statistics by crew for quality analysis';
```

---

## Verification Queries

Run these after migrations to verify everything is set up correctly:

```sql
-- Verify job_visits table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'job_visits'
ORDER BY ordinal_position;

-- Verify projects table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects'
AND column_name IN ('parent_project_id', 'relationship_type', 'source', 'warranty_cost_total')
ORDER BY ordinal_position;

-- Verify jobs table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs'
AND column_name LIKE '%budget%' OR column_name LIKE '%actual%' OR column_name LIKE '%rework%'
ORDER BY ordinal_position;

-- Verify triggers exist
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%visit%' OR trigger_name LIKE '%project%'
ORDER BY event_object_table, trigger_name;

-- Verify functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_name LIKE '%project%' OR routine_name LIKE '%visit%' OR routine_name LIKE '%rework%')
ORDER BY routine_name;
```

---

## Rollback Scripts (If Needed)

```sql
-- DANGER: Only run if you need to undo migrations

-- Drop job_visits table
DROP TABLE IF EXISTS job_visits CASCADE;

-- Remove project columns
ALTER TABLE projects DROP COLUMN IF EXISTS parent_project_id;
ALTER TABLE projects DROP COLUMN IF EXISTS relationship_type;
ALTER TABLE projects DROP COLUMN IF EXISTS source;
ALTER TABLE projects DROP COLUMN IF EXISTS warranty_cost_total;
ALTER TABLE projects DROP COLUMN IF EXISTS has_warranty_claims;
ALTER TABLE projects DROP COLUMN IF EXISTS child_project_count;

-- Remove job columns
ALTER TABLE jobs DROP COLUMN IF EXISTS budgeted_labor_hours;
ALTER TABLE jobs DROP COLUMN IF EXISTS budgeted_labor_cost;
-- ... (continue for all added columns)

-- Drop functions
DROP FUNCTION IF EXISTS get_project_entities(UUID);
DROP FUNCTION IF EXISTS get_project_with_children(UUID);
DROP FUNCTION IF EXISTS calculate_true_profitability(UUID);
DROP FUNCTION IF EXISTS get_crew_rework_stats(DATE, DATE);
```

---

## END OF DATABASE MIGRATIONS
