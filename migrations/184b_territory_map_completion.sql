-- Migration 184b: Complete Territory Map Enhancement
-- Finishes the partially applied 184 migration

-- 1. Add missing columns to territories table
ALTER TABLE territories ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE territories ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE territories ADD COLUMN IF NOT EXISTS description TEXT;
CREATE INDEX IF NOT EXISTS idx_territories_geometry ON territories USING GIN(geometry);

-- 1b. Fix territory_assignments table (drop and recreate with proper columns)
DROP TABLE IF EXISTS territory_assignments CASCADE;
CREATE TABLE territory_assignments (
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
CREATE POLICY "territory_assignments_read" ON territory_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "territory_assignments_write" ON territory_assignments;
CREATE POLICY "territory_assignments_write" ON territory_assignments FOR ALL USING (auth.role() = 'authenticated');

-- 2. Create metro_zip_centroids table
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
CREATE POLICY "metro_zip_centroids_read" ON metro_zip_centroids FOR SELECT USING (true);

DROP POLICY IF EXISTS "metro_zip_centroids_write" ON metro_zip_centroids;
CREATE POLICY "metro_zip_centroids_write" ON metro_zip_centroids FOR ALL USING (auth.role() = 'service_role');

-- 3. Create/update views
CREATE OR REPLACE VIEW territories_with_reps AS
SELECT
  t.*,
  bu.name as business_unit_name,
  bu.code as business_unit_code,
  bu.location as metro,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sr.id,
        'name', sr.name,
        'is_primary', ta.is_primary
      )
    ) FILTER (WHERE sr.id IS NOT NULL),
    '[]'::jsonb
  ) as assigned_reps,
  array_length(t.zip_codes, 1) as zip_count
FROM territories t
LEFT JOIN business_units bu ON bu.id = t.business_unit_id
LEFT JOIN territory_assignments ta ON ta.territory_id = t.id
LEFT JOIN sales_reps sr ON sr.id = ta.sales_rep_id AND sr.is_active = true
GROUP BY t.id, bu.id;

CREATE OR REPLACE VIEW territory_zip_lookup AS
SELECT
  t.id as territory_id,
  t.name as territory_name,
  t.business_unit_id,
  bu.name as business_unit_name,
  unnest(t.zip_codes) as zip_code
FROM territories t
LEFT JOIN business_units bu ON bu.id = t.business_unit_id
WHERE t.is_active = true;

-- 4. Create helper function
CREATE OR REPLACE FUNCTION find_territories_by_zip(p_zip_code TEXT)
RETURNS TABLE (
  territory_id UUID,
  territory_name TEXT,
  business_unit_id UUID,
  business_unit_name TEXT,
  assigned_reps JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name::TEXT,
    t.business_unit_id,
    bu.name::TEXT,
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
  LEFT JOIN business_units bu ON bu.id = t.business_unit_id
  LEFT JOIN territory_assignments ta ON ta.territory_id = t.id
  LEFT JOIN sales_reps sr ON sr.id = ta.sales_rep_id AND sr.is_active = true
  WHERE t.is_active = true
    AND p_zip_code = ANY(t.zip_codes)
  GROUP BY t.id, bu.id;
END;
$$ LANGUAGE plpgsql STABLE;
