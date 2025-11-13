-- Migration 031: Yearly Planning System
-- Implements year-specific planning with actions, targets, and initiative tracking
-- Areas and Initiatives become evergreen with is_active flags

-- ============================================
-- 1. Add is_active tracking to Areas and Initiatives
-- ============================================

ALTER TABLE project_areas
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

COMMENT ON COLUMN project_areas.is_active IS 'Whether this area is currently active (for historical tracking)';
COMMENT ON COLUMN project_areas.deactivated_at IS 'When this area was deactivated';
COMMENT ON COLUMN project_initiatives.is_active IS 'Whether this initiative is currently active (for historical tracking)';
COMMENT ON COLUMN project_initiatives.deactivated_at IS 'When this initiative was deactivated';

-- Create indexes for active filtering
CREATE INDEX IF NOT EXISTS idx_project_areas_active ON project_areas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_initiatives_active ON project_initiatives(is_active) WHERE is_active = true;

-- ============================================
-- 2. Create initiative_annual_actions table
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_annual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,

  -- Action description (can be short phrase or long paragraph)
  action_text TEXT NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),

  -- End of year assessment
  assessment TEXT CHECK (assessment IN ('green', 'yellow', 'red')),

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure actions are unique per initiative/year
  UNIQUE(initiative_id, year, action_text)
);

CREATE INDEX IF NOT EXISTS idx_annual_actions_initiative ON initiative_annual_actions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_annual_actions_year ON initiative_annual_actions(year);
CREATE INDEX IF NOT EXISTS idx_annual_actions_sort ON initiative_annual_actions(initiative_id, year, sort_order);

COMMENT ON TABLE initiative_annual_actions IS 'Year-specific actions/objectives for each initiative in the Annual Plan';
COMMENT ON COLUMN initiative_annual_actions.action_text IS 'Description of what needs to be accomplished (can be brief or detailed)';
COMMENT ON COLUMN initiative_annual_actions.assessment IS 'End of year assessment: green=achieved, yellow=partial, red=not achieved';

