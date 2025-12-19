-- Migration 193: Safe application of skipped parts from 182-184
-- This migration applies ONLY the non-conflicting parts from migrations 182, 183, 184
-- Views are NOT recreated as they were already updated by migrations 187-192
-- Column assigned_qbo_class_ids is NOT touched as 192 already changed it to text[]

-- ============================================================
-- FROM MIGRATION 182: crew_subcontractor_support
-- ============================================================

-- 1. Add subcontractor fields to crews table
ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS is_subcontractor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS lead_phone text;

COMMENT ON COLUMN crews.is_subcontractor IS 'True for subcontractor crews (external), false for internal crews';
COMMENT ON COLUMN crews.lead_name IS 'Lead contact name for subcontractors (no user account required)';
COMMENT ON COLUMN crews.lead_phone IS 'Lead contact phone for subcontractors';

-- 2. Create rep_crew_alignments table (if not exists)
CREATE TABLE IF NOT EXISTS rep_crew_alignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  skill_categories text[] DEFAULT '{}',
  priority smallint DEFAULT 1,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rep_user_id, crew_id)
);

CREATE INDEX IF NOT EXISTS idx_rep_crew_alignments_rep
  ON rep_crew_alignments(rep_user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_rep_crew_alignments_crew
  ON rep_crew_alignments(crew_id) WHERE is_active;

COMMENT ON TABLE rep_crew_alignments IS 'Maps reps to their aligned/preferred crews for assignment suggestions';

-- 3. Add company_name to clients (if not exists)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN clients.company_name IS 'Company name for business clients. If set, primary contact becomes the contact person for the company.';

-- 4. Enable RLS on rep_crew_alignments
ALTER TABLE rep_crew_alignments ENABLE ROW LEVEL SECURITY;

-- RLS policies (check if exists first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rep_crew_alignments' AND policyname = 'Users can view rep_crew_alignments') THEN
    CREATE POLICY "Users can view rep_crew_alignments"
      ON rep_crew_alignments FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rep_crew_alignments' AND policyname = 'Users can manage rep_crew_alignments') THEN
    CREATE POLICY "Users can manage rep_crew_alignments"
      ON rep_crew_alignments FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Update trigger for rep_crew_alignments
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

-- 6. Add crew_id to fsm_team_profiles (if not exists)
ALTER TABLE fsm_team_profiles
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL;

-- NOTE: assigned_qbo_class_ids column NOT created here
-- Migration 192 already changed it from uuid[] to text[]

-- NOTE: fsm_team_full view NOT recreated here
-- Migration 192 already has the correct version

-- ============================================================
-- FROM MIGRATION 183: multi_crew_preferences
-- ============================================================

-- 1. Create client_crew_preferences table
CREATE TABLE IF NOT EXISTS client_crew_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  skill_categories text[] DEFAULT '{}',
  priority smallint DEFAULT 1,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, crew_id)
);

CREATE INDEX IF NOT EXISTS idx_client_crew_prefs_client
  ON client_crew_preferences(client_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_client_crew_prefs_crew
  ON client_crew_preferences(crew_id) WHERE is_active;

COMMENT ON TABLE client_crew_preferences IS 'Preferred crews for each client, supporting multiple crews with priorities';

-- 2. Handle community_crew_preferences (if not exists or add missing columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_crew_preferences') THEN
    CREATE TABLE community_crew_preferences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
      skill_categories text[] DEFAULT '{}',
      priority smallint DEFAULT 1,
      inherited_from_rep_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      notes text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(community_id, crew_id)
    );
  ELSE
    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'crew_id') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN crew_id uuid REFERENCES crews(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'skill_categories') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN skill_categories text[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'priority') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN priority smallint DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'inherited_from_rep_id') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN inherited_from_rep_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'is_active') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'notes') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN notes text;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_crew_prefs_community
  ON community_crew_preferences(community_id);
CREATE INDEX IF NOT EXISTS idx_community_crew_prefs_crew
  ON community_crew_preferences(crew_id);

COMMENT ON TABLE community_crew_preferences IS 'Preferred crews for each community, supporting multiple crews with priorities';

-- 3. Enable RLS on client_crew_preferences
ALTER TABLE client_crew_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_crew_preferences' AND policyname = 'Users can view client_crew_preferences') THEN
    CREATE POLICY "Users can view client_crew_preferences"
      ON client_crew_preferences FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_crew_preferences' AND policyname = 'Users can manage client_crew_preferences') THEN
    CREATE POLICY "Users can manage client_crew_preferences"
      ON client_crew_preferences FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Enable RLS on community_crew_preferences
ALTER TABLE community_crew_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_crew_preferences' AND policyname = 'Users can view community_crew_preferences') THEN
    CREATE POLICY "Users can view community_crew_preferences"
      ON community_crew_preferences FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_crew_preferences' AND policyname = 'Users can manage community_crew_preferences') THEN
    CREATE POLICY "Users can manage community_crew_preferences"
      ON community_crew_preferences FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Update triggers
DROP TRIGGER IF EXISTS update_client_crew_preferences_updated_at ON client_crew_preferences;
CREATE TRIGGER update_client_crew_preferences_updated_at
  BEFORE UPDATE ON client_crew_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_crew_preferences_updated_at ON community_crew_preferences;
