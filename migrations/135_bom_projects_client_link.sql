-- Link BOM Projects to Client Hub for pricing resolution
-- Phase 5 of O-027 Client Hub

-- Add client/community references to bom_projects (v1)
ALTER TABLE bom_projects
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pricing_source TEXT DEFAULT 'catalog'; -- 'catalog', 'rate_sheet', 'manual'

-- Add client/community references to bom_projects_v2
ALTER TABLE bom_projects_v2
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pricing_source TEXT DEFAULT 'catalog'; -- 'catalog', 'rate_sheet', 'manual'

-- Index for lookups (v1)
CREATE INDEX IF NOT EXISTS idx_bom_projects_client_id ON bom_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_bom_projects_community_id ON bom_projects(community_id);

-- Index for lookups (v2)
CREATE INDEX IF NOT EXISTS idx_bom_projects_v2_client_id ON bom_projects_v2(client_id);
CREATE INDEX IF NOT EXISTS idx_bom_projects_v2_community_id ON bom_projects_v2(community_id);

-- Add comments (v1)
COMMENT ON COLUMN bom_projects.client_id IS 'Optional link to Client Hub client for pricing';
COMMENT ON COLUMN bom_projects.community_id IS 'Optional link to community for rate sheet pricing';
COMMENT ON COLUMN bom_projects.pricing_source IS 'How prices were determined: catalog (base), rate_sheet (client/community), manual (override)';

-- Add comments (v2)
COMMENT ON COLUMN bom_projects_v2.client_id IS 'Optional link to Client Hub client for pricing';
COMMENT ON COLUMN bom_projects_v2.community_id IS 'Optional link to community for rate sheet pricing';
COMMENT ON COLUMN bom_projects_v2.pricing_source IS 'How prices were determined: catalog (base), rate_sheet (client/community), manual (override)';
