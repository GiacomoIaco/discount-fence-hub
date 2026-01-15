-- Migration 171: Assignment & Skills Tables
-- Prerequisites for calendar filtering and smart assignment suggestions
-- Depends on: 144_fsm_core_tables.sql

-- ============================================
-- 1. TERRITORY ASSIGNMENTS
-- Maps territories to primary/backup crews and reps
-- ============================================
CREATE TABLE IF NOT EXISTS territory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,

  -- Sales rep assignments
  primary_rep_id UUID REFERENCES sales_reps(id) ON DELETE SET NULL,
  backup_rep_id UUID REFERENCES sales_reps(id) ON DELETE SET NULL,

  -- Crew assignments
  primary_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,
  backup_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

  -- Scheduling preferences
  preferred_days TEXT[] DEFAULT '{}',  -- e.g., ['monday', 'tuesday', 'wednesday']
  avg_drive_time_from_yard INT,        -- Minutes (cached for optimization)

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One assignment record per territory
  UNIQUE(territory_id)
);

CREATE INDEX idx_territory_assignments_territory ON territory_assignments(territory_id);
CREATE INDEX idx_territory_assignments_primary_rep ON territory_assignments(primary_rep_id);
CREATE INDEX idx_territory_assignments_primary_crew ON territory_assignments(primary_crew_id);
CREATE INDEX idx_territory_assignments_active ON territory_assignments(is_active);

COMMENT ON TABLE territory_assignments IS 'Maps territories to primary/backup crews and reps for smart scheduling';

-- ============================================
-- 2. CREW SKILLS
-- Detailed skill tracking per fence type with proficiency levels
-- ============================================
CREATE TABLE IF NOT EXISTS crew_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,

  -- Fence type (matches product_types)
  fence_type TEXT NOT NULL,  -- 'Wood Vertical', 'Wood Horizontal', 'Iron', 'Chain Link', etc.

  -- Skill level affects duration calculation
  skill_level TEXT NOT NULL DEFAULT 'standard' CHECK (skill_level IN (
    'trainee',   -- 1.3x duration (30% slower)
    'standard',  -- 1.0x duration (baseline)
    'expert'     -- 0.85x duration (15% faster)
  )),

  -- Duration multiplier (calculated from skill_level, can be overridden)
  duration_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,

  -- Certification tracking
  certified_at DATE,
  certification_expires_at DATE,
  certified_by UUID REFERENCES auth.users(id),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One skill record per crew per fence type
  UNIQUE(crew_id, fence_type)
);

CREATE INDEX idx_crew_skills_crew ON crew_skills(crew_id);
CREATE INDEX idx_crew_skills_fence_type ON crew_skills(fence_type);
CREATE INDEX idx_crew_skills_level ON crew_skills(skill_level);

-- Auto-set duration multiplier based on skill level
CREATE OR REPLACE FUNCTION set_skill_duration_multiplier()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-set if not explicitly provided or if skill_level changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.skill_level != NEW.skill_level) THEN
    NEW.duration_multiplier := CASE NEW.skill_level
      WHEN 'trainee' THEN 1.30
      WHEN 'standard' THEN 1.00
      WHEN 'expert' THEN 0.85
      ELSE 1.00
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_skill_duration_multiplier ON crew_skills;
CREATE TRIGGER trigger_set_skill_duration_multiplier
  BEFORE INSERT OR UPDATE ON crew_skills
  FOR EACH ROW EXECUTE FUNCTION set_skill_duration_multiplier();

COMMENT ON TABLE crew_skills IS 'Detailed crew skills per fence type with proficiency levels affecting job duration';

-- ============================================
-- 3. SALES REP SKILLS
-- Similar to crew skills but for sales reps (affects assessment routing)
-- ============================================
CREATE TABLE IF NOT EXISTS sales_rep_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_rep_id UUID NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,

  -- Fence type expertise
  fence_type TEXT NOT NULL,

  -- Proficiency
  proficiency_level TEXT NOT NULL DEFAULT 'standard' CHECK (proficiency_level IN (
    'basic',     -- Can quote but may need support
    'standard',  -- Fully capable
    'expert'     -- Go-to person for complex jobs
  )),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sales_rep_id, fence_type)
);

CREATE INDEX idx_rep_skills_rep ON sales_rep_skills(sales_rep_id);
CREATE INDEX idx_rep_skills_fence_type ON sales_rep_skills(fence_type);

COMMENT ON TABLE sales_rep_skills IS 'Sales rep expertise per fence type for assessment routing';

-- ============================================
-- 4. COMMUNITY CREW PREFERENCES
-- Builder relationships - which crews they prefer
-- ============================================
CREATE TABLE IF NOT EXISTS community_crew_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Preferred crew (builder relationship)
  preferred_crew_id UUID REFERENCES crews(id) ON DELETE SET NULL,

  -- Preference strength
  preference_level TEXT DEFAULT 'preferred' CHECK (preference_level IN (
    'required',   -- Must use this crew (contractual)
    'preferred',  -- Should use if available
    'avoid'       -- Do not assign (past issues)
  )),

  -- Reason for preference
  reason TEXT,

  -- Who set this preference
  set_by UUID REFERENCES auth.users(id),
  set_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(community_id, preferred_crew_id)
);

CREATE INDEX idx_community_crew_pref_community ON community_crew_preferences(community_id);
CREATE INDEX idx_community_crew_pref_crew ON community_crew_preferences(preferred_crew_id);
CREATE INDEX idx_community_crew_pref_level ON community_crew_preferences(preference_level);

COMMENT ON TABLE community_crew_preferences IS 'Builder/community preferences for crew assignments';

