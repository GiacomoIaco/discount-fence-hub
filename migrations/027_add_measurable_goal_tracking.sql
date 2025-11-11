-- ============================================
-- ADD MEASURABLE GOAL TRACKING
-- Purpose: Add numeric targets, current values, and auto-calculation
-- Based on real-world example: $30M revenue target, 15% margin, 4.9 satisfaction
-- ============================================

-- ============================================
-- 1. ADD MEASUREMENT FIELDS TO ANNUAL GOALS
-- ============================================

ALTER TABLE project_annual_goals
ADD COLUMN IF NOT EXISTS metric_type TEXT CHECK (metric_type IN ('revenue', 'percentage', 'count', 'score', 'text')),
ADD COLUMN IF NOT EXISTS target_value NUMERIC,
ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit TEXT;

COMMENT ON COLUMN project_annual_goals.metric_type IS 'Type of measurement: revenue ($), percentage (%), count (#), score (rating), or text (descriptive only)';
COMMENT ON COLUMN project_annual_goals.target_value IS 'Numeric target value (e.g., 30000000 for $30M, 15 for 15%, 4.9 for rating)';
COMMENT ON COLUMN project_annual_goals.current_value IS 'Current progress value (updated manually or from initiatives)';
COMMENT ON COLUMN project_annual_goals.unit IS 'Unit of measurement (e.g., "$", "%", "count", "rating")';

-- ============================================
-- 2. ADD QUARTERLY MEASUREMENT FIELDS
-- ============================================

ALTER TABLE project_quarterly_goals
ADD COLUMN IF NOT EXISTS target_value NUMERIC,
ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0;

COMMENT ON COLUMN project_quarterly_goals.target_value IS 'Numeric target for this quarter (portion of annual target)';
COMMENT ON COLUMN project_quarterly_goals.current_value IS 'Current progress in this quarter';

-- ============================================
-- 3. ADD INITIATIVE CONTRIBUTION TRACKING
-- ============================================

ALTER TABLE initiative_goal_links
ADD COLUMN IF NOT EXISTS contribution_value NUMERIC,
ADD COLUMN IF NOT EXISTS contribution_notes TEXT;

COMMENT ON COLUMN initiative_goal_links.contribution_value IS 'Expected contribution to goal target (e.g., $10M of $30M)';
COMMENT ON COLUMN initiative_goal_links.contribution_notes IS 'Description of how initiative contributes to goal';

-- ============================================
-- 4. CREATE WEEKLY METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_initiative_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,

  -- Week identification
  week_ending DATE NOT NULL,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,

  -- Metrics (flexible schema)
  revenue_booked NUMERIC,
  costs_impact NUMERIC,
  customer_satisfaction NUMERIC,
  other_metrics JSONB DEFAULT '{}'::jsonb,

  -- Text updates (from this_week/next_week)
  accomplishments TEXT,
  blockers TEXT,

  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one entry per initiative per week
  UNIQUE(initiative_id, week_ending)
);

CREATE INDEX IF NOT EXISTS idx_weekly_metrics_initiative ON weekly_initiative_metrics(initiative_id);
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_week ON weekly_initiative_metrics(week_ending);
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_year_week ON weekly_initiative_metrics(year, week_number);

COMMENT ON TABLE weekly_initiative_metrics IS 'Weekly metrics tracking for initiatives (revenue, costs, satisfaction, etc.)';
COMMENT ON COLUMN weekly_initiative_metrics.revenue_booked IS 'Revenue booked this week (e.g., $550K)';
COMMENT ON COLUMN weekly_initiative_metrics.costs_impact IS 'Cost impact this week (negative = savings, e.g., -3% or -$50K)';
COMMENT ON COLUMN weekly_initiative_metrics.other_metrics IS 'Additional metrics as JSON (flexible schema)';

-- ============================================
-- 5. HELPER FUNCTIONS FOR CALCULATIONS
-- ============================================