CREATE TRIGGER update_community_crew_preferences_updated_at
  BEFORE UPDATE ON community_crew_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Create crew_assignment_summary view (drop and recreate)
DROP VIEW IF EXISTS crew_assignment_summary;
CREATE VIEW crew_assignment_summary AS
SELECT
  c.id as crew_id,
  c.name as crew_name,
  c.code as crew_code,
  c.is_subcontractor,
  c.is_active,
  COUNT(DISTINCT rca.rep_user_id) as aligned_reps_count,
  COUNT(DISTINCT clcp.client_id) as preferred_by_clients,
  COUNT(DISTINCT ccp.community_id) as preferred_by_communities,
  COUNT(DISTINCT rca.rep_user_id) +
  COUNT(DISTINCT clcp.client_id) +
  COUNT(DISTINCT ccp.community_id) as total_assignments
FROM crews c
LEFT JOIN rep_crew_alignments rca ON rca.crew_id = c.id AND rca.is_active
LEFT JOIN client_crew_preferences clcp ON clcp.crew_id = c.id AND clcp.is_active
LEFT JOIN community_crew_preferences ccp ON ccp.crew_id = c.id AND (ccp.is_active IS NULL OR ccp.is_active = true)
GROUP BY c.id, c.name, c.code, c.is_subcontractor, c.is_active;

COMMENT ON VIEW crew_assignment_summary IS 'Summary of crew assignments for list display';

-- ============================================================
-- FROM MIGRATION 184: territory_map_enhancement
-- ============================================================

-- 1. Add territory columns (if not exist)
ALTER TABLE territories ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE territories ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE territories ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_territories_geometry ON territories USING GIN(geometry);

COMMENT ON COLUMN territories.geometry IS 'GeoJSON representation of drawn shape for map display';
COMMENT ON COLUMN territories.color IS 'Hex color code for territory display on map';

-- 2. Create metro_zip_centroids table (if not exists)
CREATE TABLE IF NOT EXISTS metro_zip_centroids (
  zip_code VARCHAR(5) PRIMARY KEY,
  metro VARCHAR(20) NOT NULL,
  city VARCHAR(100),
  county VARCHAR(100),
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  population INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metro_zips_metro ON metro_zip_centroids(metro);
CREATE INDEX IF NOT EXISTS idx_metro_zips_county ON metro_zip_centroids(county);

ALTER TABLE metro_zip_centroids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metro_zip_centroids_read" ON metro_zip_centroids;
CREATE POLICY "metro_zip_centroids_read" ON metro_zip_centroids
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "metro_zip_centroids_write" ON metro_zip_centroids;
CREATE POLICY "metro_zip_centroids_write" ON metro_zip_centroids
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE metro_zip_centroids IS 'Reference table of zip code centroids for Greater Austin, San Antonio, and Houston metros.';

-- 3. Create territory_assignments table (if not exists)
CREATE TABLE IF NOT EXISTS territory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  sales_rep_id UUID NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(territory_id, sales_rep_id)
);

CREATE INDEX IF NOT EXISTS idx_territory_assignments_territory ON territory_assignments(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_rep ON territory_assignments(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_primary ON territory_assignments(is_primary);

ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "territory_assignments_read" ON territory_assignments;
CREATE POLICY "territory_assignments_read" ON territory_assignments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "territory_assignments_write" ON territory_assignments;
CREATE POLICY "territory_assignments_write" ON territory_assignments
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE territory_assignments IS 'Links sales reps to territories with primary/backup designation';

-- 4. Create territory_zip_lookup view (drop and recreate to change columns)
DROP VIEW IF EXISTS territory_zip_lookup;
CREATE VIEW territory_zip_lookup AS
SELECT
  t.id as territory_id,
  t.name as territory_name,
  t.business_unit_id,
  t.location_code,
  l.name as location_name,
  unnest(t.zip_codes) as zip_code
FROM territories t
LEFT JOIN locations l ON l.code = t.location_code
WHERE t.is_active = true;

-- 5. Create find_territories_by_zip function (drop and recreate due to signature change)
-- Updated to use location_code instead of business_units
DROP FUNCTION IF EXISTS find_territories_by_zip(TEXT);
CREATE FUNCTION find_territories_by_zip(p_zip_code TEXT)
RETURNS TABLE (
  territory_id UUID,
  territory_name TEXT,
  location_code VARCHAR(10),
  location_name TEXT,
  assigned_reps JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name::TEXT,
    t.location_code,
    l.name::TEXT,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', sr.id,
          'name', sr.name,
          'is_primary', ta.is_primary
        )
      ) FILTER (WHERE sr.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM territories t
  LEFT JOIN locations l ON l.code = t.location_code
  LEFT JOIN territory_assignments ta ON ta.territory_id = t.id
  LEFT JOIN sales_reps sr ON sr.id = ta.sales_rep_id AND sr.is_active = true
  WHERE t.is_active = true
    AND p_zip_code = ANY(t.zip_codes)
  GROUP BY t.id, l.name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_territories_by_zip IS 'Returns all active territories that cover a given zip code, with assigned reps';

-- NOTE: territories_with_reps view NOT recreated here
-- Migration 191 already has the correct version with location_code support

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON crew_assignment_summary TO authenticated;
GRANT SELECT ON territory_zip_lookup TO authenticated;
