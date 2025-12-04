-- Migration: Calculator Enhancements
-- Adds: yards table, project workflow fields, user tracking, adjustment tracking

-- ============================================
-- YARDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS yards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'ATX', 'SA', 'HOU'
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed yards data
INSERT INTO yards (code, name, city, is_active) VALUES
  ('ATX', 'Austin Yard', 'Austin', true),
  ('SA', 'San Antonio Yard', 'San Antonio', true),
  ('HOU', 'Houston Yard', 'Houston', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================
-- BOM PROJECTS ENHANCEMENTS
-- ============================================

-- Add new columns to bom_projects
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS yard_id UUID REFERENCES yards(id),
ADD COLUMN IF NOT EXISTS expected_pickup_date DATE,
ADD COLUMN IF NOT EXISTS crew_name TEXT,
ADD COLUMN IF NOT EXISTS updated_by UUID,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS submitted_by UUID,
ADD COLUMN IF NOT EXISTS sent_to_yard_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_to_yard_by UUID,
ADD COLUMN IF NOT EXISTS staged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS staged_by UUID,
ADD COLUMN IF NOT EXISTS loaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS loaded_by UUID,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS service_titan_job_id TEXT,
ADD COLUMN IF NOT EXISTS external_reference TEXT,
ADD COLUMN IF NOT EXISTS total_calculated_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_adjustment_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS adjustment_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS adjustment_approved_by UUID,
ADD COLUMN IF NOT EXISTS adjustment_approved_at TIMESTAMPTZ;

-- Update status check constraint to include new statuses
ALTER TABLE bom_projects DROP CONSTRAINT IF EXISTS bom_projects_status_check;
ALTER TABLE bom_projects ADD CONSTRAINT bom_projects_status_check
  CHECK (status IN ('draft', 'ready', 'sent_to_yard', 'staged', 'loaded', 'completed', 'cancelled', 'archived'));

-- Comments
COMMENT ON COLUMN bom_projects.yard_id IS 'Which yard will stage the materials';
COMMENT ON COLUMN bom_projects.expected_pickup_date IS 'When crew is expected to pick up materials';
COMMENT ON COLUMN bom_projects.total_calculated_cost IS 'Total cost before adjustments';
COMMENT ON COLUMN bom_projects.total_adjustment_amount IS 'Sum of all material and labor adjustments';
COMMENT ON COLUMN bom_projects.adjustment_flagged IS 'True if adjustments exceed threshold';

-- ============================================
-- PROJECT MATERIALS ENHANCEMENTS
-- ============================================

ALTER TABLE project_materials
ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_extended_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS adjusted_extended_cost DECIMAL(10,2);

COMMENT ON COLUMN project_materials.adjustment_amount IS 'Quantity adjustment (+ or -)';
COMMENT ON COLUMN project_materials.calculated_extended_cost IS 'Cost before adjustment';
COMMENT ON COLUMN project_materials.adjusted_extended_cost IS 'Cost after adjustment';

-- ============================================
-- PROJECT LABOR ENHANCEMENTS
-- ============================================

ALTER TABLE project_labor
ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_extended_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS adjusted_extended_cost DECIMAL(10,2);

COMMENT ON COLUMN project_labor.adjustment_amount IS 'Dollar adjustment to labor cost (+ or -)';
COMMENT ON COLUMN project_labor.calculated_extended_cost IS 'Cost before adjustment';
COMMENT ON COLUMN project_labor.adjusted_extended_cost IS 'Cost after adjustment';

-- ============================================
-- BOM SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS bom_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO bom_settings (setting_key, setting_value, description) VALUES
  ('adjustment_thresholds', '{"flag_percent": 5, "flag_amount": 500, "approval_percent": 10, "approval_amount": 1000}', 'Thresholds for flagging and requiring approval on adjustments'),
  ('default_buffer', '{"feet": 5}', 'Default material buffer in feet'),
  ('default_concrete_type', '{"type": "3-part"}', 'Default concrete type for new projects')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_yards_active ON yards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bom_projects_yard ON bom_projects(yard_id);
CREATE INDEX IF NOT EXISTS idx_bom_projects_pickup_date ON bom_projects(expected_pickup_date);
CREATE INDEX IF NOT EXISTS idx_bom_projects_flagged ON bom_projects(adjustment_flagged) WHERE adjustment_flagged = true;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE yards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_settings ENABLE ROW LEVEL SECURITY;

-- Yards: Anyone can view
CREATE POLICY "Anyone can view yards"
  ON yards FOR SELECT
  TO authenticated
  USING (true);

-- BOM Settings: Anyone can view, admins can modify
CREATE POLICY "Anyone can view bom_settings"
  ON bom_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can modify bom_settings"
  ON bom_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_yards_updated_at BEFORE UPDATE ON yards
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

CREATE TRIGGER update_bom_settings_updated_at BEFORE UPDATE ON bom_settings
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();
