-- Migration 172: FSM Team Profiles (Person-Centric Model)
-- Replaces entity-centric model with person-centric assignments
-- Key insight: People have roles, BUs, territories, skills - not the other way around
-- Depends on: 144_fsm_core_tables.sql, 171_assignment_and_skills_tables.sql

-- ============================================
-- 1. PROJECT TYPES (Reference Table)
-- Defines fence types/skills that exist per BU
-- ============================================
CREATE TABLE IF NOT EXISTS project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- 'Wood Vertical', 'Iron', 'Chain Link'
  code TEXT NOT NULL,              -- 'WV', 'IR', 'CL'
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(code, business_unit_id)   -- Code unique per BU
);

CREATE INDEX idx_project_types_bu ON project_types(business_unit_id);
CREATE INDEX idx_project_types_active ON project_types(is_active);

COMMENT ON TABLE project_types IS 'Fence/project types per business unit - these become assignable skills';

-- ============================================
-- 2. FSM TEAM PROFILES
-- Extends Team Management users with FSM-specific attributes
-- ============================================
CREATE TABLE IF NOT EXISTS fsm_team_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Multiple FSM roles (same person can be Rep AND PM)
  fsm_roles TEXT[] DEFAULT '{}' CHECK (
    fsm_roles <@ ARRAY['rep', 'project_manager', 'crew_lead', 'dispatcher', 'manager']::TEXT[]
  ),

  -- Multiple BU assignments
  business_unit_ids UUID[] DEFAULT '{}',

  -- Capacity settings (for rep role)
  max_daily_assessments INT DEFAULT 4,

  -- Crew linkage (for crew_lead role)
  crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fsm_profiles_user ON fsm_team_profiles(user_id);
CREATE INDEX idx_fsm_profiles_roles ON fsm_team_profiles USING GIN(fsm_roles);
CREATE INDEX idx_fsm_profiles_bus ON fsm_team_profiles USING GIN(business_unit_ids);
CREATE INDEX idx_fsm_profiles_crew ON fsm_team_profiles(crew_id);
CREATE INDEX idx_fsm_profiles_active ON fsm_team_profiles(is_active);

COMMENT ON TABLE fsm_team_profiles IS 'FSM-specific attributes for team members - roles, BUs, capacity';

-- ============================================
-- 3. FSM TERRITORY COVERAGE
-- Which territories a person covers, with optional day restrictions
-- ============================================
CREATE TABLE IF NOT EXISTS fsm_territory_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,

  -- Which days this person covers this territory
  -- NULL or empty = all days; otherwise specific days only
  coverage_days TEXT[] DEFAULT NULL CHECK (
    coverage_days IS NULL OR
    coverage_days <@ ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::TEXT[]
  ),

  -- Is this their primary territory for this coverage?
  is_primary BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, territory_id)
);

CREATE INDEX idx_fsm_coverage_user ON fsm_territory_coverage(user_id);
CREATE INDEX idx_fsm_coverage_territory ON fsm_territory_coverage(territory_id);
CREATE INDEX idx_fsm_coverage_active ON fsm_territory_coverage(is_active);

COMMENT ON TABLE fsm_territory_coverage IS 'Territory assignments per person with optional day-of-week restrictions';

-- ============================================
-- 4. FSM WORK SCHEDULES
-- Working hours per person per day of week
-- ============================================
CREATE TABLE IF NOT EXISTS fsm_work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  day_of_week TEXT NOT NULL CHECK (day_of_week IN (
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  )),

  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, day_of_week),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_fsm_schedules_user ON fsm_work_schedules(user_id);

COMMENT ON TABLE fsm_work_schedules IS 'Working hours per person - e.g., Mon-Thu 8am-6pm, Fri 9am-12pm';

