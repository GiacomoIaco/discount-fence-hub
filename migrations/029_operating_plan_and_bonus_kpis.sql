-- Migration 029: Operating Plan and Bonus KPI System
-- Implements quarterly planning, scoring workflow, and bonus KPI management

-- ============================================
-- 1. Enhance existing tables
-- ============================================

-- Add strategic description to Areas
ALTER TABLE project_areas
ADD COLUMN IF NOT EXISTS strategic_description TEXT;

-- Add annual target to Initiatives
ALTER TABLE project_initiatives
ADD COLUMN IF NOT EXISTS annual_target TEXT;

-- ============================================
-- 2. Create quarterly objectives table
-- ============================================

CREATE TABLE IF NOT EXISTS initiative_quarterly_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  objective TEXT NOT NULL,

  -- Scoring (quarters of moons: 0, 0.25, 0.5, 0.75, 1.0)
  bu_score DECIMAL(3,2) CHECK (bu_score IS NULL OR bu_score IN (0, 0.25, 0.5, 0.75, 1.0)),
  ceo_score DECIMAL(3,2) CHECK (ceo_score IS NULL OR ceo_score IN (0, 0.25, 0.5, 0.75, 1.0)),

  -- Workflow state
  workflow_state TEXT DEFAULT 'draft' CHECK (workflow_state IN ('draft', 'bu_scoring', 'pending_ceo_review', 'ceo_approved')),

  -- Timestamps for workflow
  scored_at TIMESTAMP,
  approved_at TIMESTAMP,
  locked BOOLEAN DEFAULT FALSE,

  -- Standard timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(initiative_id, year, quarter)
);

-- ============================================
-- 3. Create bonus KPIs table
-- ============================================

CREATE TABLE IF NOT EXISTS bonus_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,

  -- KPI basics
  name TEXT NOT NULL, -- "Total BU Revenues"
  description TEXT,

  -- Target and current value
  target_value DECIMAL,
  target_text TEXT, -- For non-numeric targets like "Below 4%"
  current_value DECIMAL,
  unit TEXT CHECK (unit IN ('dollars', 'percent', 'score', 'count', 'text')),

  -- Incentive curve
  min_threshold DECIMAL,
  min_multiplier DECIMAL DEFAULT 0.5, -- 50%
  max_threshold DECIMAL,
  max_multiplier DECIMAL DEFAULT 2.0, -- 200%

  -- Display
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(function_id, year, name)
);

-- ============================================
-- 4. Create bonus KPI weights table
-- ============================================

CREATE TABLE IF NOT EXISTS bonus_kpi_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_kpi_id UUID NOT NULL REFERENCES bonus_kpis(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(bonus_kpi_id, user_id)
);

-- ============================================
-- 5. Create bonus calculations table (history)
-- ============================================

CREATE TABLE IF NOT EXISTS bonus_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  year INTEGER NOT NULL,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4), -- NULL = annual

  -- Results
  calculated_multiplier DECIMAL,
  calculation_details JSONB, -- Breakdown per KPI

  -- Timestamps
  calculated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(function_id, user_id, year, quarter)
);

-- ============================================
-- 6. Create indexes
-- ============================================

-- Quarterly objectives indexes
CREATE INDEX IF NOT EXISTS idx_quarterly_objectives_initiative ON initiative_quarterly_objectives(initiative_id);
CREATE INDEX IF NOT EXISTS idx_quarterly_objectives_year_quarter ON initiative_quarterly_objectives(year, quarter);
CREATE INDEX IF NOT EXISTS idx_quarterly_objectives_workflow ON initiative_quarterly_objectives(workflow_state);

-- Bonus KPIs indexes
CREATE INDEX IF NOT EXISTS idx_bonus_kpis_function ON bonus_kpis(function_id);
CREATE INDEX IF NOT EXISTS idx_bonus_kpis_year ON bonus_kpis(year);
CREATE INDEX IF NOT EXISTS idx_bonus_kpis_sort ON bonus_kpis(function_id, year, sort_order);