-- ============================================
-- 5. COMMUNITY REP PREFERENCES
-- Builder relationships - which sales reps they prefer
-- ============================================
CREATE TABLE IF NOT EXISTS community_rep_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Preferred sales rep
  preferred_rep_id UUID REFERENCES sales_reps(id) ON DELETE SET NULL,

  -- Preference strength
  preference_level TEXT DEFAULT 'preferred' CHECK (preference_level IN (
    'required',   -- Must use this rep (key account)
    'preferred',  -- Should use if available
    'avoid'       -- Do not assign
  )),

  -- Reason
  reason TEXT,

  -- Who set this preference
  set_by UUID REFERENCES auth.users(id),
  set_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(community_id, preferred_rep_id)
);

CREATE INDEX idx_community_rep_pref_community ON community_rep_preferences(community_id);
CREATE INDEX idx_community_rep_pref_rep ON community_rep_preferences(preferred_rep_id);

COMMENT ON TABLE community_rep_preferences IS 'Builder/community preferences for sales rep assignments';

-- ============================================
-- 6. USER ROLE ASSIGNMENTS
-- Links users to crews/reps for "My Schedule" filtering
-- ============================================
CREATE TABLE IF NOT EXISTS user_schedule_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role type
  role_type TEXT NOT NULL CHECK (role_type IN (
    'crew_member',    -- Field installer
    'crew_lead',      -- Crew foreman
    'sales_rep',      -- Sales representative
    'dispatcher',     -- Can see all schedules
    'manager'         -- Can see all + edit
  )),

  -- Links (one of these based on role_type)
  crew_id UUID REFERENCES crews(id) ON DELETE CASCADE,
  sales_rep_id UUID REFERENCES sales_reps(id) ON DELETE CASCADE,

  -- Scope for dispatcher/manager
  territory_ids UUID[] DEFAULT '{}',
  business_unit_ids UUID[] DEFAULT '{}',

  -- Primary role flag (user can have multiple but one is primary)
  is_primary BOOLEAN DEFAULT true,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_schedule_roles_user ON user_schedule_roles(user_id);
CREATE INDEX idx_user_schedule_roles_crew ON user_schedule_roles(crew_id);
CREATE INDEX idx_user_schedule_roles_rep ON user_schedule_roles(sales_rep_id);
CREATE INDEX idx_user_schedule_roles_type ON user_schedule_roles(role_type);
CREATE INDEX idx_user_schedule_roles_active ON user_schedule_roles(is_active);

COMMENT ON TABLE user_schedule_roles IS 'Maps users to schedule roles for filtering and permissions';

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_rep_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_crew_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_rep_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_schedule_roles ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read all)
CREATE POLICY "territory_assignments_read" ON territory_assignments FOR SELECT USING (true);
CREATE POLICY "crew_skills_read" ON crew_skills FOR SELECT USING (true);
CREATE POLICY "sales_rep_skills_read" ON sales_rep_skills FOR SELECT USING (true);
CREATE POLICY "community_crew_preferences_read" ON community_crew_preferences FOR SELECT USING (true);
CREATE POLICY "community_rep_preferences_read" ON community_rep_preferences FOR SELECT USING (true);
CREATE POLICY "user_schedule_roles_read" ON user_schedule_roles FOR SELECT USING (true);

-- Write policies (authenticated users can write)
CREATE POLICY "territory_assignments_write" ON territory_assignments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "crew_skills_write" ON crew_skills FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "sales_rep_skills_write" ON sales_rep_skills FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "community_crew_preferences_write" ON community_crew_preferences FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "community_rep_preferences_write" ON community_rep_preferences FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "user_schedule_roles_write" ON user_schedule_roles FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Crews with their skills expanded
CREATE OR REPLACE VIEW crew_skills_summary AS
SELECT
  c.id AS crew_id,
  c.name AS crew_name,
  c.code AS crew_code,
  c.max_daily_lf,
  c.home_territory_id,
  t.name AS home_territory_name,
  COALESCE(
    json_agg(
      json_build_object(
        'fence_type', cs.fence_type,
        'skill_level', cs.skill_level,
        'duration_multiplier', cs.duration_multiplier
      )
    ) FILTER (WHERE cs.id IS NOT NULL),
    '[]'::json
  ) AS skills
FROM crews c
LEFT JOIN territories t ON t.id = c.home_territory_id
LEFT JOIN crew_skills cs ON cs.crew_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.code, c.max_daily_lf, c.home_territory_id, t.name;

-- View: Territory with full assignment details
CREATE OR REPLACE VIEW territory_details AS
SELECT
  t.id AS territory_id,
  t.name AS territory_name,
  t.code AS territory_code,
  t.zip_codes,
  ta.primary_rep_id,
  pr.name AS primary_rep_name,
  ta.backup_rep_id,
  br.name AS backup_rep_name,
  ta.primary_crew_id,
  pc.name AS primary_crew_name,
  ta.backup_crew_id,
  bc.name AS backup_crew_name,
  ta.preferred_days,
  ta.avg_drive_time_from_yard
FROM territories t
LEFT JOIN territory_assignments ta ON ta.territory_id = t.id
LEFT JOIN sales_reps pr ON pr.id = ta.primary_rep_id
LEFT JOIN sales_reps br ON br.id = ta.backup_rep_id
LEFT JOIN crews pc ON pc.id = ta.primary_crew_id
LEFT JOIN crews bc ON bc.id = ta.backup_crew_id
WHERE t.is_active = true;

COMMENT ON VIEW crew_skills_summary IS 'Crews with expanded skill details for assignment suggestions';
COMMENT ON VIEW territory_details IS 'Territories with full assignment information';