-- ============================================
-- 5. FSM PERSON SKILLS
-- Skills/certifications per person (replaces crew_skills + sales_rep_skills)
-- ============================================
CREATE TABLE IF NOT EXISTS fsm_person_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type_id UUID NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,

  -- Proficiency level
  proficiency TEXT NOT NULL DEFAULT 'standard' CHECK (proficiency IN (
    'trainee',   -- Learning, needs supervision (1.3x duration)
    'basic',     -- Can do simple jobs (1.15x duration)
    'standard',  -- Fully capable (1.0x duration)
    'expert'     -- Go-to person, trains others (0.85x duration)
  )),

  -- Duration multiplier (auto-calculated from proficiency, can override)
  duration_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,

  -- Certification tracking
  certified_at DATE,
  certification_expires DATE,
  certified_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, project_type_id)
);

CREATE INDEX idx_fsm_skills_user ON fsm_person_skills(user_id);
CREATE INDEX idx_fsm_skills_project_type ON fsm_person_skills(project_type_id);
CREATE INDEX idx_fsm_skills_proficiency ON fsm_person_skills(proficiency);

-- Auto-set duration multiplier based on proficiency
CREATE OR REPLACE FUNCTION set_person_skill_duration_multiplier()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.proficiency != NEW.proficiency) THEN
    NEW.duration_multiplier := CASE NEW.proficiency
      WHEN 'trainee' THEN 1.30
      WHEN 'basic' THEN 1.15
      WHEN 'standard' THEN 1.00
      WHEN 'expert' THEN 0.85
      ELSE 1.00
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_person_skill_duration ON fsm_person_skills;
CREATE TRIGGER trigger_set_person_skill_duration
  BEFORE INSERT OR UPDATE ON fsm_person_skills
  FOR EACH ROW EXECUTE FUNCTION set_person_skill_duration_multiplier();

COMMENT ON TABLE fsm_person_skills IS 'Skills per person with proficiency levels affecting job duration';

-- ============================================
-- 6. EXTEND CREWS TABLE
-- Add crew type and lead linkage
-- ============================================
DO $$
BEGIN
  -- Add crew_type if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crews' AND column_name = 'crew_type'
  ) THEN
    ALTER TABLE crews ADD COLUMN crew_type TEXT DEFAULT 'standard'
      CHECK (crew_type IN ('standard', 'internal', 'small_jobs'));
  END IF;

  -- Add lead_user_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crews' AND column_name = 'lead_user_id'
  ) THEN
    ALTER TABLE crews ADD COLUMN lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crews_lead ON crews(lead_user_id);
CREATE INDEX IF NOT EXISTS idx_crews_type ON crews(crew_type);

-- ============================================
-- 7. EXTEND JOBS TABLE
-- Add project manager assignment
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'project_manager_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN project_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_pm ON jobs(project_manager_id);

-- ============================================
-- 8. ADD BUILDER PREFERENCES TO COMMUNITIES
-- Assigned rep and preferred crew live on the customer
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'assigned_rep_id'
  ) THEN
    ALTER TABLE communities ADD COLUMN assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'preferred_crew_id'
  ) THEN
    ALTER TABLE communities ADD COLUMN preferred_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_communities_assigned_rep ON communities(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_communities_preferred_crew ON communities(preferred_crew_id);

-- ============================================
-- 9. ADD BUILDER PREFERENCES TO CLIENTS
-- For non-community builders
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'assigned_rep_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'preferred_crew_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN preferred_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_rep ON clients(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_clients_preferred_crew ON clients(preferred_crew_id);

-- ============================================
-- 10. HELPER VIEWS
-- ============================================

-- View: Team members with full FSM profile
CREATE OR REPLACE VIEW fsm_team_full AS
SELECT
  u.id AS user_id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS name,
  fp.id AS profile_id,
  fp.fsm_roles,
  fp.business_unit_ids,
  fp.max_daily_assessments,
  fp.crew_id,
  c.name AS crew_name,
  fp.is_active,
  -- Aggregate territories
  COALESCE(
    (SELECT json_agg(json_build_object(
      'territory_id', tc.territory_id,
      'territory_name', t.name,
      'coverage_days', tc.coverage_days,
      'is_primary', tc.is_primary
    ))
    FROM fsm_territory_coverage tc
    JOIN territories t ON t.id = tc.territory_id
    WHERE tc.user_id = u.id AND tc.is_active = true),
    '[]'::json
  ) AS territories,
  -- Aggregate skills
  COALESCE(
    (SELECT json_agg(json_build_object(
      'project_type_id', ps.project_type_id,
      'project_type_name', pt.name,
      'proficiency', ps.proficiency,
      'duration_multiplier', ps.duration_multiplier
    ))
    FROM fsm_person_skills ps
    JOIN project_types pt ON pt.id = ps.project_type_id
    WHERE ps.user_id = u.id),
    '[]'::json
  ) AS skills,
  -- Aggregate work schedule
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
    WHERE ws.user_id = u.id),
    '[]'::json
  ) AS work_schedule
