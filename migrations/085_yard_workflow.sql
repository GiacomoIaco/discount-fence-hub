-- Migration: Yard Workflow
-- Adds: yard_spots, project_code, project_signoffs, status history tracking
-- Phase 3 of BOM Calculator HUB Roadmap

-- ============================================
-- 1. YARD SPOTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS yard_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  spot_code TEXT NOT NULL, -- 'A1', 'B2', etc.
  spot_name TEXT, -- Optional friendly name
  is_occupied BOOLEAN DEFAULT false,
  occupied_by_project_id UUID REFERENCES bom_projects(id) ON DELETE SET NULL,
  occupied_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(yard_id, spot_code)
);

-- Comments
COMMENT ON TABLE yard_spots IS 'Staging spots in each yard where materials are staged for pickup';
COMMENT ON COLUMN yard_spots.spot_code IS 'Short code visible on the spot (A1, B2, etc)';
COMMENT ON COLUMN yard_spots.is_occupied IS 'True if a project is currently staged at this spot';
COMMENT ON COLUMN yard_spots.occupied_by_project_id IS 'The project/bundle currently staged at this spot';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_yard_spots_yard ON yard_spots(yard_id);
CREATE INDEX IF NOT EXISTS idx_yard_spots_occupied ON yard_spots(is_occupied) WHERE is_occupied = true;

-- ============================================
-- 2. SEED DEFAULT SPOTS FOR EACH YARD
-- ============================================

-- Get yard IDs and create 5 default spots for each
DO $$
DECLARE
  yard_record RECORD;
  spot_num INTEGER;
