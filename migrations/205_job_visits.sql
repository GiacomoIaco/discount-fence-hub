-- Migration 205: Job Visits Table
-- Complete visit tracking for jobs with labor, issues, and rework

-- ============================================
-- 1. Create job_visits table (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL DEFAULT 1,

  -- Visit classification
  visit_type TEXT NOT NULL DEFAULT 'initial'
    CHECK (visit_type IN ('initial', 'continuation', 'rework', 'callback', 'inspection', 'warranty')),

  -- Scheduling
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  scheduled_duration_hours DECIMAL(5,2),

  -- Crew assignment
  assigned_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

  -- Actual time tracking
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,
  labor_hours DECIMAL(6,2),
  labor_rate DECIMAL(10,2),
  labor_cost DECIMAL(12,2),

  -- Crew members who worked
  crew_member_ids UUID[],
  crew_member_count INTEGER,

  -- Status
  status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')),

  -- Issue tracking (for rework/callback/warranty)
  issue_description TEXT,
  issue_category TEXT CHECK (issue_category IN ('material_defect', 'workmanship', 'customer_request', 'weather', 'other')),
  resolution_notes TEXT,
  is_billable BOOLEAN DEFAULT true,

  -- Notes and photos
  notes TEXT,
  photos TEXT[], -- Array of storage URLs

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  -- Unique constraint on job + visit number
  UNIQUE(job_id, visit_number)
);

-- ============================================
-- 2. Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_job_visits_job ON job_visits(job_id);
CREATE INDEX IF NOT EXISTS idx_job_visits_date ON job_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_job_visits_crew ON job_visits(assigned_crew_id);
CREATE INDEX IF NOT EXISTS idx_job_visits_status ON job_visits(status);
CREATE INDEX IF NOT EXISTS idx_job_visits_type ON job_visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_job_visits_rework ON job_visits(job_id) WHERE visit_type IN ('rework', 'callback', 'warranty');

-- ============================================
-- 3. Add comments
-- ============================================

COMMENT ON TABLE job_visits IS 'Tracks individual visits/appointments for a job. A job may have multiple visits.';
COMMENT ON COLUMN job_visits.visit_type IS 'initial=first visit, continuation=multi-day, rework=fix issue, callback=customer complaint, inspection=final check, warranty=warranty work';
COMMENT ON COLUMN job_visits.labor_hours IS 'Actual hours worked during this visit';
COMMENT ON COLUMN job_visits.labor_rate IS 'Hourly rate for this visit (may vary by crew/job type)';
COMMENT ON COLUMN job_visits.labor_cost IS 'labor_hours * labor_rate';
COMMENT ON COLUMN job_visits.is_billable IS 'False for warranty or goodwill rework';
COMMENT ON COLUMN job_visits.issue_category IS 'For rework/callback visits, categorizes the issue';

-- ============================================
-- 4. Auto-update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_job_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_visits_updated_at ON job_visits;
CREATE TRIGGER trg_job_visits_updated_at
BEFORE UPDATE ON job_visits
FOR EACH ROW
EXECUTE FUNCTION update_job_visits_updated_at();

-- ============================================
-- 5. Auto-calculate labor cost
-- ============================================

CREATE OR REPLACE FUNCTION calculate_visit_labor_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate labor_cost if we have hours and rate
  IF NEW.labor_hours IS NOT NULL AND NEW.labor_rate IS NOT NULL THEN
    NEW.labor_cost := NEW.labor_hours * NEW.labor_rate;
  END IF;

  -- Set completed_at when status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_visit_labor_cost ON job_visits;
CREATE TRIGGER trg_calculate_visit_labor_cost
BEFORE INSERT OR UPDATE ON job_visits
FOR EACH ROW
EXECUTE FUNCTION calculate_visit_labor_cost();

-- ============================================
-- 6. Update job actuals when visit changes
-- ============================================

CREATE OR REPLACE FUNCTION update_job_from_visit()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Get the job_id (handle both INSERT/UPDATE and DELETE)
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);

  -- Recalculate job actuals
  UPDATE jobs
  SET
    actual_labor_hours = COALESCE((
      SELECT SUM(labor_hours)
      FROM job_visits
      WHERE job_id = v_job_id AND status = 'completed'
    ), 0),
    actual_labor_cost = COALESCE((
      SELECT SUM(labor_cost)
      FROM job_visits
      WHERE job_id = v_job_id AND status = 'completed'
    ), 0),
    has_rework = EXISTS (
      SELECT 1 FROM job_visits
      WHERE job_id = v_job_id AND visit_type IN ('rework', 'callback', 'warranty')
    ),
    rework_cost = COALESCE((
      SELECT SUM(labor_cost)
      FROM job_visits
      WHERE job_id = v_job_id
        AND visit_type IN ('rework', 'callback', 'warranty')
        AND status = 'completed'
    ), 0),
    -- Update work_started_at to earliest actual_start_time
    work_started_at = (
      SELECT MIN(actual_start_time)
      FROM job_visits
      WHERE job_id = v_job_id AND actual_start_time IS NOT NULL
    ),
    -- Update work_completed_at if all visits are completed
    work_completed_at = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM job_visits
        WHERE job_id = v_job_id AND status NOT IN ('completed', 'cancelled')
      )
      THEN (
        SELECT MAX(completed_at)
        FROM job_visits
        WHERE job_id = v_job_id AND status = 'completed'
      )
      ELSE NULL
    END
  WHERE id = v_job_id;

  -- Recalculate total cost
  UPDATE jobs
  SET actual_total_cost = actual_labor_cost + COALESCE(actual_material_cost, 0)
  WHERE id = v_job_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_job_from_visit ON job_visits;
CREATE TRIGGER trg_update_job_from_visit
AFTER INSERT OR UPDATE OR DELETE ON job_visits
FOR EACH ROW
EXECUTE FUNCTION update_job_from_visit();

-- ============================================
-- 7. Auto-increment visit number
-- ============================================

CREATE OR REPLACE FUNCTION auto_increment_visit_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_number IS NULL OR NEW.visit_number = 0 THEN
    SELECT COALESCE(MAX(visit_number), 0) + 1
    INTO NEW.visit_number
    FROM job_visits
    WHERE job_id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_increment_visit_number ON job_visits;
CREATE TRIGGER trg_auto_increment_visit_number
BEFORE INSERT ON job_visits
FOR EACH ROW
EXECUTE FUNCTION auto_increment_visit_number();

-- ============================================
-- 8. RLS Policies
-- ============================================

ALTER TABLE job_visits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view visits
DROP POLICY IF EXISTS "Users can view job visits" ON job_visits;
CREATE POLICY "Users can view job visits" ON job_visits
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert visits
DROP POLICY IF EXISTS "Users can create job visits" ON job_visits;
CREATE POLICY "Users can create job visits" ON job_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update visits
DROP POLICY IF EXISTS "Users can update job visits" ON job_visits;
CREATE POLICY "Users can update job visits" ON job_visits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete visits
DROP POLICY IF EXISTS "Users can delete job visits" ON job_visits;
CREATE POLICY "Users can delete job visits" ON job_visits
  FOR DELETE
  TO authenticated
  USING (true);

SELECT 'Migration 205 complete: Job visits table created';
