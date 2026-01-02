-- Migration 202: Project Foundation
-- Enhances the projects table to be the primary container for FSM entities

-- ============================================
-- 1. Add new columns to projects table
-- ============================================

-- Property reference (address lives here, not duplicated)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Accepted quote tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;

-- Warranty/follow-up linking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS relationship_type TEXT CHECK (relationship_type IN ('warranty', 'change_order', 'follow_up', 'phase'));

-- Source tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('request', 'direct_quote', 'phone', 'walk_in', 'referral', 'builder_portal'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES service_requests(id) ON DELETE SET NULL;

-- QBO Class (accounting category)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS qbo_class_id UUID REFERENCES qbo_classes(id) ON DELETE SET NULL;

-- Assigned rep (person-centric)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_rep_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Description for the project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- 2. Create indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_source_request ON projects(source_request_id);
CREATE INDEX IF NOT EXISTS idx_projects_qbo_class ON projects(qbo_class_id);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_rep ON projects(assigned_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_accepted_quote ON projects(accepted_quote_id);

-- ============================================
-- 3. Add comments for documentation
-- ============================================

COMMENT ON COLUMN projects.property_id IS 'The property/address for this project. Address info comes from properties table.';
COMMENT ON COLUMN projects.accepted_quote_id IS 'The quote that was accepted for this project. Only one quote can be accepted.';
COMMENT ON COLUMN projects.parent_project_id IS 'For warranty/follow-up projects, points to the original project.';
COMMENT ON COLUMN projects.relationship_type IS 'Type of relationship to parent: warranty, change_order, follow_up, phase';
COMMENT ON COLUMN projects.source IS 'How this project originated: request, direct_quote, phone, walk_in, referral, builder_portal';
COMMENT ON COLUMN projects.source_request_id IS 'If source=request, the original service request ID';
COMMENT ON COLUMN projects.qbo_class_id IS 'QuickBooks class for accounting (replaces business_unit_id)';
COMMENT ON COLUMN projects.assigned_rep_user_id IS 'The sales rep assigned to this project (user_id from auth.users)';

-- ============================================
-- 4. Grant permissions
-- ============================================

-- Ensure RLS policies exist (projects table should already have them)
-- Just grant select on new view we'll create later

SELECT 'Migration 202 complete: Project foundation columns added';
