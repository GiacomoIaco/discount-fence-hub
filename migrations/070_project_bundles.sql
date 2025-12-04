-- Migration: Project Bundles
-- Adds bundle support to bom_projects for grouping projects with same yard/pickup/crew

-- Add bundle columns to bom_projects
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES bom_projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bundle_name TEXT;

-- Comments
COMMENT ON COLUMN bom_projects.is_bundle IS 'True if this project is a bundle (parent container)';
COMMENT ON COLUMN bom_projects.bundle_id IS 'If bundled, points to the parent bundle project';
COMMENT ON COLUMN bom_projects.bundle_name IS 'Display name for bundles';

-- Index for bundle lookups
CREATE INDEX IF NOT EXISTS idx_bom_projects_bundle ON bom_projects(bundle_id) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bom_projects_is_bundle ON bom_projects(is_bundle) WHERE is_bundle = true;

-- Function to get bundle totals (for display)
CREATE OR REPLACE FUNCTION get_bundle_totals(p_bundle_id UUID)
RETURNS TABLE (
  total_linear_feet DECIMAL,
  total_material_cost DECIMAL,
  total_labor_cost DECIMAL,
  total_project_cost DECIMAL,
  project_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(bp.total_linear_feet), 0)::DECIMAL as total_linear_feet,
    COALESCE(SUM(bp.total_material_cost), 0)::DECIMAL as total_material_cost,
    COALESCE(SUM(bp.total_labor_cost), 0)::DECIMAL as total_labor_cost,
    COALESCE(SUM(bp.total_project_cost), 0)::DECIMAL as total_project_cost,
    COUNT(*)::INT as project_count
  FROM bom_projects bp
  WHERE bp.bundle_id = p_bundle_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update bundle totals when child project changes
CREATE OR REPLACE FUNCTION update_bundle_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- When a bundled project is updated, update the bundle's totals
  IF NEW.bundle_id IS NOT NULL THEN
    UPDATE bom_projects
    SET
      total_linear_feet = (SELECT COALESCE(SUM(total_linear_feet), 0) FROM bom_projects WHERE bundle_id = NEW.bundle_id),
      total_material_cost = (SELECT COALESCE(SUM(total_material_cost), 0) FROM bom_projects WHERE bundle_id = NEW.bundle_id),
      total_labor_cost = (SELECT COALESCE(SUM(total_labor_cost), 0) FROM bom_projects WHERE bundle_id = NEW.bundle_id),
      total_project_cost = (SELECT COALESCE(SUM(total_project_cost), 0) FROM bom_projects WHERE bundle_id = NEW.bundle_id),
      updated_at = NOW()
    WHERE id = NEW.bundle_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_bundle_totals ON bom_projects;
CREATE TRIGGER trigger_update_bundle_totals
  AFTER INSERT OR UPDATE OF total_linear_feet, total_material_cost, total_labor_cost, total_project_cost, bundle_id
  ON bom_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_bundle_totals();
