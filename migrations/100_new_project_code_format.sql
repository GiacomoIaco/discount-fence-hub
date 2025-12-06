-- ============================================
-- Migration 100: New Project Code Format
-- ============================================
-- Changes project codes from AAA-001 to A-BC01 format:
-- - First character: Yard code (A=Austin, S=San Antonio, H=Houston)
-- - Dash separator
-- - 4-character alphanumeric counter (base-36: 0-9, A-Z)
--
-- This gives 36^4 = 1,679,616 unique codes per yard
-- At 1,000/month = 140 years before repeating!

-- ============================================
-- 1. YARD CODE COUNTERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS yard_code_counters (
  yard_code TEXT PRIMARY KEY,  -- 'A', 'S', 'H'
  next_counter INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE yard_code_counters IS 'Tracks the next project code counter for each yard';
COMMENT ON COLUMN yard_code_counters.yard_code IS 'Single letter yard identifier (A/S/H)';
COMMENT ON COLUMN yard_code_counters.next_counter IS 'Next counter value (increments with each project)';

-- Initialize counters for each yard
INSERT INTO yard_code_counters (yard_code, next_counter)
VALUES
  ('A', 0),  -- Austin
  ('S', 0),  -- San Antonio
  ('H', 0),  -- Houston
  ('X', 0)   -- Unknown/No yard (fallback)
ON CONFLICT (yard_code) DO NOTHING;

-- ============================================
-- 2. BASE-36 ENCODING FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION int_to_base36(num INTEGER, width INTEGER DEFAULT 4)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT := '';
  remainder INTEGER;
  current INTEGER := num;
BEGIN
  IF num < 0 THEN
    RAISE EXCEPTION 'Cannot encode negative number';
  END IF;

  -- Handle zero case
  IF num = 0 THEN
    RETURN LPAD('0', width, '0');
  END IF;

  -- Convert to base-36
  WHILE current > 0 LOOP
    remainder := current % 36;
    result := SUBSTRING(chars FROM remainder + 1 FOR 1) || result;
    current := current / 36;
  END LOOP;

  -- Pad to desired width
  RETURN LPAD(result, width, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION int_to_base36 IS 'Converts an integer to base-36 string (0-9, A-Z)';

-- ============================================
-- 3. GET YARD LETTER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_yard_letter(p_yard_id UUID)
RETURNS TEXT AS $$
DECLARE
  yard_code TEXT;
BEGIN
  IF p_yard_id IS NULL THEN
    RETURN 'X';  -- Unknown yard
  END IF;

  SELECT
    CASE
      WHEN UPPER(code) LIKE 'AUS%' OR UPPER(code) = 'A' THEN 'A'
      WHEN UPPER(code) LIKE 'SAT%' OR UPPER(code) LIKE 'SAN%' OR UPPER(code) = 'S' THEN 'S'
      WHEN UPPER(code) LIKE 'HOU%' OR UPPER(code) = 'H' THEN 'H'
      ELSE UPPER(LEFT(code, 1))  -- First letter of yard code
    END INTO yard_code
  FROM yards
  WHERE id = p_yard_id;

  -- Default to 'X' if yard not found
  RETURN COALESCE(yard_code, 'X');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_yard_letter IS 'Gets single-letter yard identifier from yard UUID';

-- ============================================
-- 4. NEW PROJECT CODE GENERATOR
-- ============================================

CREATE OR REPLACE FUNCTION generate_project_code_v2(p_yard_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_yard_letter TEXT;
  v_counter INTEGER;
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  -- Get yard letter
  v_yard_letter := get_yard_letter(p_yard_id);

  -- Ensure yard has a counter row
  INSERT INTO yard_code_counters (yard_code, next_counter)
  VALUES (v_yard_letter, 0)
  ON CONFLICT (yard_code) DO NOTHING;

  LOOP
    -- Get and increment counter atomically
    UPDATE yard_code_counters
    SET next_counter = next_counter + 1,
        updated_at = NOW()
    WHERE yard_code = v_yard_letter
    RETURNING next_counter INTO v_counter;

    -- Generate code: A-BC01 format
    v_code := v_yard_letter || '-' || int_to_base36(v_counter, 4);

    -- Check for uniqueness (should never fail, but safety check)
    IF NOT EXISTS (SELECT 1 FROM bom_projects WHERE project_code = v_code) THEN
      RETURN v_code;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique project code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_project_code_v2 IS 'Generates project code in A-BC01 format (yard + base-36 counter)';

-- ============================================
-- 5. UPDATE TRIGGER TO USE NEW FORMAT
-- ============================================

CREATE OR REPLACE FUNCTION set_project_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_code IS NULL THEN
    NEW.project_code := generate_project_code_v2(NEW.yard_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, we just updated the function it calls

-- ============================================
-- 6. INITIALIZE COUNTERS BASED ON EXISTING PROJECTS
-- ============================================

-- Count existing projects per yard to set initial counters
-- This ensures new codes don't conflict with existing ones
DO $$
DECLARE
  v_yard RECORD;
  v_max_count INTEGER;
BEGIN
  FOR v_yard IN
    SELECT
      get_yard_letter(yard_id) as yard_letter,
      COUNT(*) as project_count
    FROM bom_projects
    WHERE project_code IS NOT NULL
    GROUP BY get_yard_letter(yard_id)
  LOOP
    -- Set counter to at least the count of existing projects + some buffer
    UPDATE yard_code_counters
    SET next_counter = GREATEST(next_counter, v_yard.project_count + 100)
    WHERE yard_code = v_yard.yard_letter;
  END LOOP;
END $$;

-- ============================================
-- 7. RLS FOR YARD_CODE_COUNTERS
-- ============================================

ALTER TABLE yard_code_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view yard_code_counters"
  ON yard_code_counters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can update yard_code_counters"
  ON yard_code_counters FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert yard_code_counters"
  ON yard_code_counters FOR INSERT
  TO authenticated
  WITH CHECK (true);
