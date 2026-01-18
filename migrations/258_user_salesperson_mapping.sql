-- Migration 258: User Salesperson Mapping
-- Maps authenticated users to their salesperson names in Jobber data
-- Enables auto-filtering analytics to user's own data

-- Create the mapping table
CREATE TABLE IF NOT EXISTS user_salesperson_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salesperson_name TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'manual' CHECK (match_type IN ('exact', 'fuzzy', 'manual')),
  match_confidence NUMERIC(3,2) DEFAULT 1.0,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Add comment
COMMENT ON TABLE user_salesperson_mapping IS 'Maps users to their salesperson name in Jobber/analytics data for auto-filtering';

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_salesperson_mapping_user_id ON user_salesperson_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_salesperson_mapping_salesperson_name ON user_salesperson_mapping(salesperson_name);

-- Enable RLS
ALTER TABLE user_salesperson_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own mapping
CREATE POLICY "Users can read own mapping"
  ON user_salesperson_mapping
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admins can read all mappings
CREATE POLICY "Admins can read all mappings"
  ON user_salesperson_mapping
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert/update/delete mappings
CREATE POLICY "Admins can manage mappings"
  ON user_salesperson_mapping
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Function to auto-match user to salesperson on profile update
CREATE OR REPLACE FUNCTION auto_match_user_salesperson()
RETURNS TRIGGER AS $$
DECLARE
  v_salesperson_name TEXT;
  v_match_type TEXT;
  v_confidence NUMERIC;
BEGIN
  -- Skip if user already has a verified mapping
  IF EXISTS (
    SELECT 1 FROM user_salesperson_mapping
    WHERE user_id = NEW.id
    AND is_verified = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  -- Try exact match first
  SELECT DISTINCT effective_salesperson INTO v_salesperson_name
  FROM jobber_builder_jobs
  WHERE LOWER(TRIM(effective_salesperson)) = LOWER(TRIM(NEW.full_name))
  LIMIT 1;

  IF v_salesperson_name IS NOT NULL THEN
    v_match_type := 'exact';
    v_confidence := 1.0;
  ELSE
    -- Try fuzzy match (first name + starts with last name)
    SELECT DISTINCT effective_salesperson INTO v_salesperson_name
    FROM jobber_builder_jobs
    WHERE LOWER(effective_salesperson) LIKE LOWER(SPLIT_PART(NEW.full_name, ' ', 1)) || '%'
    LIMIT 1;

    IF v_salesperson_name IS NOT NULL THEN
      v_match_type := 'fuzzy';
      v_confidence := 0.7;
    END IF;
  END IF;

  -- Insert or update mapping if found
  IF v_salesperson_name IS NOT NULL THEN
    INSERT INTO user_salesperson_mapping (user_id, salesperson_name, match_type, match_confidence)
    VALUES (NEW.id, v_salesperson_name, v_match_type, v_confidence)
    ON CONFLICT (user_id) DO UPDATE SET
      salesperson_name = EXCLUDED.salesperson_name,
      match_type = EXCLUDED.match_type,
      match_confidence = EXCLUDED.match_confidence,
      updated_at = now()
    WHERE user_salesperson_mapping.is_verified = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profile updates
DROP TRIGGER IF EXISTS trigger_auto_match_salesperson ON user_profiles;
CREATE TRIGGER trigger_auto_match_salesperson
  AFTER INSERT OR UPDATE OF full_name ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_match_user_salesperson();

-- Function to get salesperson name for current user
CREATE OR REPLACE FUNCTION get_user_salesperson_name()
RETURNS TEXT AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT salesperson_name INTO v_name
  FROM user_salesperson_mapping
  WHERE user_id = auth.uid();

  RETURN v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admins to list distinct salespeople
CREATE OR REPLACE FUNCTION get_distinct_salespeople()
RETURNS TABLE(salesperson_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT jli.effective_salesperson
  FROM jobber_builder_jobs jli
  WHERE jli.effective_salesperson IS NOT NULL
    AND jli.effective_salesperson != ''
  ORDER BY jli.effective_salesperson;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: Try to auto-match existing users
INSERT INTO user_salesperson_mapping (user_id, salesperson_name, match_type, match_confidence)
SELECT
  p.id,
  jli.effective_salesperson,
  'exact',
  1.0
FROM user_profiles p
JOIN LATERAL (
  SELECT DISTINCT effective_salesperson
  FROM jobber_builder_jobs
  WHERE LOWER(TRIM(effective_salesperson)) = LOWER(TRIM(p.full_name))
  LIMIT 1
) jli ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM user_salesperson_mapping WHERE user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;
