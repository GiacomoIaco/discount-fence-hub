-- Migration 191: Team Consolidation Phase 5
-- Migrates rep references from sales_reps.id to auth.users.id
-- This enables using user_profiles for rep info instead of sales_reps

-- ============================================================
-- STEP 1: Ensure all sales_reps have user_id populated
-- ============================================================
-- First, check for any sales_reps without user_id
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM sales_reps WHERE user_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Warning: % sales_reps records have NULL user_id', orphan_count;
  END IF;
END $$;

-- ============================================================
-- STEP 2: Add temporary columns to hold user_id references
-- ============================================================

-- service_requests: assigned_rep_id and assessment_rep_id
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS assigned_rep_user_id UUID,
  ADD COLUMN IF NOT EXISTS assessment_rep_user_id UUID;

-- quotes: sales_rep_id
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS sales_rep_user_id UUID;

-- jobs: assigned_rep_id
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS assigned_rep_user_id UUID;

-- projects: assigned_rep_id
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS assigned_rep_user_id UUID;

-- schedule_entries: sales_rep_id
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS sales_rep_user_id UUID;

-- ============================================================
-- STEP 3: Migrate data from sales_reps.id to user_id
-- ============================================================

-- service_requests
UPDATE service_requests sr
SET assigned_rep_user_id = s.user_id
FROM sales_reps s
WHERE sr.assigned_rep_id = s.id
  AND sr.assigned_rep_user_id IS NULL;

UPDATE service_requests sr
SET assessment_rep_user_id = s.user_id
FROM sales_reps s
WHERE sr.assessment_rep_id = s.id
  AND sr.assessment_rep_user_id IS NULL;

-- quotes
UPDATE quotes q
SET sales_rep_user_id = s.user_id
FROM sales_reps s
WHERE q.sales_rep_id = s.id
  AND q.sales_rep_user_id IS NULL;

-- jobs
UPDATE jobs j
SET assigned_rep_user_id = s.user_id
FROM sales_reps s
WHERE j.assigned_rep_id = s.id
  AND j.assigned_rep_user_id IS NULL;

-- projects
UPDATE projects p
SET assigned_rep_user_id = s.user_id
FROM sales_reps s
WHERE p.assigned_rep_id = s.id
  AND p.assigned_rep_user_id IS NULL;

-- schedule_entries
UPDATE schedule_entries se
SET sales_rep_user_id = s.user_id
FROM sales_reps s
WHERE se.sales_rep_id = s.id
  AND se.sales_rep_user_id IS NULL;

-- ============================================================
-- STEP 4: Add FK constraints to auth.users
-- ============================================================

-- service_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_requests_assigned_rep_user'
  ) THEN
    ALTER TABLE service_requests
      ADD CONSTRAINT fk_service_requests_assigned_rep_user
      FOREIGN KEY (assigned_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_requests_assessment_rep_user'
  ) THEN
    ALTER TABLE service_requests
      ADD CONSTRAINT fk_service_requests_assessment_rep_user
      FOREIGN KEY (assessment_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quotes_sales_rep_user'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT fk_quotes_sales_rep_user
      FOREIGN KEY (sales_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_assigned_rep_user'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT fk_jobs_assigned_rep_user
      FOREIGN KEY (assigned_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_assigned_rep_user'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT fk_projects_assigned_rep_user
      FOREIGN KEY (assigned_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- schedule_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedule_entries_sales_rep_user'
  ) THEN
    ALTER TABLE schedule_entries
      ADD CONSTRAINT fk_schedule_entries_sales_rep_user
      FOREIGN KEY (sales_rep_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- STEP 5: Create indexes for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_rep_user ON service_requests(assigned_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_assessment_rep_user ON service_requests(assessment_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_sales_rep_user ON quotes(sales_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_rep_user ON jobs(assigned_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_rep_user ON projects(assigned_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_sales_rep_user ON schedule_entries(sales_rep_user_id);

-- ============================================================
-- STEP 6: Update territories_with_reps view to use fsm_territory_coverage
-- ============================================================
DROP VIEW IF EXISTS territories_with_reps;

CREATE VIEW territories_with_reps
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.name,
  t.code,
  t.zip_codes,
  t.business_unit_id,
  t.location_code,
  t.disabled_qbo_class_ids,
  t.color,
  t.description,
  t.geometry,
  t.is_active,
  t.created_at,
  t.updated_at,
  -- Get location info
  l.name as location_name,
  -- Aggregate assigned reps from fsm_territory_coverage
  COALESCE(
    (SELECT json_agg(json_build_object(
      'user_id', tc.user_id,
      'name', COALESCE(up.full_name, up.email),
      'is_primary', tc.is_primary,
      'coverage_days', tc.coverage_days
    ))
    FROM fsm_territory_coverage tc
    JOIN user_profiles up ON up.id = tc.user_id
    WHERE tc.territory_id = t.id AND tc.is_active = true),
    '[]'::json
  ) AS assigned_reps
FROM territories t
LEFT JOIN locations l ON l.code = t.location_code;

-- ============================================================
-- STEP 7: Mark sales_reps table as deprecated (comment)
-- ============================================================
COMMENT ON TABLE sales_reps IS 'DEPRECATED: Use fsm_team_profiles + user_profiles instead. Old FK columns (*_rep_id) are being replaced with *_rep_user_id columns that reference auth.users directly.';

-- ============================================================
-- NOTE: Old columns (assigned_rep_id, sales_rep_id, assessment_rep_id)
-- are kept for backward compatibility. They will be dropped in a future
-- migration after all code is updated to use the new *_user_id columns.
-- ============================================================

-- Verification queries (run manually):
-- SELECT id, assigned_rep_id, assigned_rep_user_id FROM service_requests WHERE assigned_rep_id IS NOT NULL LIMIT 5;
-- SELECT id, sales_rep_id, sales_rep_user_id FROM quotes WHERE sales_rep_id IS NOT NULL LIMIT 5;
-- SELECT id, assigned_rep_id, assigned_rep_user_id FROM jobs WHERE assigned_rep_id IS NOT NULL LIMIT 5;
