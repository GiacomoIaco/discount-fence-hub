-- Migration 178: Project Jobs & Skills System
-- Enables multi-job projects with skill-based crew matching and flexible invoicing
-- Note: This adds a NEW skills system (skill_tags) alongside existing crew_skills (from migration 171)

-- ============================================
-- 1. SKILL TAGS TABLE (User-Definable Tags)
-- Separate from existing crew_skills (fence_type based) from migration 171
-- ============================================

CREATE TABLE IF NOT EXISTS skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280',  -- Hex color for UI badges

  -- Behavior flags
  triggers_pm BOOLEAN DEFAULT false,  -- Auto-suggest PM when this skill is required

  -- Organization
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_tags_active ON skill_tags(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_skill_tags_code ON skill_tags(code);

-- Seed some initial skill tags
INSERT INTO skill_tags (name, code, description, color, triggers_pm, display_order) VALUES
  ('Wood', 'WOOD', 'Wood fence installation', '#8B5A2B', false, 1),
  ('Iron', 'IRON', 'Iron/metal fence installation', '#4A5568', false, 2),
  ('Chain Link', 'CHAIN', 'Chain link fence installation', '#718096', false, 3),
  ('Vinyl', 'VINYL', 'Vinyl fence installation', '#E2E8F0', false, 4),
  ('Gate Automation', 'AUTOGATE', 'Automatic gate systems', '#3182CE', true, 5),
  ('Custom Work', 'CUSTOM', 'Custom/complex installations', '#9F7AEA', true, 6),
  ('Commercial', 'COMM', 'Commercial-grade installations', '#38A169', false, 7),
  ('Deck', 'DECK', 'Deck construction', '#D69E2E', false, 8)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. CREW SKILL TAGS JUNCTION
-- Links crews to skill_tags (separate from existing crew_skills table)
-- ============================================

CREATE TABLE IF NOT EXISTS crew_skill_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  skill_tag_id UUID NOT NULL REFERENCES skill_tags(id) ON DELETE CASCADE,

  -- Proficiency affects duration estimates
  proficiency VARCHAR(20) DEFAULT 'standard',  -- trainee, basic, standard, expert

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(crew_id, skill_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_skill_tags_crew ON crew_skill_tags(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_skill_tags_skill ON crew_skill_tags(skill_tag_id);

-- ============================================
-- 3. INVOICE GROUPS (For Combined Invoicing)
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_group_number_seq START 1;

CREATE TABLE IF NOT EXISTS invoice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_number VARCHAR(50) UNIQUE NOT NULL,

  -- Link to project
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Cached totals (updated when jobs change)
  total_value DECIMAL(12,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, ready, invoiced, partial

  -- Invoice link (when created)
  invoice_id UUID REFERENCES invoices(id),
  invoiced_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate invoice group number
CREATE OR REPLACE FUNCTION generate_invoice_group_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.group_number IS NULL THEN
    NEW.group_number := 'IG-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_group_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_invoice_group_number ON invoice_groups;
CREATE TRIGGER trigger_generate_invoice_group_number
  BEFORE INSERT ON invoice_groups
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_group_number();

CREATE INDEX IF NOT EXISTS idx_invoice_groups_project ON invoice_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_invoice_groups_status ON invoice_groups(status);

-- ============================================
-- 4. EXTEND JOBS TABLE
-- ============================================

-- Add fields for multi-job project support
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS project_type_id UUID REFERENCES project_types(id),
  ADD COLUMN IF NOT EXISTS skill_tag_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quote_line_item_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sequence_order INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS depends_on_job_id UUID REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS invoice_group_id UUID REFERENCES invoice_groups(id),
  ADD COLUMN IF NOT EXISTS pm_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pm_id UUID REFERENCES auth.users(id);

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_jobs_project_type ON jobs(project_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_skill_tags ON jobs USING GIN(skill_tag_ids);
CREATE INDEX IF NOT EXISTS idx_jobs_sequence ON jobs(project_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_jobs_depends_on ON jobs(depends_on_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_invoice_group ON jobs(invoice_group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_pm ON jobs(pm_id);

-- ============================================
-- 5. EXTEND PROJECTS TABLE
-- ============================================

-- Add invoice grouping default behavior
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS default_invoice_together BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS job_count INT DEFAULT 0;

-- ============================================
-- 6. JOB NUMBER FORMAT UPDATE
-- ============================================

-- Update job number to include suffix for multi-job projects
-- Format: JOB-2024-0001-A, JOB-2024-0001-B, etc.
-- This function generates the suffix based on project job count
CREATE OR REPLACE FUNCTION generate_job_number_with_suffix()
RETURNS TRIGGER AS $$
DECLARE
  v_base_number TEXT;
  v_job_count INT;
  v_suffix CHAR(1);
BEGIN
  IF NEW.job_number IS NULL THEN
    -- Get base number
    v_base_number := 'JOB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('job_number_seq')::TEXT, 4, '0');

    -- If part of a project with multiple jobs, add suffix
    IF NEW.project_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_job_count FROM jobs WHERE project_id = NEW.project_id;
      IF v_job_count > 0 THEN
        v_suffix := CHR(65 + v_job_count);  -- A, B, C, etc.
        v_base_number := v_base_number || '-' || v_suffix;
      END IF;
    END IF;

    NEW.job_number := v_base_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Keep existing trigger for backwards compatibility
-- New jobs in multi-job projects will use the suffix format

-- ============================================
-- 7. HELPER FUNCTION: CREATE INVOICE GROUP
-- ============================================

CREATE OR REPLACE FUNCTION create_invoice_group_for_project(p_project_id UUID)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_total DECIMAL(12,2);
BEGIN
  -- Calculate total from project jobs
  SELECT COALESCE(SUM(estimated_value), 0) INTO v_total
  FROM jobs WHERE project_id = p_project_id;

  -- Create invoice group
  INSERT INTO invoice_groups (project_id, total_value)
  VALUES (p_project_id, v_total)
  RETURNING id INTO v_group_id;

  -- Link all project jobs to this group
  UPDATE jobs SET invoice_group_id = v_group_id
  WHERE project_id = p_project_id AND invoice_group_id IS NULL;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. UPDATE PROJECT JOB COUNT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_project_job_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE projects SET job_count = (
      SELECT COUNT(*) FROM jobs WHERE project_id = NEW.project_id
    ) WHERE id = NEW.project_id;
  END IF;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id) THEN
    UPDATE projects SET job_count = (
      SELECT COUNT(*) FROM jobs WHERE project_id = OLD.project_id
    ) WHERE id = OLD.project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_job_count ON jobs;
CREATE TRIGGER trigger_update_project_job_count
  AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_project_job_count();

-- ============================================
-- 9. VIEW: JOBS WITH FULL CONTEXT
-- ============================================

CREATE OR REPLACE VIEW jobs_with_context AS
SELECT
  j.*,
  p.project_number,
  p.name AS project_name,
  p.job_count AS project_job_count,
  c.name AS client_name,
  c.code AS client_code,
  comm.name AS community_name,
  cr.name AS crew_name,
  cr.code AS crew_code,
  pt.name AS project_type_name,
  ig.group_number AS invoice_group_number,
  ig.status AS invoice_group_status,
  CASE WHEN j.depends_on_job_id IS NOT NULL THEN
    (SELECT job_number FROM jobs WHERE id = j.depends_on_job_id)
  END AS depends_on_job_number
FROM jobs j
LEFT JOIN projects p ON j.project_id = p.id
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN communities comm ON j.community_id = comm.id
LEFT JOIN crews cr ON j.assigned_crew_id = cr.id
LEFT JOIN project_types pt ON j.project_type_id = pt.id
LEFT JOIN invoice_groups ig ON j.invoice_group_id = ig.id;

-- ============================================
-- 10. RLS POLICIES
-- ============================================

ALTER TABLE skill_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_skill_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_groups ENABLE ROW LEVEL SECURITY;

-- Skill tags policies
DROP POLICY IF EXISTS "skill_tags_read" ON skill_tags;
CREATE POLICY "skill_tags_read" ON skill_tags FOR SELECT USING (true);
DROP POLICY IF EXISTS "skill_tags_write" ON skill_tags;
CREATE POLICY "skill_tags_write" ON skill_tags FOR ALL USING (auth.role() = 'authenticated');

-- Crew skill tags policies
DROP POLICY IF EXISTS "crew_skill_tags_read" ON crew_skill_tags;
CREATE POLICY "crew_skill_tags_read" ON crew_skill_tags FOR SELECT USING (true);
DROP POLICY IF EXISTS "crew_skill_tags_write" ON crew_skill_tags;
CREATE POLICY "crew_skill_tags_write" ON crew_skill_tags FOR ALL USING (auth.role() = 'authenticated');

-- Invoice groups policies
DROP POLICY IF EXISTS "invoice_groups_read" ON invoice_groups;
CREATE POLICY "invoice_groups_read" ON invoice_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "invoice_groups_write" ON invoice_groups;
CREATE POLICY "invoice_groups_write" ON invoice_groups FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 11. COMMENTS
-- ============================================

COMMENT ON TABLE skill_tags IS 'User-definable skill tags for crew matching';
COMMENT ON COLUMN skill_tags.triggers_pm IS 'When true, jobs requiring this skill auto-suggest PM assignment';
COMMENT ON TABLE crew_skill_tags IS 'Links crews to their skill tags/certifications';
COMMENT ON TABLE invoice_groups IS 'Groups multiple jobs for combined invoicing';
COMMENT ON COLUMN jobs.name IS 'Friendly name for the job (e.g., "Fence Install", "Auto Gate")';
COMMENT ON COLUMN jobs.skill_tag_ids IS 'Required skill tags for this job';
COMMENT ON COLUMN jobs.quote_line_item_ids IS 'Which quote line items this job covers';
COMMENT ON COLUMN jobs.sequence_order IS 'Order within project (1=first, 2=after 1, etc.)';
COMMENT ON COLUMN jobs.depends_on_job_id IS 'Job that must complete before this one starts';
COMMENT ON COLUMN jobs.invoice_group_id IS 'Groups jobs for combined invoicing';
COMMENT ON COLUMN projects.default_invoice_together IS 'When true, all jobs in project share same invoice group';
