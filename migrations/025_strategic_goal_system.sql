-- ============================================
-- STRATEGIC GOAL MANAGEMENT SYSTEM
-- Purpose: Annual/Quarterly goals with bonus alignment, initiatives, and tasks
-- ============================================

-- ============================================
-- 1. RENAME BUCKETS TO AREAS
-- ============================================

ALTER TABLE project_buckets RENAME TO project_areas;
ALTER TABLE project_initiatives RENAME COLUMN bucket_id TO area_id;

-- Update foreign key name (cosmetic)
COMMENT ON COLUMN project_initiatives.area_id IS 'Reference to project area (formerly bucket)';

-- Update indexes
DROP INDEX IF EXISTS idx_project_buckets_function;
DROP INDEX IF EXISTS idx_project_buckets_active;
DROP INDEX IF EXISTS idx_project_buckets_sort;
DROP INDEX IF EXISTS idx_initiatives_bucket;

CREATE INDEX idx_project_areas_function ON project_areas(function_id);
CREATE INDEX idx_project_areas_active ON project_areas(is_active) WHERE is_active = true;
CREATE INDEX idx_project_areas_sort ON project_areas(function_id, sort_order);
CREATE INDEX idx_initiatives_area ON project_initiatives(area_id);

-- Update RLS policy names
DROP POLICY IF EXISTS "Users can view buckets in their functions" ON project_areas;
DROP POLICY IF EXISTS "Admins and leads can create buckets" ON project_areas;
DROP POLICY IF EXISTS "Admins and leads can update buckets" ON project_areas;
DROP POLICY IF EXISTS "Admins and leads can delete buckets" ON project_areas;

CREATE POLICY "Users can view areas in their functions" ON project_areas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_areas.function_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and leads can create areas" ON project_areas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_areas.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "Admins and leads can update areas" ON project_areas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_areas.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "Admins and leads can delete areas" ON project_areas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_areas.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- ============================================
-- 2. ADD WEEKLY UPDATE FIELDS TO INITIATIVES
-- ============================================

ALTER TABLE project_initiatives
ADD COLUMN this_week_progress TEXT,
ADD COLUMN next_week_plan TEXT,
ADD COLUMN last_updated_by UUID REFERENCES user_profiles(id),
ADD COLUMN last_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN project_initiatives.this_week_progress IS 'What was accomplished this week';
COMMENT ON COLUMN project_initiatives.next_week_plan IS 'What is planned for next week';

-- ============================================
-- 3. CREATE TASKS TABLE
-- ============================================

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,

  assigned_to UUID REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),

  due_date DATE,
  estimated_hours INTEGER,
  actual_hours INTEGER,

  sort_order INTEGER DEFAULT 0,

  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES user_profiles(id),

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_initiative ON project_tasks(initiative_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON project_tasks(status);
CREATE INDEX idx_tasks_due_date ON project_tasks(due_date) WHERE status != 'done';

COMMENT ON TABLE project_tasks IS 'Individual actionable tasks within initiatives';

-- ============================================
-- 4. CREATE ANNUAL GOALS TABLE
-- ============================================

CREATE TABLE project_annual_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Measurement
  target_metric TEXT, -- What we're measuring (e.g., "Cost reduction", "On-time delivery %")
  target_value TEXT, -- Target to achieve (e.g., "-15%", "98%", "3 vendors")
  current_value TEXT, -- Current progress value
  measurement_method TEXT, -- How it's calculated or measured
  unit TEXT, -- Unit of measurement (%, $, count, days, etc.)

  -- Scoring
  measurement_type TEXT DEFAULT 'formula' CHECK (measurement_type IN ('formula', 'discretionary', 'hybrid')),
  formula_weight INTEGER, -- % of this goal's score from formula (0-100)
  discretionary_weight INTEGER, -- % from discretionary scoring (0-100)
  discretionary_score INTEGER, -- Manual score 0-100 (filled at review time)

  -- Compensation
  bonus_weight INTEGER NOT NULL CHECK (bonus_weight BETWEEN 0 AND 100), -- % of total bonus

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),

  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,

  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure formula + discretionary weights total 100 if hybrid
  CONSTRAINT valid_weight_split CHECK (
    (measurement_type = 'formula' AND formula_weight = 100 AND discretionary_weight = 0) OR
    (measurement_type = 'discretionary' AND formula_weight = 0 AND discretionary_weight = 100) OR
    (measurement_type = 'hybrid' AND formula_weight + discretionary_weight = 100)
  )
);

