-- Migration 204: Job Enhancements
-- Adds phase tracking, budget vs actual, and project linking

-- ============================================
-- 1. Phase tracking for multi-job projects
-- ============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_number INTEGER DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS phase_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS depends_on_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- ============================================
-- 2. Budget tracking columns
-- ============================================

-- Budgeted amounts (from quote/estimate)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_labor_hours DECIMAL(8,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_labor_cost DECIMAL(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_material_cost DECIMAL(12,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budgeted_total_cost DECIMAL(12,2);

-- Actual amounts (calculated from visits and materials used)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_labor_hours DECIMAL(8,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_labor_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_total_cost DECIMAL(12,2) DEFAULT 0;

-- Rework tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_rework BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rework_reason TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rework_cost DECIMAL(12,2) DEFAULT 0;

-- ============================================
-- 3. Ensure project_id exists and is indexed
-- ============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_phase ON jobs(project_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_jobs_depends_on ON jobs(depends_on_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_has_rework ON jobs(has_rework) WHERE has_rework = true;

-- ============================================
-- 4. Work completion tracking
-- ============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_photos TEXT[]; -- Array of storage URLs

-- ============================================
-- 5. Add comments for documentation
-- ============================================

COMMENT ON COLUMN jobs.phase_number IS 'Phase order within project (1, 2, 3...). Used for multi-phase jobs like Demo, Install, Finish.';
COMMENT ON COLUMN jobs.phase_name IS 'Human-readable phase name: Demo, Fence Install, Gate Install, Stain, etc.';
COMMENT ON COLUMN jobs.depends_on_job_id IS 'If set, this job cannot start until the referenced job is completed.';
COMMENT ON COLUMN jobs.budgeted_labor_hours IS 'Estimated labor hours from quote/estimate';
COMMENT ON COLUMN jobs.budgeted_labor_cost IS 'Estimated labor cost from quote/estimate';
COMMENT ON COLUMN jobs.budgeted_material_cost IS 'Estimated material cost from quote/estimate';
COMMENT ON COLUMN jobs.actual_labor_hours IS 'Sum of labor_hours from all job_visits';
COMMENT ON COLUMN jobs.actual_labor_cost IS 'Sum of labor_cost from all job_visits';
COMMENT ON COLUMN jobs.has_rework IS 'True if any visit is type=rework or callback';
COMMENT ON COLUMN jobs.rework_cost IS 'Total cost attributed to rework visits';
COMMENT ON COLUMN jobs.work_started_at IS 'When crew actually started work (first visit started)';
COMMENT ON COLUMN jobs.work_completed_at IS 'When all work was completed (last visit completed)';

-- ============================================
-- 6. Function to recalculate job actuals
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_job_actuals(p_job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE jobs
  SET
    actual_labor_hours = COALESCE((
      SELECT SUM(labor_hours)
      FROM job_visits
      WHERE job_id = p_job_id AND status = 'completed'
    ), 0),
    actual_labor_cost = COALESCE((
      SELECT SUM(labor_cost)
      FROM job_visits
      WHERE job_id = p_job_id AND status = 'completed'
    ), 0),
    has_rework = EXISTS (
      SELECT 1 FROM job_visits
      WHERE job_id = p_job_id AND visit_type IN ('rework', 'callback')
    ),
    rework_cost = COALESCE((
      SELECT SUM(labor_cost)
      FROM job_visits
      WHERE job_id = p_job_id AND visit_type IN ('rework', 'callback') AND status = 'completed'
    ), 0),
    actual_total_cost = COALESCE((
      SELECT SUM(labor_cost)
      FROM job_visits
      WHERE job_id = p_job_id AND status = 'completed'
    ), 0) + COALESCE(actual_material_cost, 0)
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. View for job with budget variance
-- ============================================

CREATE OR REPLACE VIEW v_jobs_with_variance AS
SELECT
  j.*,
  -- Labor variance
  CASE
    WHEN j.budgeted_labor_hours > 0
    THEN ROUND(((j.actual_labor_hours - j.budgeted_labor_hours) / j.budgeted_labor_hours * 100)::numeric, 1)
    ELSE 0
  END as labor_hours_variance_pct,
  CASE
    WHEN j.budgeted_labor_cost > 0
    THEN ROUND(((j.actual_labor_cost - j.budgeted_labor_cost) / j.budgeted_labor_cost * 100)::numeric, 1)
    ELSE 0
  END as labor_cost_variance_pct,
  -- Total variance
  CASE
    WHEN j.budgeted_total_cost > 0
    THEN ROUND(((j.actual_total_cost - j.budgeted_total_cost) / j.budgeted_total_cost * 100)::numeric, 1)
    ELSE 0
  END as total_cost_variance_pct,
  -- Profit margin (if quoted_total exists)
  CASE
    WHEN j.quoted_total > 0 AND j.actual_total_cost > 0
    THEN ROUND(((j.quoted_total - j.actual_total_cost) / j.quoted_total * 100)::numeric, 1)
    ELSE NULL
  END as profit_margin_pct
FROM jobs j;

GRANT SELECT ON v_jobs_with_variance TO authenticated;

SELECT 'Migration 204 complete: Job enhancements added';