BEGIN
  FOR yard_record IN SELECT id, code FROM yards WHERE is_active = true LOOP
    FOR spot_num IN 1..5 LOOP
      INSERT INTO yard_spots (yard_id, spot_code, spot_name, display_order)
      VALUES (
        yard_record.id,
        'S' || spot_num,
        'Spot ' || spot_num,
        spot_num
      )
      ON CONFLICT (yard_id, spot_code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 3. PROJECT CODE FIELD
-- ============================================

-- Add project_code to bom_projects (ABC-123 format)
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS project_code TEXT UNIQUE;

COMMENT ON COLUMN bom_projects.project_code IS 'Unique visible code in ABC-123 format for easy identification';

-- Add yard_spot_id to track which spot a project is staged at
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS yard_spot_id UUID REFERENCES yard_spots(id) ON DELETE SET NULL;

COMMENT ON COLUMN bom_projects.yard_spot_id IS 'Which yard spot this project is staged at';

-- Add customer_address if not exists
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- ============================================
-- 4. PROJECT CODE SEQUENCE
-- ============================================

-- Sequence for project code numbers (resets yearly if desired)
CREATE SEQUENCE IF NOT EXISTS project_code_seq START 1;

-- Function to generate project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
  letter_part TEXT;
  number_part INTEGER;
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Get next sequence number
    number_part := nextval('project_code_seq');

    -- Calculate letter part (AAA, AAB, AAC, ... ZZZ)
    -- Each letter combo supports 999 numbers
    letter_part := CHR(65 + ((number_part - 1) / 999 / 26 / 26) % 26) ||
                   CHR(65 + ((number_part - 1) / 999 / 26) % 26) ||
                   CHR(65 + ((number_part - 1) / 999) % 26);

    -- Format: ABC-001
    new_code := letter_part || '-' || LPAD(((number_part - 1) % 999 + 1)::TEXT, 3, '0');

    -- Check if code already exists (shouldn't happen, but safety check)
    IF NOT EXISTS (SELECT 1 FROM bom_projects WHERE project_code = new_code) THEN
      RETURN new_code;
    END IF;

    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique project code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate project_code on insert
CREATE OR REPLACE FUNCTION set_project_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_code IS NULL THEN
    NEW.project_code := generate_project_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_project_code ON bom_projects;
CREATE TRIGGER trigger_set_project_code
  BEFORE INSERT ON bom_projects
  FOR EACH ROW
  EXECUTE FUNCTION set_project_code();

-- ============================================
-- 5. BACKFILL EXISTING PROJECTS WITH CODES
-- ============================================

-- Generate codes for existing projects that don't have one
UPDATE bom_projects
SET project_code = generate_project_code()
WHERE project_code IS NULL;

-- ============================================
-- 6. PROJECT SIGNOFFS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS project_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,

  -- Sign-off details
  crew_name TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  is_partial_pickup BOOLEAN DEFAULT false,
  partial_pickup_notes TEXT,

  -- Photo
  photo_url TEXT,
  photo_path TEXT, -- Storage path for Supabase storage

  -- Location metadata
  gps_latitude DECIMAL(10, 7),
  gps_longitude DECIMAL(10, 7),

  -- Tracking
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE project_signoffs IS 'Crew sign-off records with photo proof of material pickup';
COMMENT ON COLUMN project_signoffs.is_partial_pickup IS 'True if crew only took part of the materials';
COMMENT ON COLUMN project_signoffs.photo_path IS 'Path in Supabase storage bucket for the signed pick list photo';

-- Index for looking up signoffs by project
CREATE INDEX IF NOT EXISTS idx_project_signoffs_project ON project_signoffs(project_id);

-- ============================================
-- 7. PROJECT STATUS HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES bom_projects(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  -- Additional context
  yard_spot_id UUID REFERENCES yard_spots(id),
  signoff_id UUID REFERENCES project_signoffs(id)
);

COMMENT ON TABLE project_status_history IS 'Audit trail of project status changes';

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_project_status_history_project ON project_status_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_status_history_changed_at ON project_status_history(changed_at DESC);

-- Trigger to record status changes
CREATE OR REPLACE FUNCTION record_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_status_history (project_id, old_status, new_status, changed_by, yard_spot_id)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_by, NEW.yard_spot_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_status_change ON bom_projects;
CREATE TRIGGER trigger_record_status_change
  AFTER UPDATE OF status ON bom_projects
  FOR EACH ROW
  EXECUTE FUNCTION record_project_status_change();

-- ============================================
-- 8. HELPER FUNCTION: Clear yard spot when project loaded
-- ============================================

CREATE OR REPLACE FUNCTION clear_yard_spot_on_load()
RETURNS TRIGGER AS $$
BEGIN
  -- When project status changes to 'loaded' or 'completed', clear the spot
  IF NEW.status IN ('loaded', 'completed') AND OLD.status NOT IN ('loaded', 'completed') THEN
    -- Clear the spot
    IF NEW.yard_spot_id IS NOT NULL THEN
      UPDATE yard_spots
      SET is_occupied = false,
          occupied_by_project_id = NULL,
          occupied_at = NULL,
          updated_at = NOW()
      WHERE id = NEW.yard_spot_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clear_spot_on_load ON bom_projects;
CREATE TRIGGER trigger_clear_spot_on_load
  AFTER UPDATE OF status ON bom_projects
  FOR EACH ROW
  EXECUTE FUNCTION clear_yard_spot_on_load();

-- ============================================
-- 9. HELPER FUNCTION: Assign project to spot
-- ============================================

CREATE OR REPLACE FUNCTION assign_project_to_spot(
  p_project_id UUID,
  p_spot_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_old_spot_id UUID;
BEGIN
  -- Get current spot if any
  SELECT yard_spot_id INTO v_old_spot_id
  FROM bom_projects WHERE id = p_project_id;

  -- Clear old spot if different
  IF v_old_spot_id IS NOT NULL AND v_old_spot_id != p_spot_id THEN
    UPDATE yard_spots
    SET is_occupied = false,
        occupied_by_project_id = NULL,
        occupied_at = NULL,
        updated_at = NOW()
    WHERE id = v_old_spot_id;
  END IF;

  -- Check if new spot is available
  IF EXISTS (SELECT 1 FROM yard_spots WHERE id = p_spot_id AND is_occupied = true AND occupied_by_project_id != p_project_id) THEN
    RAISE EXCEPTION 'Spot is already occupied by another project';
  END IF;

  -- Assign to new spot
  UPDATE yard_spots
  SET is_occupied = true,
      occupied_by_project_id = p_project_id,
      occupied_at = NOW(),
      updated_at = NOW()
  WHERE id = p_spot_id;

  -- Update project
  UPDATE bom_projects
  SET yard_spot_id = p_spot_id,
      updated_at = NOW()
  WHERE id = p_project_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. VIEW: Yard Schedule
-- ============================================

CREATE OR REPLACE VIEW v_yard_schedule AS
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
  END as bundle_projects
FROM bom_projects bp
LEFT JOIN yards y ON y.id = bp.yard_id
LEFT JOIN yard_spots ys ON ys.id = bp.yard_spot_id
WHERE bp.bundle_id IS NULL -- Don't show projects that are part of a bundle (show the bundle instead)
  AND bp.status NOT IN ('cancelled', 'archived', 'draft')
ORDER BY bp.expected_pickup_date, bp.project_code;

-- ============================================
-- 11. VIEW: Pick List Materials (aggregated for bundles)
-- ============================================

CREATE OR REPLACE VIEW v_pick_list AS
SELECT
  -- If bundled, use bundle ID, otherwise project ID
  COALESCE(bp.bundle_id, bp.id) as pickup_id,
  COALESCE(bundle.project_code, bp.project_code) as pickup_code,
  COALESCE(bundle.project_name, bp.project_name) as pickup_name,
  COALESCE(bundle.is_bundle, false) as is_bundle,

  -- Material info (aggregated)
  pm.material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_type,
  SUM(pm.quantity) as total_quantity,

  -- Project context
  bp.yard_id,
  bp.expected_pickup_date

FROM bom_projects bp
LEFT JOIN bom_projects bundle ON bundle.id = bp.bundle_id
INNER JOIN project_materials pm ON pm.project_id = bp.id
INNER JOIN materials m ON m.id = pm.material_id
WHERE bp.status NOT IN ('cancelled', 'archived', 'draft', 'completed')
GROUP BY
  COALESCE(bp.bundle_id, bp.id),
  COALESCE(bundle.project_code, bp.project_code),
  COALESCE(bundle.project_name, bp.project_name),
  COALESCE(bundle.is_bundle, false),
  pm.material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_type,
  bp.yard_id,
  bp.expected_pickup_date
ORDER BY m.category, m.material_name;

-- ============================================
-- 12. RLS POLICIES
-- ============================================

ALTER TABLE yard_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_status_history ENABLE ROW LEVEL SECURITY;

-- Yard spots: Anyone authenticated can view and modify
CREATE POLICY "Anyone can view yard_spots"
  ON yard_spots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can modify yard_spots"
  ON yard_spots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Project signoffs: Anyone authenticated can view and create
CREATE POLICY "Anyone can view project_signoffs"
  ON project_signoffs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can create project_signoffs"
  ON project_signoffs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Status history: Anyone can view
CREATE POLICY "Anyone can view project_status_history"
  ON project_status_history FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 13. STORAGE BUCKET FOR SIGNOFF PHOTOS
-- ============================================

-- Note: Run this in Supabase dashboard or via supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('signoff-photos', 'signoff-photos', true);

-- ============================================
-- 14. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bom_projects_project_code ON bom_projects(project_code);
CREATE INDEX IF NOT EXISTS idx_bom_projects_yard_spot ON bom_projects(yard_spot_id);

-- ============================================
-- 15. TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_yard_spots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_yard_spots_updated_at ON yard_spots;
CREATE TRIGGER trigger_yard_spots_updated_at
  BEFORE UPDATE ON yard_spots
  FOR EACH ROW
  EXECUTE FUNCTION update_yard_spots_updated_at();
