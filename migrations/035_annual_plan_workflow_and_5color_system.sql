-- Migration 035: Annual Plan Workflow and 5-Color Assessment System
-- Adds workflow states and 5-color scoring to annual actions and targets
-- Updates quarterly objectives to use 5-color system

-- ============================================
-- 1. Update Assessment Type to 5-Color Scale
-- ============================================

-- New 5-color scale:
-- 'red' = Poor performance / Not achieved
-- 'dark_yellow' = Below expectations
-- 'light_yellow' = Met expectations
-- 'light_green' = Good performance / Exceeded expectations
-- 'dark_green' = Excellent performance / Significantly exceeded

-- ============================================
-- 2. Add Workflow and Scoring to Annual Actions
-- ============================================

ALTER TABLE initiative_annual_actions
ADD COLUMN IF NOT EXISTS workflow_state TEXT DEFAULT 'draft'
  CHECK (workflow_state IN ('draft', 'locked', 'bu_scoring', 'pending_ceo_review', 'approved')),
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bu_assessment TEXT
  CHECK (bu_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green')),
ADD COLUMN IF NOT EXISTS ceo_assessment TEXT
  CHECK (ceo_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green')),
ADD COLUMN IF NOT EXISTS bu_score INTEGER CHECK (bu_score >= 0 AND bu_score <= 100),
ADD COLUMN IF NOT EXISTS ceo_score INTEGER CHECK (ceo_score >= 0 AND ceo_score <= 100),
ADD COLUMN IF NOT EXISTS bu_comments TEXT,
ADD COLUMN IF NOT EXISTS ceo_comments TEXT,
ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update existing 3-color assessments to 5-color (if any exist)
UPDATE initiative_annual_actions
SET assessment = CASE
  WHEN assessment = 'green' THEN 'dark_green'
  WHEN assessment = 'yellow' THEN 'light_yellow'
  WHEN assessment = 'red' THEN 'red'
  ELSE assessment
END
WHERE assessment IS NOT NULL;

-- Update constraint for assessment column to support 5 colors
ALTER TABLE initiative_annual_actions
DROP CONSTRAINT IF EXISTS initiative_annual_actions_assessment_check;

ALTER TABLE initiative_annual_actions
ADD CONSTRAINT initiative_annual_actions_assessment_check
  CHECK (assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green'));

COMMENT ON COLUMN initiative_annual_actions.workflow_state IS 'Workflow state: draft → locked → bu_scoring → pending_ceo_review → approved';
COMMENT ON COLUMN initiative_annual_actions.bu_assessment IS 'BU Manager color assessment (5-color scale)';
COMMENT ON COLUMN initiative_annual_actions.ceo_assessment IS 'CEO color assessment (5-color scale)';
COMMENT ON COLUMN initiative_annual_actions.assessment IS 'Legacy assessment field - use bu_assessment/ceo_assessment instead';

-- ============================================
-- 3. Add Workflow and Scoring to Annual Targets
-- ============================================

ALTER TABLE initiative_annual_targets
ADD COLUMN IF NOT EXISTS workflow_state TEXT DEFAULT 'draft'
  CHECK (workflow_state IN ('draft', 'locked', 'bu_scoring', 'pending_ceo_review', 'approved')),
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bu_assessment TEXT
  CHECK (bu_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green')),
ADD COLUMN IF NOT EXISTS ceo_assessment TEXT
  CHECK (ceo_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green')),
ADD COLUMN IF NOT EXISTS bu_score INTEGER CHECK (bu_score >= 0 AND bu_score <= 100),
ADD COLUMN IF NOT EXISTS ceo_score INTEGER CHECK (ceo_score >= 0 AND ceo_score <= 100),
ADD COLUMN IF NOT EXISTS bu_comments TEXT,
ADD COLUMN IF NOT EXISTS ceo_comments TEXT,
ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update existing 3-color assessments to 5-color (if any exist)
UPDATE initiative_annual_targets
SET assessment = CASE
  WHEN assessment = 'green' THEN 'dark_green'
  WHEN assessment = 'yellow' THEN 'light_yellow'
  WHEN assessment = 'red' THEN 'red'
  ELSE assessment
END
WHERE assessment IS NOT NULL;

-- Update constraint for assessment column to support 5 colors
ALTER TABLE initiative_annual_targets
DROP CONSTRAINT IF EXISTS initiative_annual_targets_assessment_check;

ALTER TABLE initiative_annual_targets
ADD CONSTRAINT initiative_annual_targets_assessment_check
  CHECK (assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green'));

COMMENT ON COLUMN initiative_annual_targets.workflow_state IS 'Workflow state: draft → locked → bu_scoring → pending_ceo_review → approved';
COMMENT ON COLUMN initiative_annual_targets.bu_assessment IS 'BU Manager color assessment (5-color scale)';
COMMENT ON COLUMN initiative_annual_targets.ceo_assessment IS 'CEO color assessment (5-color scale)';
COMMENT ON COLUMN initiative_annual_targets.assessment IS 'Legacy assessment field - use bu_assessment/ceo_assessment instead';

-- ============================================
-- 4. Update Quarterly Objectives to 5-Color Scale
-- ============================================

-- Update existing 3-color assessments to 5-color (if any exist)
UPDATE initiative_quarterly_objectives
SET bu_assessment = CASE
  WHEN bu_assessment = 'green' THEN 'dark_green'
  WHEN bu_assessment = 'yellow' THEN 'light_yellow'
  WHEN bu_assessment = 'red' THEN 'red'
  ELSE bu_assessment
END
WHERE bu_assessment IS NOT NULL;

UPDATE initiative_quarterly_objectives
SET ceo_assessment = CASE
  WHEN ceo_assessment = 'green' THEN 'dark_green'
  WHEN ceo_assessment = 'yellow' THEN 'light_yellow'
  WHEN ceo_assessment = 'red' THEN 'red'
  ELSE ceo_assessment
END
WHERE ceo_assessment IS NOT NULL;

-- Update constraints for 5-color system
ALTER TABLE initiative_quarterly_objectives
DROP CONSTRAINT IF EXISTS initiative_quarterly_objectives_bu_assessment_check;

ALTER TABLE initiative_quarterly_objectives
DROP CONSTRAINT IF EXISTS initiative_quarterly_objectives_ceo_assessment_check;

ALTER TABLE initiative_quarterly_objectives
ADD CONSTRAINT initiative_quarterly_objectives_bu_assessment_check
  CHECK (bu_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green'));

ALTER TABLE initiative_quarterly_objectives
ADD CONSTRAINT initiative_quarterly_objectives_ceo_assessment_check
  CHECK (ceo_assessment IN ('red', 'dark_yellow', 'light_yellow', 'light_green', 'dark_green'));

COMMENT ON COLUMN initiative_quarterly_objectives.bu_assessment IS 'BU Manager color assessment: red=poor, dark_yellow=below, light_yellow=met, light_green=good, dark_green=excellent';
COMMENT ON COLUMN initiative_quarterly_objectives.ceo_assessment IS 'CEO color assessment: red=poor, dark_yellow=below, light_yellow=met, light_green=good, dark_green=excellent';

-- ============================================
-- 5. Create indexes for workflow queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_annual_actions_workflow
  ON initiative_annual_actions(workflow_state) WHERE workflow_state != 'approved';

CREATE INDEX IF NOT EXISTS idx_annual_targets_workflow
  ON initiative_annual_targets(workflow_state) WHERE workflow_state != 'approved';

CREATE INDEX IF NOT EXISTS idx_annual_actions_scoring
  ON initiative_annual_actions(workflow_state, locked)
  WHERE workflow_state IN ('bu_scoring', 'pending_ceo_review');

CREATE INDEX IF NOT EXISTS idx_annual_targets_scoring
  ON initiative_annual_targets(workflow_state, locked)
  WHERE workflow_state IN ('bu_scoring', 'pending_ceo_review');