-- Bonus weights indexes
CREATE INDEX IF NOT EXISTS idx_bonus_weights_kpi ON bonus_kpi_weights(bonus_kpi_id);
CREATE INDEX IF NOT EXISTS idx_bonus_weights_user ON bonus_kpi_weights(user_id);

-- Bonus calculations indexes
CREATE INDEX IF NOT EXISTS idx_bonus_calcs_function_year ON bonus_calculations(function_id, year);
CREATE INDEX IF NOT EXISTS idx_bonus_calcs_user_year ON bonus_calculations(user_id, year);

-- ============================================
-- 7. Create update triggers
-- ============================================

-- Trigger for initiative_quarterly_objectives updated_at
CREATE OR REPLACE FUNCTION update_quarterly_objectives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quarterly_objectives_updated_at
  BEFORE UPDATE ON initiative_quarterly_objectives
  FOR EACH ROW
  EXECUTE FUNCTION update_quarterly_objectives_updated_at();

-- Trigger for bonus_kpis updated_at
CREATE OR REPLACE FUNCTION update_bonus_kpis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bonus_kpis_updated_at
  BEFORE UPDATE ON bonus_kpis
  FOR EACH ROW
  EXECUTE FUNCTION update_bonus_kpis_updated_at();

-- Trigger for bonus_kpi_weights updated_at
CREATE OR REPLACE FUNCTION update_bonus_weights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bonus_weights_updated_at
  BEFORE UPDATE ON bonus_kpi_weights
  FOR EACH ROW
  EXECUTE FUNCTION update_bonus_weights_updated_at();

-- ============================================
-- 8. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE initiative_quarterly_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_kpi_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for initiative_quarterly_objectives
-- Users can view objectives for initiatives in their functions
CREATE POLICY select_quarterly_objectives ON initiative_quarterly_objectives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_quarterly_objectives.initiative_id
    )
  );

-- Users can insert/update objectives for their functions
CREATE POLICY insert_quarterly_objectives ON initiative_quarterly_objectives
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_quarterly_objectives.initiative_id
    )
  );

CREATE POLICY update_quarterly_objectives ON initiative_quarterly_objectives
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      JOIN project_areas pa ON pi.area_id = pa.id
      JOIN project_functions pf ON pa.function_id = pf.id
      WHERE pi.id = initiative_quarterly_objectives.initiative_id
    )
  );

-- RLS Policies for bonus_kpis
CREATE POLICY select_bonus_kpis ON bonus_kpis
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_kpis.function_id
    )
  );

CREATE POLICY insert_bonus_kpis ON bonus_kpis
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_kpis.function_id
    )
  );

CREATE POLICY update_bonus_kpis ON bonus_kpis
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_kpis.function_id
    )
  );

CREATE POLICY delete_bonus_kpis ON bonus_kpis
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_kpis.function_id
    )
  );

-- RLS Policies for bonus_kpi_weights
CREATE POLICY select_bonus_weights ON bonus_kpi_weights
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bonus_kpis bk
      JOIN project_functions pf ON bk.function_id = pf.id
      WHERE bk.id = bonus_kpi_weights.bonus_kpi_id
    )
  );

CREATE POLICY insert_bonus_weights ON bonus_kpi_weights
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bonus_kpis bk
      JOIN project_functions pf ON bk.function_id = pf.id
      WHERE bk.id = bonus_kpi_weights.bonus_kpi_id
    )
  );

CREATE POLICY update_bonus_weights ON bonus_kpi_weights
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bonus_kpis bk
      JOIN project_functions pf ON bk.function_id = pf.id
      WHERE bk.id = bonus_kpi_weights.bonus_kpi_id
    )
  );

CREATE POLICY delete_bonus_weights ON bonus_kpi_weights
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bonus_kpis bk
      JOIN project_functions pf ON bk.function_id = pf.id
      WHERE bk.id = bonus_kpi_weights.bonus_kpi_id
    )
  );

-- RLS Policies for bonus_calculations
CREATE POLICY select_bonus_calculations ON bonus_calculations
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_calculations.function_id
    )
  );

CREATE POLICY insert_bonus_calculations ON bonus_calculations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = bonus_calculations.function_id
    )
  );