CREATE INDEX idx_annual_goals_function ON project_annual_goals(function_id);
CREATE INDEX idx_annual_goals_year ON project_annual_goals(year);
CREATE INDEX idx_annual_goals_status ON project_annual_goals(status);

COMMENT ON TABLE project_annual_goals IS 'Strategic annual goals with bonus weighting';
COMMENT ON COLUMN project_annual_goals.measurement_type IS 'How goal is scored: formula (auto-calculated), discretionary (manual), or hybrid (mix)';

-- ============================================
-- 5. CREATE QUARTERLY GOALS TABLE
-- ============================================

CREATE TABLE project_quarterly_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annual_goal_id UUID NOT NULL REFERENCES project_annual_goals(id) ON DELETE CASCADE,

  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year INTEGER NOT NULL,

  title TEXT NOT NULL,
  description TEXT,

  target_value TEXT,
  current_value TEXT,

  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'at_risk', 'completed', 'cancelled')),

  -- Review tracking
  mid_quarter_review_notes TEXT,
  mid_quarter_review_at TIMESTAMPTZ,
  mid_quarter_review_by UUID REFERENCES user_profiles(id),

  end_quarter_review_notes TEXT,
  end_quarter_review_at TIMESTAMPTZ,
  end_quarter_review_by UUID REFERENCES user_profiles(id),

  due_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quarterly_goals_annual ON project_quarterly_goals(annual_goal_id);
CREATE INDEX idx_quarterly_goals_period ON project_quarterly_goals(year, quarter);
CREATE INDEX idx_quarterly_goals_status ON project_quarterly_goals(status);

COMMENT ON TABLE project_quarterly_goals IS 'Quarterly milestones derived from annual goals';

-- ============================================
-- 6. CREATE INITIATIVE-GOAL LINKS TABLE
-- ============================================

CREATE TABLE initiative_goal_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  quarterly_goal_id UUID NOT NULL REFERENCES project_quarterly_goals(id) ON DELETE CASCADE,

  contribution_weight INTEGER CHECK (contribution_weight BETWEEN 0 AND 100), -- How much this initiative contributes to goal
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiative_id, quarterly_goal_id)
);

CREATE INDEX idx_goal_links_initiative ON initiative_goal_links(initiative_id);
CREATE INDEX idx_goal_links_goal ON initiative_goal_links(quarterly_goal_id);

COMMENT ON TABLE initiative_goal_links IS 'Links initiatives to quarterly goals they contribute to';

-- ============================================
-- 7. CREATE PERFORMANCE SNAPSHOTS TABLE
-- ============================================

CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id),
  user_id UUID REFERENCES user_profiles(id), -- NULL = function-level, not individual

  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('mid_quarter', 'quarter_end', 'annual')),
  year INTEGER NOT NULL,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL for annual snapshots

  -- Overall scores
  overall_completion DECIMAL(5,2), -- 0-100
  formula_score DECIMAL(5,2), -- Score from formula-based goals
  discretionary_score DECIMAL(5,2), -- Score from discretionary goals
  bonus_multiplier DECIMAL(5,2), -- Final bonus % (can be negative)

  -- Detailed breakdown
  goal_details JSONB NOT NULL, -- Full snapshot of all goals and their scores

  -- Review info
  reviewed_by UUID REFERENCES user_profiles(id),
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_function ON performance_snapshots(function_id);
CREATE INDEX idx_snapshots_user ON performance_snapshots(user_id);
CREATE INDEX idx_snapshots_period ON performance_snapshots(year, quarter);
CREATE INDEX idx_snapshots_type ON performance_snapshots(snapshot_type);

COMMENT ON TABLE performance_snapshots IS 'Historical performance records for bonus calculation and reviews';

-- ============================================
-- 8. CREATE BONUS PARTICIPANTS TABLE
-- ============================================

CREATE TABLE bonus_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),

  year INTEGER NOT NULL,

  participation_level TEXT CHECK (participation_level IN ('full', 'partial')),
  participation_percentage INTEGER CHECK (participation_percentage BETWEEN 0 AND 100),

  notes TEXT,

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(function_id, user_id, year)
);

