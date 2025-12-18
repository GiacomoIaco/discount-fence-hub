-- Migration 184: Territory Map Enhancement
-- S-007: Visual Map-Based Territory Assignment
-- Adds geometry storage and zip centroid reference data for map-based territory drawing

-- ============================================
-- 1. ENHANCE TERRITORIES TABLE
-- ============================================

-- Add geometry column for storing drawn shapes (GeoJSON)
ALTER TABLE territories ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Add color for map display
ALTER TABLE territories ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6';

-- Add description field
ALTER TABLE territories ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for geometry queries (if needed for spatial operations)
CREATE INDEX IF NOT EXISTS idx_territories_geometry ON territories USING GIN(geometry);

COMMENT ON COLUMN territories.geometry IS 'GeoJSON representation of drawn shape (circle, polygon, rectangle) for map display';
COMMENT ON COLUMN territories.color IS 'Hex color code for territory display on map';

-- ============================================
-- 2. METRO ZIP CENTROIDS REFERENCE TABLE
-- ============================================
-- Pre-populated with zip code centroids for Austin, San Antonio, Houston metros
-- Used for point-in-polygon calculations when drawing territories

CREATE TABLE IF NOT EXISTS metro_zip_centroids (
  zip_code VARCHAR(5) PRIMARY KEY,
  metro VARCHAR(20) NOT NULL,           -- 'austin', 'san_antonio', 'houston'
  city VARCHAR(100),
  county VARCHAR(100),
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  -- Metadata
  population INT,                        -- Optional: for weighting/display
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metro_zips_metro ON metro_zip_centroids(metro);
CREATE INDEX IF NOT EXISTS idx_metro_zips_county ON metro_zip_centroids(county);

-- Enable RLS
ALTER TABLE metro_zip_centroids ENABLE ROW LEVEL SECURITY;

-- Everyone can read (reference data)
DROP POLICY IF EXISTS "metro_zip_centroids_read" ON metro_zip_centroids;
CREATE POLICY "metro_zip_centroids_read" ON metro_zip_centroids
  FOR SELECT USING (true);

-- Only service role can modify (seed data)
DROP POLICY IF EXISTS "metro_zip_centroids_write" ON metro_zip_centroids;
CREATE POLICY "metro_zip_centroids_write" ON metro_zip_centroids
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE metro_zip_centroids IS 'Reference table of zip code centroids for Greater Austin, San Antonio, and Houston metros. Used for territory map drawing.';

-- ============================================
-- 3. TERRITORY ASSIGNMENT TRACKING
-- ============================================
-- Junction table to track which sales reps are assigned to which territories
-- Replaces the territory_ids array on sales_reps for better querying

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

-- Enable RLS
ALTER TABLE territory_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "territory_assignments_read" ON territory_assignments;
CREATE POLICY "territory_assignments_read" ON territory_assignments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "territory_assignments_write" ON territory_assignments;
CREATE POLICY "territory_assignments_write" ON territory_assignments
  FOR ALL USING (auth.role() = 'authenticated');

COMMENT ON TABLE territory_assignments IS 'Links sales reps to territories with primary/backup designation';

-- ============================================
-- 4. HELPER VIEWS
-- ============================================

-- View: Territories with assigned reps
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

-- View: Find territories by zip code
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

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function: Find territories covering a specific zip code
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

COMMENT ON FUNCTION find_territories_by_zip IS 'Returns all active territories that cover a given zip code, with assigned reps';
