-- Migration: 094_staging_target_date.sql
-- Description: Add staging target date with business day calculation
-- Helps yard workers prioritize which projects to stage first

-- ============================================
-- 1. ADD STAGING TARGET DATE COLUMN
-- ============================================

ALTER TABLE bom_projects ADD COLUMN IF NOT EXISTS staging_target_date DATE;

COMMENT ON COLUMN bom_projects.staging_target_date IS 'Target date for staging materials (typically 2 business days before pickup)';

-- Index for filtering/sorting by staging target date
CREATE INDEX IF NOT EXISTS idx_bom_projects_staging_target ON bom_projects(staging_target_date)
WHERE staging_target_date IS NOT NULL;

-- ============================================
-- 2. FUNCTION: Calculate Business Days Before
-- ============================================
-- Subtracts N business days from a date (skips weekends)

CREATE OR REPLACE FUNCTION calculate_business_days_before(
  p_date DATE,
  p_days_before INTEGER DEFAULT 2
)
RETURNS DATE AS $$
DECLARE
  v_result DATE;
  v_days_remaining INTEGER;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  v_result := p_date;
  v_days_remaining := p_days_before;

  -- Go back one day at a time, skipping weekends
  WHILE v_days_remaining > 0 LOOP
    v_result := v_result - INTERVAL '1 day';

    -- If it's a weekday (Mon=1 to Fri=5), count it
    IF EXTRACT(DOW FROM v_result) NOT IN (0, 6) THEN
      v_days_remaining := v_days_remaining - 1;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. FUNCTION: Get Staging Urgency Level
-- ============================================
-- Returns urgency level based on staging target date

CREATE OR REPLACE FUNCTION get_staging_urgency(
  p_staging_target_date DATE,
  p_status TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_today DATE;
  v_days_until INTEGER;
BEGIN
  -- Only calculate urgency for active statuses
  IF p_status NOT IN ('sent_to_yard', 'picking') THEN
    RETURN 'none';
  END IF;

  IF p_staging_target_date IS NULL THEN
    RETURN 'unknown';
  END IF;

  v_today := CURRENT_DATE;
  v_days_until := p_staging_target_date - v_today;

  IF v_days_until < 0 THEN
    RETURN 'overdue';    -- Past staging target date
  ELSIF v_days_until = 0 THEN
    RETURN 'today';      -- Stage today
  ELSIF v_days_until = 1 THEN
    RETURN 'tomorrow';   -- Stage tomorrow
  ELSE
    RETURN 'future';     -- 2+ days out
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. TRIGGER: Auto-calculate staging_target_date
-- ============================================

CREATE OR REPLACE FUNCTION update_staging_target_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate staging target date as 2 business days before pickup
  IF NEW.expected_pickup_date IS NOT NULL THEN
    NEW.staging_target_date := calculate_business_days_before(NEW.expected_pickup_date, 2);
  ELSE
    NEW.staging_target_date := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_staging_target_date ON bom_projects;
CREATE TRIGGER trigger_update_staging_target_date
  BEFORE INSERT OR UPDATE OF expected_pickup_date ON bom_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_staging_target_date();

-- ============================================
-- 5. BACKFILL EXISTING RECORDS
-- ============================================

UPDATE bom_projects
SET staging_target_date = calculate_business_days_before(expected_pickup_date, 2)
WHERE expected_pickup_date IS NOT NULL
  AND staging_target_date IS NULL;

-- ============================================
-- 6. UPDATE v_yard_schedule VIEW
-- ============================================
-- Add staging_target_date and urgency level to the view

DROP VIEW IF EXISTS v_yard_schedule;
CREATE VIEW v_yard_schedule AS
SELECT
  bp.id,
  bp.project_code,
  bp.project_name,
  bp.customer_name,
  bp.customer_address,
  bp.expected_pickup_date,
  bp.staging_target_date,
  get_staging_urgency(bp.staging_target_date, bp.status) as staging_urgency,
  bp.status,
  bp.crew_name,
  bp.is_bundle,
  bp.bundle_id,
  bp.bundle_name,
  bp.partial_pickup,
  bp.partial_pickup_notes,
  bp.yard_spot_id,
  bp.total_linear_feet,
  bp.total_material_cost,
  bp.business_unit_id,
  -- Claim info
  bp.claimed_by,
  bp.claimed_at,
  bp.picking_started_at,
  claimer.full_name as claimed_by_name,
  claimer.email as claimed_by_email,
  -- Yard info
  y.id as yard_id,
  y.code as yard_code,
  y.name as yard_name,
  ys.spot_code,
  ys.spot_name,
  -- Bundle info: count of projects in bundle
  CASE
    WHEN bp.is_bundle THEN (SELECT COUNT(*) FROM bom_projects WHERE bundle_id = bp.id)
    ELSE NULL
  END as bundle_project_count,
  -- Get child projects if this is a bundle
  CASE
    WHEN bp.is_bundle THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'id', child.id,
        'project_code', child.project_code,
        'project_name', child.project_name,
        'customer_name', child.customer_name
      ))
      FROM bom_projects child
      WHERE child.bundle_id = bp.id
    )
    ELSE NULL
  END as bundle_projects,
  -- Pick progress summary
  (SELECT json_build_object(
    'total', COUNT(*),
    'picked', COUNT(*) FILTER (WHERE pp.is_complete = true)
  ) FROM pick_progress pp WHERE pp.project_id = bp.id) as pick_progress
FROM bom_projects bp
LEFT JOIN yards y ON y.id = bp.yard_id
LEFT JOIN yard_spots ys ON ys.id = bp.yard_spot_id
LEFT JOIN user_profiles claimer ON claimer.id = bp.claimed_by
WHERE bp.bundle_id IS NULL -- Don't show projects that are part of a bundle
  AND bp.status NOT IN ('cancelled', 'draft')
  AND COALESCE(bp.is_archived, false) = false
ORDER BY bp.staging_target_date NULLS LAST, bp.expected_pickup_date, bp.project_code;
