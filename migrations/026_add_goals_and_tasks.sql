-- ============================================
-- ADD GOALS AND TASKS TO EXISTING SYSTEM
-- Purpose: Add annual/quarterly goals and tasks without renaming
-- ============================================

-- ============================================
-- 1. ADD WEEKLY UPDATE FIELDS TO INITIATIVES
-- ============================================

ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS this_week TEXT,
ADD COLUMN IF NOT EXISTS next_week TEXT;

COMMENT ON COLUMN project_initiatives.this_week IS 'What was accomplished this week';
COMMENT ON COLUMN project_initiatives.next_week IS 'What is planned for next week';

-- ============================================
-- 2. CREATE TASKS TABLE (OPTIONAL SUBTASKS)
-- ============================================

CREATE TABLE IF NOT EXISTS project_tasks (
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

CREATE INDEX IF NOT EXISTS idx_tasks_initiative ON project_tasks(initiative_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON project_tasks(status);

COMMENT ON TABLE project_tasks IS 'Optional subtasks within initiatives';

-- ============================================
-- 3. CREATE ANNUAL GOALS TABLE (SIMPLIFIED)
-- ============================================

CREATE TABLE IF NOT EXISTS project_annual_goals (
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

CREATE INDEX IF NOT EXISTS idx_annual_goals_function ON project_annual_goals(function_id);
CREATE INDEX IF NOT EXISTS idx_annual_goals_year ON project_annual_goals(year);
CREATE INDEX IF NOT EXISTS idx_annual_goals_status ON project_annual_goals(status) WHERE status = 'active';

COMMENT ON TABLE project_annual_goals IS 'Strategic annual goals with priority weights';
COMMENT ON COLUMN project_annual_goals.weight IS '% of focus (must total 100% per function/year)';
COMMENT ON COLUMN project_annual_goals.achievement_percentage IS 'Manually set by admin during reviews';

-- ============================================
-- 4. CREATE QUARTERLY GOALS TABLE (SIMPLIFIED)
-- ============================================

CREATE TABLE IF NOT EXISTS project_quarterly_goals (
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

CREATE INDEX IF NOT EXISTS idx_quarterly_goals_annual ON project_quarterly_goals(annual_goal_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_goals_period ON project_quarterly_goals(year, quarter);

COMMENT ON TABLE project_quarterly_goals IS 'Quarterly milestones for annual goals';

-- ============================================
-- 5. CREATE INITIATIVE-GOAL LINKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_goal_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  quarterly_goal_id UUID NOT NULL REFERENCES project_quarterly_goals(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiative_id, quarterly_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_links_initiative ON initiative_goal_links(initiative_id);
CREATE INDEX IF NOT EXISTS idx_goal_links_goal ON initiative_goal_links(quarterly_goal_id);

COMMENT ON TABLE initiative_goal_links IS 'Links initiatives to quarterly goals (for visibility and alignment)';

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

-- Tasks
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'Users can view tasks in their functions'
  ) THEN
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'Users can create tasks'
  ) THEN
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_tasks' AND policyname = 'Users can update tasks'
  ) THEN
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
  END IF;
END $$;

-- Annual Goals
ALTER TABLE project_annual_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_annual_goals' AND policyname = 'Everyone can view all goals'
  ) THEN
    CREATE POLICY "Everyone can view all goals" ON project_annual_goals
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_annual_goals' AND policyname = 'Admins and leads can manage goals'
  ) THEN
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
  END IF;
END $$;

-- Quarterly Goals
ALTER TABLE project_quarterly_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_quarterly_goals' AND policyname = 'Everyone can view all quarterly goals'
  ) THEN
    CREATE POLICY "Everyone can view all quarterly goals" ON project_quarterly_goals
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_quarterly_goals' AND policyname = 'Admins and leads can manage quarterly goals'
  ) THEN
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
  END IF;
END $$;

-- Initiative Goal Links
ALTER TABLE initiative_goal_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'initiative_goal_links' AND policyname = 'Everyone can view goal links'
  ) THEN
    CREATE POLICY "Everyone can view goal links" ON initiative_goal_links
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'initiative_goal_links' AND policyname = 'Admins and leads can manage goal links'
  ) THEN
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
  END IF;
END $$;

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

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
-- 8. TRIGGERS
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_tasks_updated_at') THEN
    CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks
      FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_annual_goals_updated_at') THEN
    CREATE TRIGGER update_project_annual_goals_updated_at BEFORE UPDATE ON project_annual_goals
      FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_quarterly_goals_updated_at') THEN
    CREATE TRIGGER update_project_quarterly_goals_updated_at BEFORE UPDATE ON project_quarterly_goals
      FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();
  END IF;
END $$;