CREATE INDEX idx_bonus_participants_function ON bonus_participants(function_id);
CREATE INDEX idx_bonus_participants_user ON bonus_participants(user_id);
CREATE INDEX idx_bonus_participants_year ON bonus_participants(year);

COMMENT ON TABLE bonus_participants IS 'Tracks which users participate in function goal bonuses and at what level';

-- ============================================
-- 9. ROW LEVEL SECURITY
-- ============================================

-- Tasks
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their functions" ON project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_areas ON project_areas.id = project_initiatives.area_id
      JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
      WHERE project_initiatives.id = project_tasks.initiative_id
      AND project_function_access.user_id = auth.uid()
    )
    OR assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create tasks" ON project_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_areas ON project_areas.id = project_initiatives.area_id
      JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
      WHERE project_initiatives.id = project_tasks.initiative_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead', 'member')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update tasks" ON project_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_areas ON project_areas.id = project_initiatives.area_id
      JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
      WHERE project_initiatives.id = project_tasks.initiative_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Annual Goals (visible to all with function access)
ALTER TABLE project_annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view goals in any function" ON project_annual_goals
  FOR SELECT USING (true); -- All goals visible to all (per requirement)

CREATE POLICY "Admins and leads can manage goals" ON project_annual_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_annual_goals.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- Quarterly Goals
ALTER TABLE project_quarterly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all quarterly goals" ON project_quarterly_goals
  FOR SELECT USING (true);

CREATE POLICY "Admins and leads can manage quarterly goals" ON project_quarterly_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_annual_goals
      JOIN project_function_access ON project_function_access.function_id = project_annual_goals.function_id
      WHERE project_annual_goals.id = project_quarterly_goals.annual_goal_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Initiative Goal Links
ALTER TABLE initiative_goal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all goal links" ON initiative_goal_links
  FOR SELECT USING (true);

CREATE POLICY "Admins and leads can manage goal links" ON initiative_goal_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_areas ON project_areas.id = project_initiatives.area_id
      JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
      WHERE project_initiatives.id = initiative_goal_links.initiative_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Performance Snapshots
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all snapshots" ON performance_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own snapshots" ON performance_snapshots
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Function leads can view their function snapshots" ON performance_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = performance_snapshots.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role = 'lead'
    )
  );

CREATE POLICY "Admins can create snapshots" ON performance_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Bonus Participants
ALTER TABLE bonus_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and leads can view participants" ON bonus_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = bonus_participants.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Admins can manage participants" ON bonus_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Function to calculate goal completion percentage
CREATE OR REPLACE FUNCTION calculate_goal_completion(
  p_annual_goal_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_completion INTEGER;
BEGIN
  -- Calculate based on linked quarterly goals
  SELECT COALESCE(AVG(completion_percentage), 0)::INTEGER
  INTO v_completion
  FROM project_quarterly_goals
  WHERE annual_goal_id = p_annual_goal_id
  AND status != 'cancelled';

  RETURN v_completion;
END;
$$ LANGUAGE plpgsql;

-- Function to validate annual goal weights total 100% for a function
CREATE OR REPLACE FUNCTION validate_annual_goal_weights(
  p_function_id UUID,
  p_year INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(bonus_weight), 0)
  INTO v_total
  FROM project_annual_goals
  WHERE function_id = p_function_id
  AND year = p_year
  AND status = 'active';

  RETURN v_total = 100;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. TRIGGERS
-- ============================================

-- Auto-update task timestamps
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_annual_goals_updated_at BEFORE UPDATE ON project_annual_goals
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_quarterly_goals_updated_at BEFORE UPDATE ON project_quarterly_goals
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_bonus_participants_updated_at BEFORE UPDATE ON bonus_participants
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE project_areas IS 'Responsibility areas within functions (formerly buckets)';
COMMENT ON TABLE project_tasks IS 'Actionable tasks within initiatives';
COMMENT ON TABLE project_annual_goals IS 'Strategic annual goals with bonus weighting and measurement methods';
COMMENT ON TABLE project_quarterly_goals IS 'Quarterly milestones breaking down annual goals';
COMMENT ON TABLE initiative_goal_links IS 'Links initiatives to the quarterly goals they contribute to';
COMMENT ON TABLE performance_snapshots IS 'Historical performance snapshots for reviews and bonus calculation';
COMMENT ON TABLE bonus_participants IS 'Tracks which users receive bonuses based on function goals';
