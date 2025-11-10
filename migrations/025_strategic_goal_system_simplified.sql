-- ============================================
-- STRATEGIC GOAL SYSTEM - SIMPLIFIED
-- Purpose: Annual/Quarterly goals with weight-based prioritization
-- Focus: Alignment, visibility, and easy weekly tracking
-- ============================================

-- ============================================
-- 1. RENAME BUCKETS TO AREAS
-- ============================================

ALTER TABLE project_buckets RENAME TO project_areas;
ALTER TABLE project_initiatives RENAME COLUMN bucket_id TO area_id;

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

-- Update RLS policies
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
ADD COLUMN this_week TEXT,
ADD COLUMN next_week TEXT;

COMMENT ON COLUMN project_initiatives.this_week IS 'What was accomplished this week';
COMMENT ON COLUMN project_initiatives.next_week IS 'What is planned for next week';

-- ============================================
-- 3. CREATE TASKS TABLE (OPTIONAL SUBTASKS)
-- ============================================

CREATE TABLE project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,

  assigned_to UUID REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),

  due_date DATE,

  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_initiative ON project_tasks(initiative_id);
CREATE INDEX idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX idx_tasks_status ON project_tasks(status);

COMMENT ON TABLE project_tasks IS 'Optional subtasks within initiatives';

-- ============================================
-- 4. CREATE ANNUAL GOALS TABLE (SIMPLIFIED)
-- ============================================

CREATE TABLE project_annual_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Target (simple text description)
  target TEXT, -- e.g., "-15% cost reduction", "98% on-time delivery"

  -- Weight (% of focus - must total 100% per function)
  weight INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),

  -- Manual achievement tracking
  achievement_percentage INTEGER DEFAULT 0 CHECK (achievement_percentage BETWEEN 0 AND 100),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annual_goals_function ON project_annual_goals(function_id);
CREATE INDEX idx_annual_goals_year ON project_annual_goals(year);
CREATE INDEX idx_annual_goals_status ON project_annual_goals(status) WHERE status = 'active';

COMMENT ON TABLE project_annual_goals IS 'Strategic annual goals with priority weights';
COMMENT ON COLUMN project_annual_goals.weight IS '% of focus (must total 100% per function/year)';
COMMENT ON COLUMN project_annual_goals.achievement_percentage IS 'Manually set by admin during reviews';

-- ============================================
-- 5. CREATE QUARTERLY GOALS TABLE (SIMPLIFIED)
-- ============================================

CREATE TABLE project_quarterly_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annual_goal_id UUID NOT NULL REFERENCES project_annual_goals(id) ON DELETE CASCADE,

  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year INTEGER NOT NULL,

  target TEXT, -- Q1 milestone (simple text)
  achievement_percentage INTEGER DEFAULT 0 CHECK (achievement_percentage BETWEEN 0 AND 100),

  notes TEXT, -- Review notes

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quarterly_goals_annual ON project_quarterly_goals(annual_goal_id);
CREATE INDEX idx_quarterly_goals_period ON project_quarterly_goals(year, quarter);

COMMENT ON TABLE project_quarterly_goals IS 'Quarterly milestones for annual goals';

-- ============================================
-- 6. CREATE INITIATIVE-GOAL LINKS TABLE
-- ============================================

CREATE TABLE initiative_goal_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  quarterly_goal_id UUID NOT NULL REFERENCES project_quarterly_goals(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiative_id, quarterly_goal_id)
);

CREATE INDEX idx_goal_links_initiative ON initiative_goal_links(initiative_id);
CREATE INDEX idx_goal_links_goal ON initiative_goal_links(quarterly_goal_id);

COMMENT ON TABLE initiative_goal_links IS 'Links initiatives to quarterly goals (for visibility and alignment)';

-- ============================================
-- 7. ROW LEVEL SECURITY
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

-- Annual Goals (visible to all)
ALTER TABLE project_annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view all goals" ON project_annual_goals
  FOR SELECT USING (true);

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

-- Quarterly Goals (visible to all)
ALTER TABLE project_quarterly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view all quarterly goals" ON project_quarterly_goals
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

-- Initiative Goal Links (visible to all)
ALTER TABLE initiative_goal_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view goal links" ON initiative_goal_links
  FOR SELECT USING (true);

CREATE POLICY "Admins and leads can manage goal links" ON initiative_goal_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_areas ON project_areas.id = project_initiatives.area_id
      JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
      WHERE project_initiatives.id = initiative_goal_links.initiative_id
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

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Validate that weights total 100% for a function/year
CREATE OR REPLACE FUNCTION validate_annual_goal_weights(
  p_function_id UUID,
  p_year INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(weight), 0)
  INTO v_total
  FROM project_annual_goals
  WHERE function_id = p_function_id
  AND year = p_year
  AND status = 'active';

  RETURN v_total = 100;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_annual_goal_weights IS 'Check if active goal weights total 100% for a function/year';

-- ============================================
-- 9. TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_annual_goals_updated_at BEFORE UPDATE ON project_annual_goals
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_quarterly_goals_updated_at BEFORE UPDATE ON project_quarterly_goals
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE project_areas IS 'Responsibility areas within functions (formerly buckets)';
COMMENT ON TABLE project_tasks IS 'Optional subtasks within initiatives for breaking down work';
COMMENT ON TABLE project_annual_goals IS 'Strategic annual goals with priority weights - simple manual tracking';
COMMENT ON TABLE project_quarterly_goals IS 'Quarterly milestones for annual goals';
COMMENT ON TABLE initiative_goal_links IS 'Links initiatives to goals for alignment visibility';