-- Calculate achievement percentage for a goal
CREATE OR REPLACE FUNCTION calculate_goal_achievement(
  p_current_value NUMERIC,
  p_target_value NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  IF p_target_value IS NULL OR p_target_value = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((p_current_value / p_target_value) * 100, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_goal_achievement IS 'Calculate achievement % from current/target values';

-- Determine goal status based on achievement and expected pace
CREATE OR REPLACE FUNCTION calculate_goal_status(
  p_achievement_percent NUMERIC,
  p_expected_percent NUMERIC
)
RETURNS TEXT AS $$
BEGIN
  IF p_achievement_percent IS NULL OR p_expected_percent IS NULL THEN
    RETURN 'unknown';
  END IF;

  -- Ahead: > 10% above expected
  IF p_achievement_percent >= (p_expected_percent + 10) THEN
    RETURN 'ahead';
  -- Behind: > 10% below expected
  ELSIF p_achievement_percent <= (p_expected_percent - 10) THEN
    RETURN 'behind';
  -- On track: within 10% of expected
  ELSE
    RETURN 'on_track';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_goal_status IS 'Determine if goal is ahead/on_track/behind based on expected pace';

-- Calculate expected progress percentage based on current quarter
CREATE OR REPLACE FUNCTION calculate_expected_progress(
  p_year INTEGER,
  p_current_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_year_start DATE;
  v_year_end DATE;
  v_days_elapsed INTEGER;
  v_days_in_year INTEGER;
BEGIN
  v_year_start := (p_year || '-01-01')::DATE;
  v_year_end := (p_year || '-12-31')::DATE;

  v_days_elapsed := p_current_date - v_year_start;
  v_days_in_year := v_year_end - v_year_start + 1;

  RETURN ROUND((v_days_elapsed::NUMERIC / v_days_in_year::NUMERIC) * 100, 1);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_expected_progress IS 'Calculate expected % progress based on how far through the year we are';

-- Calculate running totals (YTD, QTD)
CREATE OR REPLACE FUNCTION calculate_ytd_total(
  p_initiative_id UUID,
  p_metric_field TEXT,
  p_year INTEGER
)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(SUM(%I), 0) FROM weekly_initiative_metrics WHERE initiative_id = $1 AND year = $2',
    p_metric_field
  ) INTO v_total USING p_initiative_id, p_year;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_ytd_total IS 'Calculate year-to-date total for a metric (e.g., revenue_booked)';

-- ============================================
-- 6. ROW LEVEL SECURITY FOR WEEKLY METRICS
-- ============================================

ALTER TABLE weekly_initiative_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'weekly_initiative_metrics' AND policyname = 'Users can view metrics in their functions'
  ) THEN
    CREATE POLICY "Users can view metrics in their functions" ON weekly_initiative_metrics
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM project_initiatives
          JOIN project_areas ON project_areas.id = project_initiatives.area_id
          JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
          WHERE project_initiatives.id = weekly_initiative_metrics.initiative_id
          AND project_function_access.user_id = auth.uid()
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
    SELECT 1 FROM pg_policies WHERE tablename = 'weekly_initiative_metrics' AND policyname = 'Users can create/update metrics'
  ) THEN
    CREATE POLICY "Users can create/update metrics" ON weekly_initiative_metrics
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM project_initiatives
          JOIN project_areas ON project_areas.id = project_initiatives.area_id
          JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
          WHERE project_initiatives.id = weekly_initiative_metrics.initiative_id
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
-- 7. TRIGGERS
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_weekly_initiative_metrics_updated_at') THEN
    CREATE TRIGGER update_weekly_initiative_metrics_updated_at BEFORE UPDATE ON weekly_initiative_metrics
      FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();
  END IF;
END $$;

-- ============================================
-- 8. SAMPLE DATA / MIGRATION NOTES
-- ============================================

-- Example of how to use new fields:
--
-- Annual Goal Example (Builder BU):
-- INSERT INTO project_annual_goals (function_id, year, title, description, weight, metric_type, target_value, current_value, unit)
-- VALUES (
--   'function-uuid',
--   2025,
--   'Total Builder Revenue',
--   'Achieve $30M in builder revenue',
--   50,
--   'revenue',
--   30000000,
--   18500000,
--   '$'
-- );
--
-- Weekly Metrics Example:
-- INSERT INTO weekly_initiative_metrics (initiative_id, week_ending, year, week_number, revenue_booked, accomplishments)
-- VALUES (
--   'initiative-uuid',
--   '2024-12-08'::DATE,
--   2024,
--   49,
--   550000,
--   'Signed Toll Brothers for 3 communities'
-- );