-- ============================================
-- 3. Create initiative_annual_targets table
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_annual_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,

  -- Target details
  metric_name TEXT NOT NULL,
  target_value TEXT, -- Can be numeric or text (e.g., "15% reduction", "$2M revenue")
  actual_value TEXT,
  unit TEXT, -- e.g., "dollars", "percent", "units"

  -- End of year assessment
  assessment TEXT CHECK (assessment IN ('green', 'yellow', 'red')),

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(initiative_id, year, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_annual_targets_initiative ON initiative_annual_targets(initiative_id);
CREATE INDEX IF NOT EXISTS idx_annual_targets_year ON initiative_annual_targets(year);
CREATE INDEX IF NOT EXISTS idx_annual_targets_sort ON initiative_annual_targets(initiative_id, year, sort_order);

COMMENT ON TABLE initiative_annual_targets IS 'Year-specific KPI targets for each initiative in the Annual Plan';
COMMENT ON COLUMN initiative_annual_targets.metric_name IS 'Name of the KPI or target being tracked';
COMMENT ON COLUMN initiative_annual_targets.assessment IS 'End of year assessment: green=achieved, yellow=partial, red=not achieved';

-- ============================================
-- 4. Create initiative_updates table for timeline
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,

  -- Update content
  update_text TEXT NOT NULL,

  -- Week tracking (start of week)
  week_start_date DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_initiative_updates_initiative ON initiative_updates(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_updates_week ON initiative_updates(week_start_date);
CREATE INDEX IF NOT EXISTS idx_initiative_updates_created ON initiative_updates(created_at DESC);

COMMENT ON TABLE initiative_updates IS 'Weekly timeline updates for initiatives in the Initiative tab';
COMMENT ON COLUMN initiative_updates.week_start_date IS 'Monday of the week this update applies to';

-- ============================================
-- 5. Update quarterly objectives table
-- ============================================

-- Rename the objective column to be clearer
ALTER TABLE initiative_quarterly_objectives
RENAME COLUMN objective TO objective_text;

-- Add color assessment columns (will replace moon scoring in UI)
ALTER TABLE initiative_quarterly_objectives
ADD COLUMN IF NOT EXISTS bu_assessment TEXT CHECK (bu_assessment IN ('green', 'yellow', 'red')),
ADD COLUMN IF NOT EXISTS ceo_assessment TEXT CHECK (ceo_assessment IN ('green', 'yellow', 'red'));

COMMENT ON COLUMN initiative_quarterly_objectives.objective_text IS 'Description of what needs to be accomplished this quarter (can be brief or detailed)';
COMMENT ON COLUMN initiative_quarterly_objectives.bu_assessment IS 'BU color assessment: green=achieved, yellow=partial, red=not achieved';
COMMENT ON COLUMN initiative_quarterly_objectives.ceo_assessment IS 'CEO color assessment: green=achieved, yellow=partial, red=not achieved';

-- Note: We keep bu_score and ceo_score for backward compatibility, but will use assessments in UI

-- ============================================
-- 6. Migrate existing data
-- ============================================

-- Migrate description to annual actions for current year (2025)
-- Only if description is not null or empty
INSERT INTO initiative_annual_actions (initiative_id, year, action_text, sort_order, created_at)
SELECT
  id,
  2025,
  description,
  0,
  NOW()
FROM project_initiatives
WHERE description IS NOT NULL
  AND description != ''
ON CONFLICT (initiative_id, year, action_text) DO NOTHING;

-- Migrate annual_target to annual targets for current year (2025)
-- Only if annual_target is not null or empty
INSERT INTO initiative_annual_targets (initiative_id, year, metric_name, target_value, sort_order, created_at)
SELECT
  id,
  2025,
  'Annual Target', -- Generic name since we don't have specific metric names
  annual_target,
  0,
  NOW()
FROM project_initiatives
WHERE annual_target IS NOT NULL
  AND annual_target != ''
ON CONFLICT (initiative_id, year, metric_name) DO NOTHING;

-- Note: We keep the original description and annual_target columns for now
-- They can be hidden in the UI or removed in a future migration after verification

-- ============================================
-- 7. Create update triggers
-- ============================================

CREATE OR REPLACE FUNCTION update_initiative_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_initiative_actions_updated_at
  BEFORE UPDATE ON initiative_annual_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_actions_updated_at();

CREATE OR REPLACE FUNCTION update_initiative_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_initiative_targets_updated_at
  BEFORE UPDATE ON initiative_annual_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_targets_updated_at();

CREATE OR REPLACE FUNCTION update_initiative_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_initiative_updates_updated_at
  BEFORE UPDATE ON initiative_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_updates_updated_at();

-- ============================================
-- 8. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE initiative_annual_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_annual_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for initiative_annual_actions
CREATE POLICY select_annual_actions ON initiative_annual_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_actions.initiative_id
    )
  );

CREATE POLICY insert_annual_actions ON initiative_annual_actions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_actions.initiative_id
    )
  );

CREATE POLICY update_annual_actions ON initiative_annual_actions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_actions.initiative_id
    )
  );

CREATE POLICY delete_annual_actions ON initiative_annual_actions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_actions.initiative_id
    )
  );

-- RLS Policies for initiative_annual_targets (same pattern)
CREATE POLICY select_annual_targets ON initiative_annual_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_targets.initiative_id
    )
  );

CREATE POLICY insert_annual_targets ON initiative_annual_targets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_targets.initiative_id
    )
  );

CREATE POLICY update_annual_targets ON initiative_annual_targets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_targets.initiative_id
    )
  );

CREATE POLICY delete_annual_targets ON initiative_annual_targets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_annual_targets.initiative_id
    )
  );

-- RLS Policies for initiative_updates (same pattern)
CREATE POLICY select_initiative_updates ON initiative_updates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_updates.initiative_id
    )
  );

CREATE POLICY insert_initiative_updates ON initiative_updates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_updates.initiative_id
    )
  );

CREATE POLICY update_initiative_updates ON initiative_updates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_updates.initiative_id
    )
  );

CREATE POLICY delete_initiative_updates ON initiative_updates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_updates.initiative_id
    )
  );

-- ============================================
-- 9. Helper function for area deactivation
-- ============================================

-- Function to check if an area can be deactivated
-- (only if all initiatives are inactive)
CREATE OR REPLACE FUNCTION can_deactivate_area(p_area_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_active_count
  FROM project_initiatives
  WHERE area_id = p_area_id
    AND is_active = true;

  RETURN v_active_count = 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION can_deactivate_area IS 'Check if an area can be deactivated (only if all initiatives are inactive)';
