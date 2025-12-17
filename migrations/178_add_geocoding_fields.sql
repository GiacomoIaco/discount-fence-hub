-- ============================================================================
-- Migration 178: Add Geocoding/Location Fields
-- Smart Address Search & Location Services
-- NOTE: properties table already has latitude/longitude columns
-- ============================================================================

-- ===========================================
-- 1. PROPERTIES - Only add missing geocoding metadata
-- ===========================================
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_source TEXT,
  ADD COLUMN IF NOT EXISTS place_id TEXT,
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

COMMENT ON COLUMN properties.geocode_source IS 'Source of geocoding: radar, google, manual, gps';
COMMENT ON COLUMN properties.place_id IS 'External place ID for future lookups';

-- ===========================================
-- 2. SERVICE_REQUESTS - Add geocoding fields
-- ===========================================
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 3. JOBS - Add site coordinates
-- ===========================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS site_latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS site_longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 4. CREWS - Add home base location
-- ===========================================
ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS home_address TEXT;

COMMENT ON COLUMN crews.home_latitude IS 'Crew home base latitude for routing';
COMMENT ON COLUMN crews.home_longitude IS 'Crew home base longitude for routing';

-- ===========================================
-- 5. COMMUNITIES - Add geocoding fields
-- ===========================================
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- ===========================================
-- 6. TERRITORIES - Add center coordinates
-- ===========================================
ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS center_lat DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS center_lng DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS boundary_geojson JSONB;

-- ===========================================
-- 7. Create Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_properties_coords
  ON properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_coords
  ON jobs(site_latitude, site_longitude)
  WHERE site_latitude IS NOT NULL AND site_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crews_coords
  ON crews(home_latitude, home_longitude)
  WHERE home_latitude IS NOT NULL AND home_longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_coords
  ON service_requests(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communities_coords
  ON communities(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ===========================================
-- 8. Helper function
-- ===========================================
CREATE OR REPLACE FUNCTION has_coordinates(lat DECIMAL, lng DECIMAL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN lat IS NOT NULL AND lng IS NOT NULL
    AND lat BETWEEN -90 AND 90
    AND lng BETWEEN -180 AND 180;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION has_coordinates IS 'Check if latitude/longitude pair is valid';

-- ===========================================
-- Done!
-- ===========================================