FROM auth.users u
LEFT JOIN fsm_team_profiles fp ON fp.user_id = u.id
LEFT JOIN crews c ON c.id = fp.crew_id
WHERE fp.id IS NOT NULL;

COMMENT ON VIEW fsm_team_full IS 'Complete FSM team member view with territories, skills, and schedule';

-- View: Available reps for a territory on a given day
CREATE OR REPLACE VIEW available_reps_by_territory AS
SELECT
  u.id AS user_id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS name,
  fp.max_daily_assessments,
  tc.territory_id,
  t.name AS territory_name,
  tc.coverage_days
FROM auth.users u
JOIN fsm_team_profiles fp ON fp.user_id = u.id
JOIN fsm_territory_coverage tc ON tc.user_id = u.id
JOIN territories t ON t.id = tc.territory_id
WHERE
  fp.is_active = true
  AND tc.is_active = true
  AND 'rep' = ANY(fp.fsm_roles);

COMMENT ON VIEW available_reps_by_territory IS 'Reps available per territory with coverage days';

-- View: Crews with lead info
CREATE OR REPLACE VIEW crews_with_leads AS
SELECT
  c.*,
  u.email AS lead_email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) AS lead_name,
  t.name AS home_territory_name,
  bu.name AS business_unit_name
FROM crews c
LEFT JOIN auth.users u ON u.id = c.lead_user_id
LEFT JOIN territories t ON t.id = c.home_territory_id
LEFT JOIN business_units bu ON bu.id = c.business_unit_id
WHERE c.is_active = true;

COMMENT ON VIEW crews_with_leads IS 'Crews with lead user and location details';

-- ============================================
-- 11. RLS POLICIES
-- ============================================
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_territory_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fsm_person_skills ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read)
CREATE POLICY "project_types_read" ON project_types FOR SELECT USING (true);
CREATE POLICY "fsm_team_profiles_read" ON fsm_team_profiles FOR SELECT USING (true);
CREATE POLICY "fsm_territory_coverage_read" ON fsm_territory_coverage FOR SELECT USING (true);
CREATE POLICY "fsm_work_schedules_read" ON fsm_work_schedules FOR SELECT USING (true);
CREATE POLICY "fsm_person_skills_read" ON fsm_person_skills FOR SELECT USING (true);

-- Write policies (authenticated users can write)
CREATE POLICY "project_types_write" ON project_types FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "fsm_team_profiles_write" ON fsm_team_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "fsm_territory_coverage_write" ON fsm_territory_coverage FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "fsm_work_schedules_write" ON fsm_work_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "fsm_person_skills_write" ON fsm_person_skills FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fsm_team_profiles_updated ON fsm_team_profiles;
CREATE TRIGGER trigger_fsm_team_profiles_updated
  BEFORE UPDATE ON fsm_team_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_fsm_territory_coverage_updated ON fsm_territory_coverage;
CREATE TRIGGER trigger_fsm_territory_coverage_updated
  BEFORE UPDATE ON fsm_territory_coverage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_fsm_person_skills_updated ON fsm_person_skills;
CREATE TRIGGER trigger_fsm_person_skills_updated
  BEFORE UPDATE ON fsm_person_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
