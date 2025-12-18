-- Migration: 183_multi_crew_preferences.sql
-- Description: Support multiple preferred crews for communities and clients (S-006)
-- Date: 2024-12-17

-- ============================================
-- 1. Create client_crew_preferences table (for multiple crews per client)
-- ============================================

CREATE TABLE IF NOT EXISTS client_crew_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  skill_categories text[] DEFAULT '{}',  -- Which skills this crew handles for this client
  priority smallint DEFAULT 1,           -- 1 = primary, 2 = backup, etc.
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, crew_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_crew_prefs_client
  ON client_crew_preferences(client_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_client_crew_prefs_crew
  ON client_crew_preferences(crew_id) WHERE is_active;

COMMENT ON TABLE client_crew_preferences IS 'Preferred crews for each client, supporting multiple crews with priorities';

-- ============================================
-- 2. Create community_crew_preferences table if not exists
--    (may exist from migration 171 with different schema)
-- ============================================

-- First, check if table exists and add missing columns
DO $$
BEGIN
  -- If table doesn't exist, create it with our schema
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
    -- Table exists, add missing columns
    -- Add crew_id if missing (table might have preferred_crew_id instead)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'crew_id') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN crew_id uuid REFERENCES crews(id) ON DELETE CASCADE;
      -- Copy preferred_crew_id to crew_id if it exists
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'community_crew_preferences' AND column_name = 'preferred_crew_id') THEN
        UPDATE community_crew_preferences SET crew_id = preferred_crew_id WHERE crew_id IS NULL;
      END IF;
    END IF;

    -- Add skill_categories if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'skill_categories') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN skill_categories text[] DEFAULT '{}';
    END IF;

    -- Add priority if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'priority') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN priority smallint DEFAULT 1;
    END IF;

    -- Add inherited_from_rep_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'inherited_from_rep_id') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN inherited_from_rep_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Add is_active if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'is_active') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    -- Add notes if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'community_crew_preferences' AND column_name = 'notes') THEN
      ALTER TABLE community_crew_preferences ADD COLUMN notes text;
    END IF;
  END IF;
END $$;

-- Create indexes (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_community_crew_prefs_community
  ON community_crew_preferences(community_id);
CREATE INDEX IF NOT EXISTS idx_community_crew_prefs_crew
  ON community_crew_preferences(crew_id);

COMMENT ON TABLE community_crew_preferences IS 'Preferred crews for each community, supporting multiple crews with priorities';

-- ============================================
-- 3. Enable RLS on new/updated tables
-- ============================================

ALTER TABLE client_crew_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_crew_preferences
CREATE POLICY "Users can view client_crew_preferences"
  ON client_crew_preferences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage client_crew_preferences"
  ON client_crew_preferences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled on community_crew_preferences
ALTER TABLE community_crew_preferences ENABLE ROW LEVEL SECURITY;

-- Add policies if they don't exist (use DO block to handle existing policies)
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

-- ============================================
-- 4. Update triggers for updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_client_crew_preferences_updated_at ON client_crew_preferences;
CREATE TRIGGER update_client_crew_preferences_updated_at
  BEFORE UPDATE ON client_crew_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_crew_preferences_updated_at ON community_crew_preferences;
CREATE TRIGGER update_community_crew_preferences_updated_at
  BEFORE UPDATE ON community_crew_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Create crew_assignment_summary view
-- ============================================

CREATE OR REPLACE VIEW crew_assignment_summary AS
SELECT
  c.id as crew_id,
  c.name as crew_name,
  c.code as crew_code,
  c.is_subcontractor,
  c.is_active,
  -- Rep alignments count
  COUNT(DISTINCT rca.rep_user_id) as aligned_reps_count,
  -- Client preferences count
  COUNT(DISTINCT clcp.client_id) as preferred_by_clients,
  -- Community preferences count
  COUNT(DISTINCT ccp.community_id) as preferred_by_communities,
  -- Total reach
  COUNT(DISTINCT rca.rep_user_id) +
  COUNT(DISTINCT clcp.client_id) +
  COUNT(DISTINCT ccp.community_id) as total_assignments
FROM crews c
LEFT JOIN rep_crew_alignments rca ON rca.crew_id = c.id AND rca.is_active
LEFT JOIN client_crew_preferences clcp ON clcp.crew_id = c.id AND clcp.is_active
LEFT JOIN community_crew_preferences ccp ON ccp.crew_id = c.id AND (ccp.is_active IS NULL OR ccp.is_active = true)
GROUP BY c.id, c.name, c.code, c.is_subcontractor, c.is_active;

COMMENT ON VIEW crew_assignment_summary IS 'Summary of crew assignments for list display';
