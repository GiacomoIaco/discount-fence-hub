-- Migration: 093_yard_claim_workflow.sql
-- Description: Add claim workflow for yard workers to self-assign projects
-- Supports paper-first workflow where workers grab printed pick lists and claim via app

-- ============================================
-- 1. ADD CLAIM FIELDS TO bom_projects
-- ============================================

-- Who claimed this project (self-assignment by yard worker)
ALTER TABLE bom_projects ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);
ALTER TABLE bom_projects ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- When picking actually started (first item checked)
ALTER TABLE bom_projects ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN bom_projects.claimed_by IS 'Yard worker who claimed this project (self-assigned via code entry)';
COMMENT ON COLUMN bom_projects.claimed_at IS 'When the project was claimed';
COMMENT ON COLUMN bom_projects.picking_started_at IS 'When the worker started picking items';

-- Index for quick lookup of claimed projects by user
CREATE INDEX IF NOT EXISTS idx_bom_projects_claimed_by ON bom_projects(claimed_by) WHERE claimed_by IS NOT NULL;

-- ============================================
-- 2. CREATE pick_progress TABLE
-- ============================================
-- Tracks which items have been picked for each project
-- Persists the checkbox state from the interactive pick list

CREATE TABLE IF NOT EXISTS pick_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,

  -- Quantities
  required_quantity NUMERIC NOT NULL DEFAULT 0,
  picked_quantity NUMERIC NOT NULL DEFAULT 0,

  -- Status
  is_complete BOOLEAN NOT NULL DEFAULT false,

  -- Who picked and when
  picked_by UUID REFERENCES auth.users(id),
  picked_at TIMESTAMPTZ,

  -- Notes (e.g., "couldn't find 2, substituted with...")
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One entry per material per project
  UNIQUE(project_id, material_id)
);

-- Comments
COMMENT ON TABLE pick_progress IS 'Tracks picking progress for each material in a project pick list';
COMMENT ON COLUMN pick_progress.required_quantity IS 'How many units needed (from project_materials)';
COMMENT ON COLUMN pick_progress.picked_quantity IS 'How many units actually picked';
COMMENT ON COLUMN pick_progress.is_complete IS 'True when item is fully picked';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pick_progress_project ON pick_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_pick_progress_picked_by ON pick_progress(picked_by) WHERE picked_by IS NOT NULL;

-- ============================================
-- 3. RLS POLICIES FOR pick_progress
-- ============================================

ALTER TABLE pick_progress ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view pick progress
CREATE POLICY "pick_progress_select"
ON pick_progress FOR SELECT
TO authenticated
USING (true);

-- Anyone authenticated can insert pick progress
CREATE POLICY "pick_progress_insert"
ON pick_progress FOR INSERT
TO authenticated
WITH CHECK (true);

-- Anyone authenticated can update pick progress
CREATE POLICY "pick_progress_update"
ON pick_progress FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Anyone authenticated can delete pick progress
CREATE POLICY "pick_progress_delete"
ON pick_progress FOR DELETE
TO authenticated
USING (true);

-- ============================================
-- 4. HELPER FUNCTION: Claim Project
-- ============================================

CREATE OR REPLACE FUNCTION claim_project(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_project RECORD;
  v_claimer RECORD;
BEGIN
  -- Get current project state
  SELECT id, project_code, project_name, status, claimed_by, claimed_at
  INTO v_project
  FROM bom_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Check if already claimed by someone else
  IF v_project.claimed_by IS NOT NULL AND v_project.claimed_by != p_user_id THEN
    -- Get claimer info
    SELECT full_name, email INTO v_claimer
    FROM user_profiles
    WHERE id = v_project.claimed_by;

    RETURN json_build_object(
      'success', false,
      'error', 'already_claimed',
      'claimed_by_name', COALESCE(v_claimer.full_name, v_claimer.email),
      'claimed_at', v_project.claimed_at
    );
  END IF;

  -- Check if already claimed by same user (just continue)
  IF v_project.claimed_by = p_user_id THEN
    RETURN json_build_object(
      'success', true,
      'message', 'continue',
      'project_id', v_project.id,
      'project_code', v_project.project_code,
      'project_name', v_project.project_name
    );
  END IF;

  -- Claim the project
  UPDATE bom_projects
  SET
    claimed_by = p_user_id,
    claimed_at = NOW(),
    status = CASE WHEN status = 'sent_to_yard' THEN 'picking' ELSE status END,
    updated_at = NOW()
  WHERE id = p_project_id;

  RETURN json_build_object(
    'success', true,
    'message', 'claimed',
    'project_id', v_project.id,
    'project_code', v_project.project_code,
    'project_name', v_project.project_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. HELPER FUNCTION: Release Project
-- ============================================

CREATE OR REPLACE FUNCTION release_project(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_project RECORD;
BEGIN
  -- Get current project state
  SELECT id, project_code, claimed_by, status
  INTO v_project
  FROM bom_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Project not found');
  END IF;

  -- Only the claimer can release (or if unclaimed)
  IF v_project.claimed_by IS NOT NULL AND v_project.claimed_by != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Not your project to release');
  END IF;

  -- Release the project (keep pick_progress for next person)
  UPDATE bom_projects
  SET
    claimed_by = NULL,
    claimed_at = NULL,
    status = CASE WHEN status = 'picking' THEN 'sent_to_yard' ELSE status END,
    updated_at = NOW()
  WHERE id = p_project_id;

  RETURN json_build_object('success', true, 'message', 'released');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. HELPER FUNCTION: Get Pick Progress Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_pick_progress_summary(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total INTEGER;
  v_picked INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_complete = true)
  INTO v_total, v_picked
  FROM pick_progress
  WHERE project_id = p_project_id;

  -- If no progress records, count from project_materials
  IF v_total = 0 THEN
    SELECT COUNT(*) INTO v_total
    FROM project_materials
    WHERE project_id = p_project_id;
  END IF;

  RETURN json_build_object(
    'total_items', COALESCE(v_total, 0),
    'picked_items', COALESCE(v_picked, 0),
    'percent', CASE WHEN v_total > 0 THEN ROUND((v_picked::NUMERIC / v_total) * 100) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. UPDATE v_yard_schedule VIEW
-- ============================================
-- Add claim info and pick progress to the view
-- Must DROP and recreate because we're adding new columns

DROP VIEW IF EXISTS v_yard_schedule;
CREATE VIEW v_yard_schedule AS
SELECT
  bp.id,
  bp.project_code,
  bp.project_name,
  bp.customer_name,
  bp.customer_address,
  bp.expected_pickup_date,
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
ORDER BY bp.expected_pickup_date, bp.project_code;

-- ============================================
-- 8. TRIGGER: Update updated_at on pick_progress
-- ============================================

CREATE OR REPLACE FUNCTION update_pick_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pick_progress_updated_at ON pick_progress;
CREATE TRIGGER trigger_pick_progress_updated_at
  BEFORE UPDATE ON pick_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_pick_progress_updated_at();
