-- Migration 217d: Job Issues Table with Penalization
-- PART 4 of Request-Project Lifecycle Architecture

CREATE TABLE IF NOT EXISTS job_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  ticket_id UUID,

  -- Classification
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'rework_crew',
    'rework_material',
    'existing_condition',
    'customer_caused',
    'scope_change',
    'weather_damage',
    'other'
  )),

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by UUID REFERENCES auth.users(id),

  -- Financial impact
  is_billable BOOLEAN DEFAULT false,
  estimated_cost DECIMAL(10,2),
  estimated_price DECIMAL(10,2),
  actual_cost DECIMAL(10,2),

  -- Resolution
  status TEXT DEFAULT 'identified' CHECK (status IN (
    'identified', 'assessing', 'approved', 'in_progress', 'resolved', 'cancelled'
  )),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  -- Accountability (who caused it)
  responsible_crew_id UUID REFERENCES crews(id),
  responsible_user_id UUID REFERENCES auth.users(id),

  -- Penalization Tracking
  penalization_type TEXT CHECK (penalization_type IN (
    'backcharge_crew',
    'commission_reduction',
    'formal_warning',
    'supplier_claim',
    'none'
  )),
  penalization_amount DECIMAL(10,2),
  penalization_percent DECIMAL(5,2),
  penalization_target_id UUID,
  penalization_notes TEXT,
  penalization_approved_by UUID REFERENCES auth.users(id),
  penalization_approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Issues Indexes
CREATE INDEX IF NOT EXISTS idx_job_issues_job_id ON job_issues(job_id);
CREATE INDEX IF NOT EXISTS idx_job_issues_type ON job_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_job_issues_status ON job_issues(status);
CREATE INDEX IF NOT EXISTS idx_job_issues_penalization ON job_issues(penalization_type)
  WHERE penalization_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_issues_responsible_crew ON job_issues(responsible_crew_id)
  WHERE responsible_crew_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_issues_responsible_user ON job_issues(responsible_user_id)
  WHERE responsible_user_id IS NOT NULL;

-- RLS for job_issues
ALTER TABLE job_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view job issues" ON job_issues
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job issues" ON job_issues
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job issues" ON job_issues
  FOR UPDATE TO authenticated USING (true);

SELECT 'Migration 217d complete: Job issues table with penalization';
