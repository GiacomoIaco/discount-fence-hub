-- Migration: 182_crew_subcontractor_support.sql
-- Description: Add subcontractor support to crews table for S-006
-- Date: 2024-12-17

-- ============================================
-- 1. Add subcontractor fields to crews table
-- ============================================

ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS is_subcontractor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS lead_phone text;

-- Add comment for documentation
COMMENT ON COLUMN crews.is_subcontractor IS 'True for subcontractor crews (external), false for internal crews';
COMMENT ON COLUMN crews.lead_name IS 'Lead contact name for subcontractors (no user account required)';
COMMENT ON COLUMN crews.lead_phone IS 'Lead contact phone for subcontractors';

-- ============================================
-- 2. Add assigned_qbo_class_ids to fsm_team_profiles
-- ============================================

ALTER TABLE fsm_team_profiles
  ADD COLUMN IF NOT EXISTS assigned_qbo_class_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN fsm_team_profiles.assigned_qbo_class_ids IS 'QBO Classes (BUs) this team member is assigned to handle';

-- ============================================
-- 3. Create rep_crew_alignments table
-- ============================================

CREATE TABLE IF NOT EXISTS rep_crew_alignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  skill_categories text[] DEFAULT '{}',  -- Which skills this crew handles for this rep (empty = all)
  priority smallint DEFAULT 1,           -- 1 = primary, 2 = backup
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rep_user_id, crew_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rep_crew_alignments_rep
  ON rep_crew_alignments(rep_user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_rep_crew_alignments_crew
  ON rep_crew_alignments(crew_id) WHERE is_active;

COMMENT ON TABLE rep_crew_alignments IS 'Maps reps to their aligned/preferred crews for assignment suggestions';

-- ============================================
-- 4. Add company_name to clients table
-- ============================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN clients.company_name IS 'Company name for business clients. If set, primary contact becomes the contact person for the company.';

-- ============================================
-- 5. community_crew_preferences updates (SKIPPED - table may not exist)
-- ============================================
-- These updates will be handled in a future migration if needed

-- ============================================
-- 6. crew_assignment_summary view (SKIPPED - will add later when needed)
-- ============================================
-- This view can be added once all base tables are confirmed to exist

-- ============================================
-- 7. Enable RLS on new tables
-- ============================================

ALTER TABLE rep_crew_alignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for rep_crew_alignments
CREATE POLICY "Users can view rep_crew_alignments"
  ON rep_crew_alignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage rep_crew_alignments"
  ON rep_crew_alignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 8. Update triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rep_crew_alignments_updated_at ON rep_crew_alignments;
CREATE TRIGGER update_rep_crew_alignments_updated_at
  BEFORE UPDATE ON rep_crew_alignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. Ensure crew_id exists on fsm_team_profiles (may be missing)
-- ============================================

ALTER TABLE fsm_team_profiles
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL;

-- ============================================
-- 10. Update fsm_team_full view to include assigned_qbo_class_ids
-- ============================================

DROP VIEW IF EXISTS fsm_team_full;
CREATE VIEW fsm_team_full
WITH (security_invoker = on) AS
SELECT
  up.id AS user_id,
  up.email,
  COALESCE(up.full_name, up.email) AS name,
  fp.id AS profile_id,
  fp.fsm_roles,
  fp.business_unit_ids,
  fp.max_daily_assessments,
  fp.crew_id,
  c.name AS crew_name,
  fp.is_active,
  fp.assigned_qbo_class_ids,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'territory_id', tc.territory_id,
      'territory_name', t.name,
      'coverage_days', tc.coverage_days,
      'is_primary', tc.is_primary
    ))
    FROM fsm_territory_coverage tc
    JOIN territories t ON t.id = tc.territory_id
    WHERE tc.user_id = up.id AND tc.is_active = true),
    '[]'::json
  ) AS territories,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'project_type_id', ps.project_type_id,
      'project_type_name', pt.name,
      'proficiency', ps.proficiency,
      'duration_multiplier', ps.duration_multiplier
    ))
    FROM fsm_person_skills ps
    JOIN project_types pt ON pt.id = ps.project_type_id
    WHERE ps.user_id = up.id),
    '[]'::json
  ) AS skills,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'day', ws.day_of_week,
      'start', ws.start_time,
      'end', ws.end_time
    ) ORDER BY CASE ws.day_of_week
      WHEN 'mon' THEN 1 WHEN 'tue' THEN 2 WHEN 'wed' THEN 3
      WHEN 'thu' THEN 4 WHEN 'fri' THEN 5 WHEN 'sat' THEN 6 ELSE 7
    END)
    FROM fsm_work_schedules ws
    WHERE ws.user_id = up.id),
    '[]'::json
  ) AS work_schedule
FROM user_profiles up
JOIN fsm_team_profiles fp ON fp.user_id = up.id
LEFT JOIN crews c ON c.id = fp.crew_id;

COMMENT ON VIEW fsm_team_full IS 'Full team member view with aggregated territories, skills, and work schedule';
