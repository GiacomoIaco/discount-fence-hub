-- Migration 230: Unified Permission System
-- Creates a role-based access control (RBAC) system with section access and feature permissions

-- ============================================================================
-- PART 1: Core Definition Tables
-- ============================================================================

-- App Roles (9 roles)
CREATE TABLE IF NOT EXISTS app_roles (
  role_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  hierarchy_level INT NOT NULL,  -- Lower = more access (1=owner, 9=crew)
  is_system_role BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Section Codes (all app sections)
CREATE TABLE IF NOT EXISTS section_codes (
  section_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  hub TEXT,  -- which hub it belongs to
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permission Codes
CREATE TABLE IF NOT EXISTS permission_codes (
  permission_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT,  -- financial, editing, workflow, admin
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PART 2: Role Assignment Tables
-- ============================================================================

-- Role → Section Access
CREATE TABLE IF NOT EXISTS role_section_access (
  role_key TEXT REFERENCES app_roles(role_key) ON DELETE CASCADE,
  section_key TEXT REFERENCES section_codes(section_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, section_key)
);

-- Role → Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key TEXT REFERENCES app_roles(role_key) ON DELETE CASCADE,
  permission_key TEXT REFERENCES permission_codes(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- ============================================================================
-- PART 3: User Assignment Tables
-- ============================================================================

-- User Role Assignment
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES app_roles(role_key),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id)
);

-- User Permission Overrides (for exceptions like "Builder Rep" = sales_rep - discounts)
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT REFERENCES permission_codes(permission_key) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('grant', 'revoke')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (user_id, permission_key)
);

-- ============================================================================
-- PART 4: Seed App Roles
-- ============================================================================

INSERT INTO app_roles (role_key, display_name, description, hierarchy_level) VALUES
  ('owner', 'Owner', 'Business owner with full access to all features', 1),
  ('admin', 'Admin', 'Administrator with full system access', 2),
  ('sales_manager', 'Sales Manager', 'Manages sales team, approves quotes, views financials', 3),
  ('sales_rep', 'Sales Rep', 'Creates quotes, manages client relationships (no cost visibility)', 4),
  ('front_desk', 'Front Desk', 'Handles incoming requests, schedules, client communication', 5),
  ('ops_manager', 'Ops Manager', 'Manages operations team, jobs, scheduling, yard', 6),
  ('operations', 'Operations', 'Works on jobs, schedules, yard operations', 7),
  ('yard', 'Yard', 'Manages yard inventory and staging', 8),
  ('crew', 'Crew', 'Field workers - view assigned jobs and schedule only', 9)
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level;

-- ============================================================================
-- PART 5: Seed Section Codes
-- ============================================================================

INSERT INTO section_codes (section_key, display_name, hub, description) VALUES
  -- FSM Hub
  ('requests', 'Requests', 'fsm', 'Incoming service requests and leads'),
  ('quotes', 'Quotes', 'fsm', 'Quote creation and management'),
  ('jobs', 'Jobs', 'fsm', 'Job scheduling and execution'),
  ('invoices', 'Invoices', 'fsm', 'Billing and payment collection'),
  ('schedule', 'Schedule', 'fsm', 'Calendar and scheduling'),
  ('projects', 'Projects', 'fsm', 'Project overview and management'),

  -- Client Hub
  ('clients', 'Clients', 'clients', 'Client database and CRM'),
  ('properties', 'Properties', 'clients', 'Property management'),

  -- Ops Hub
  ('calculator', 'Calculator', 'ops', 'BOM and pricing calculator'),
  ('yard', 'Yard', 'ops', 'Yard inventory and staging'),

  -- Sales Hub
  ('sales-coach', 'Sales Coach', 'sales', 'AI sales assistance'),
  ('presentation', 'Presentation', 'sales', 'Sales presentation tools'),
  ('survey', 'Survey', 'sales', 'Property survey tools'),
  ('photo-gallery', 'Photo Gallery', 'sales', 'Project photos and galleries'),
  ('resources', 'Resources', 'sales', 'Sales resources and documents'),

  -- Communication
  ('chat', 'Chat', 'communication', 'Team messaging'),
  ('notifications', 'Notifications', 'communication', 'System notifications'),

  -- Analytics
  ('analytics', 'Analytics', 'analytics', 'Reports and dashboards'),

  -- Leadership
  ('leadership', 'Leadership', 'leadership', 'Leadership hub and projects'),
  ('roadmap', 'Roadmap', 'leadership', 'Product roadmap'),

  -- Settings
  ('settings', 'Settings', 'admin', 'System settings'),
  ('team', 'Team', 'admin', 'Team management'),
  ('users', 'Users', 'admin', 'User management'),

  -- Help
  ('help', 'Help', 'help', 'Help and documentation')
ON CONFLICT (section_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  hub = EXCLUDED.hub,
  description = EXCLUDED.description;

-- ============================================================================
-- PART 6: Seed Permission Codes
-- ============================================================================

INSERT INTO permission_codes (permission_key, display_name, category, description) VALUES
  -- Financial Permissions
  ('view_costs', 'View Costs', 'financial', 'See material and labor costs'),
  ('view_margins', 'View Margins', 'financial', 'See profit margins on quotes/jobs'),
  ('view_profitability', 'View Profitability', 'financial', 'See full profitability breakdown'),
  ('view_analytics', 'View Analytics', 'financial', 'Access analytics and reports'),

  -- Editing Permissions
  ('edit_prices', 'Edit Prices', 'editing', 'Modify prices on quotes/invoices'),
  ('give_discounts', 'Give Discounts', 'editing', 'Apply discounts to quotes'),
  ('edit_costs', 'Edit Costs', 'editing', 'Modify cost values'),

  -- Workflow Permissions
  ('approve_quotes', 'Approve Quotes', 'workflow', 'Approve quotes for sending'),
  ('create_invoices', 'Create Invoices', 'workflow', 'Generate invoices from jobs'),
  ('record_payments', 'Record Payments', 'workflow', 'Record payment transactions'),
  ('manage_schedule', 'Manage Schedule', 'workflow', 'Create and modify schedule entries'),
  ('assign_crews', 'Assign Crews', 'workflow', 'Assign crews to jobs'),
  ('convert_entities', 'Convert Entities', 'workflow', 'Convert request→quote→job→invoice'),

  -- Operations Permissions
  ('manage_yard', 'Manage Yard', 'operations', 'Full yard management access'),
  ('view_yard', 'View Yard', 'operations', 'View yard status'),
  ('manage_inventory', 'Manage Inventory', 'operations', 'Manage material inventory'),

  -- Admin Permissions
  ('manage_team', 'Manage Team', 'admin', 'Add/edit team members'),
  ('manage_roles', 'Manage Roles', 'admin', 'Assign roles and permissions'),
  ('manage_settings', 'Manage Settings', 'admin', 'Modify system settings'),
  ('export_data', 'Export Data', 'admin', 'Export data from system'),
  ('view_all_bus', 'View All BUs', 'admin', 'Access all business units'),
  ('manage_integrations', 'Manage Integrations', 'admin', 'Configure integrations (QBO, etc.)')
ON CONFLICT (permission_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ============================================================================
-- PART 7: Seed Role Section Access
-- ============================================================================

-- Owner & Admin get all sections (we'll handle via hierarchy check in code)
-- But we also seed explicit access for completeness

-- Owner - all sections
INSERT INTO role_section_access (role_key, section_key)
SELECT 'owner', section_key FROM section_codes
ON CONFLICT DO NOTHING;

-- Admin - all sections
INSERT INTO role_section_access (role_key, section_key)
SELECT 'admin', section_key FROM section_codes
ON CONFLICT DO NOTHING;

-- Sales Manager
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('sales_manager', 'requests'),
  ('sales_manager', 'quotes'),
  ('sales_manager', 'jobs'),
  ('sales_manager', 'invoices'),
  ('sales_manager', 'schedule'),
  ('sales_manager', 'projects'),
  ('sales_manager', 'clients'),
  ('sales_manager', 'properties'),
  ('sales_manager', 'calculator'),
  ('sales_manager', 'sales-coach'),
  ('sales_manager', 'presentation'),
  ('sales_manager', 'survey'),
  ('sales_manager', 'photo-gallery'),
  ('sales_manager', 'resources'),
  ('sales_manager', 'chat'),
  ('sales_manager', 'analytics'),
  ('sales_manager', 'team')
ON CONFLICT DO NOTHING;

-- Sales Rep
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('sales_rep', 'requests'),
  ('sales_rep', 'quotes'),
  ('sales_rep', 'schedule'),
  ('sales_rep', 'projects'),
  ('sales_rep', 'clients'),
  ('sales_rep', 'properties'),
  ('sales_rep', 'calculator'),
  ('sales_rep', 'sales-coach'),
  ('sales_rep', 'presentation'),
  ('sales_rep', 'survey'),
  ('sales_rep', 'photo-gallery'),
  ('sales_rep', 'resources'),
  ('sales_rep', 'chat')
ON CONFLICT DO NOTHING;

-- Front Desk
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('front_desk', 'requests'),
  ('front_desk', 'schedule'),
  ('front_desk', 'clients'),
  ('front_desk', 'properties'),
  ('front_desk', 'chat'),
  ('front_desk', 'notifications')
ON CONFLICT DO NOTHING;

-- Ops Manager
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('ops_manager', 'jobs'),
  ('ops_manager', 'invoices'),
  ('ops_manager', 'schedule'),
  ('ops_manager', 'projects'),
  ('ops_manager', 'yard'),
  ('ops_manager', 'chat'),
  ('ops_manager', 'analytics'),
  ('ops_manager', 'team')
ON CONFLICT DO NOTHING;

-- Operations
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('operations', 'jobs'),
  ('operations', 'schedule'),
  ('operations', 'projects'),
  ('operations', 'yard'),
  ('operations', 'chat')
ON CONFLICT DO NOTHING;

-- Yard
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('yard', 'yard'),
  ('yard', 'jobs'),
  ('yard', 'schedule'),
  ('yard', 'chat')
ON CONFLICT DO NOTHING;

-- Crew
INSERT INTO role_section_access (role_key, section_key) VALUES
  ('crew', 'jobs'),
  ('crew', 'schedule'),
  ('crew', 'chat')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 8: Seed Role Permissions
-- ============================================================================

-- Owner - all permissions
INSERT INTO role_permissions (role_key, permission_key)
SELECT 'owner', permission_key FROM permission_codes
ON CONFLICT DO NOTHING;

-- Admin - all permissions
INSERT INTO role_permissions (role_key, permission_key)
SELECT 'admin', permission_key FROM permission_codes
ON CONFLICT DO NOTHING;

-- Sales Manager
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('sales_manager', 'view_costs'),
  ('sales_manager', 'view_margins'),
  ('sales_manager', 'view_profitability'),
  ('sales_manager', 'view_analytics'),
  ('sales_manager', 'edit_prices'),
  ('sales_manager', 'give_discounts'),
  ('sales_manager', 'approve_quotes'),
  ('sales_manager', 'convert_entities'),
  ('sales_manager', 'manage_schedule'),
  ('sales_manager', 'manage_team'),
  ('sales_manager', 'export_data')
ON CONFLICT DO NOTHING;

-- Sales Rep - LIMITED permissions (NO cost/margin visibility, NO price editing)
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('sales_rep', 'give_discounts'),
  ('sales_rep', 'convert_entities'),
  ('sales_rep', 'manage_schedule')
ON CONFLICT DO NOTHING;

-- Front Desk
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('front_desk', 'manage_schedule')
ON CONFLICT DO NOTHING;

-- Ops Manager
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('ops_manager', 'view_costs'),
  ('ops_manager', 'view_margins'),
  ('ops_manager', 'view_profitability'),
  ('ops_manager', 'view_analytics'),
  ('ops_manager', 'create_invoices'),
  ('ops_manager', 'record_payments'),
  ('ops_manager', 'manage_schedule'),
  ('ops_manager', 'assign_crews'),
  ('ops_manager', 'convert_entities'),
  ('ops_manager', 'manage_yard'),
  ('ops_manager', 'view_yard'),
  ('ops_manager', 'manage_inventory'),
  ('ops_manager', 'manage_team'),
  ('ops_manager', 'export_data')
ON CONFLICT DO NOTHING;

-- Operations
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('operations', 'manage_schedule'),
  ('operations', 'assign_crews'),
  ('operations', 'view_yard'),
  ('operations', 'manage_yard')
ON CONFLICT DO NOTHING;

-- Yard
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('yard', 'manage_yard'),
  ('yard', 'view_yard'),
  ('yard', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- Crew - minimal permissions
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('crew', 'view_yard')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 9: Helper Functions
-- ============================================================================

-- Check if user has section access
CREATE OR REPLACE FUNCTION user_has_section(p_user_id UUID, p_section TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin check
  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;

  -- Check role section access
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_section_access rsa ON ur.role_key = rsa.role_key
    WHERE ur.user_id = p_user_id AND rsa.section_key = p_section
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has permission (with overrides)
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin check first
  IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id = p_user_id AND is_super_admin = true) THEN
    RETURN true;
  END IF;

  -- Check for explicit revoke override
  IF EXISTS (
    SELECT 1 FROM user_permission_overrides
    WHERE user_id = p_user_id
      AND permission_key = p_permission
      AND override_type = 'revoke'
  ) THEN
    RETURN false;
  END IF;

  -- Check for explicit grant override
  IF EXISTS (
    SELECT 1 FROM user_permission_overrides
    WHERE user_id = p_user_id
      AND permission_key = p_permission
      AND override_type = 'grant'
  ) THEN
    RETURN true;
  END IF;

  -- Check role permissions
  RETURN EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON ur.role_key = rp.role_key
    WHERE ur.user_id = p_user_id AND rp.permission_key = p_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's role key
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role_key FROM user_roles WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get all permissions for a user (for loading into frontend context)
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE (
  role_key TEXT,
  is_super_admin BOOLEAN,
  sections TEXT[],
  permissions TEXT[],
  bu_scope TEXT[]
) AS $$
DECLARE
  v_role TEXT;
  v_is_super BOOLEAN;
  v_sections TEXT[];
  v_permissions TEXT[];
  v_bu_scope TEXT[];
BEGIN
  -- Get user's role
  SELECT ur.role_key INTO v_role FROM user_roles ur WHERE ur.user_id = p_user_id;

  -- Check super admin
  SELECT COALESCE(up.is_super_admin, false) INTO v_is_super
  FROM user_profiles up WHERE up.id = p_user_id;

  -- Get BU scope from fsm_team_profiles
  SELECT COALESCE(ftp.assigned_qbo_class_ids, ARRAY[]::TEXT[]) INTO v_bu_scope
  FROM fsm_team_profiles ftp WHERE ftp.user_id = p_user_id;

  -- Super admin gets everything
  IF v_is_super THEN
    SELECT array_agg(section_key) INTO v_sections FROM section_codes;
    SELECT array_agg(permission_key) INTO v_permissions FROM permission_codes;
  ELSE
    -- Get sections from role
    SELECT array_agg(rsa.section_key) INTO v_sections
    FROM role_section_access rsa
    WHERE rsa.role_key = v_role;

    -- Get permissions from role, applying overrides
    SELECT array_agg(DISTINCT p.permission_key) INTO v_permissions
    FROM (
      -- Role permissions
      SELECT rp.permission_key
      FROM role_permissions rp
      WHERE rp.role_key = v_role

      UNION

      -- Grant overrides
      SELECT upo.permission_key
      FROM user_permission_overrides upo
      WHERE upo.user_id = p_user_id AND upo.override_type = 'grant'

      EXCEPT

      -- Revoke overrides
      SELECT upo.permission_key
      FROM user_permission_overrides upo
      WHERE upo.user_id = p_user_id AND upo.override_type = 'revoke'
    ) p;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_role, 'unknown'),
    COALESCE(v_is_super, false),
    COALESCE(v_sections, ARRAY[]::TEXT[]),
    COALESCE(v_permissions, ARRAY[]::TEXT[]),
    COALESCE(v_bu_scope, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- PART 10: Migrate Existing Users
-- ============================================================================

-- Map existing user_profiles.role to new user_roles table
INSERT INTO user_roles (user_id, role_key)
SELECT
  up.id,
  CASE up.role
    WHEN 'admin' THEN 'admin'
    WHEN 'sales-manager' THEN 'sales_manager'
    WHEN 'sales' THEN 'sales_rep'
    WHEN 'operations' THEN 'operations'
    WHEN 'yard' THEN 'yard'
    ELSE 'operations'  -- fallback for unknown roles
  END as role_key
FROM user_profiles up
WHERE up.role IS NOT NULL
  AND up.id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- PART 11: RLS Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_section_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Definition tables: all authenticated users can read
CREATE POLICY "Anyone can read app_roles" ON app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read section_codes" ON section_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read permission_codes" ON permission_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read role_section_access" ON role_section_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read role_permissions" ON role_permissions FOR SELECT TO authenticated USING (true);

-- User roles: users can read their own, admins can read/write all
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_has_permission(auth.uid(), 'manage_roles'));

CREATE POLICY "Admins can manage user_roles" ON user_roles FOR ALL TO authenticated
  USING (user_has_permission(auth.uid(), 'manage_roles'));

-- User permission overrides: users can read their own, admins can manage
CREATE POLICY "Users can read own overrides" ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_has_permission(auth.uid(), 'manage_roles'));

CREATE POLICY "Admins can manage overrides" ON user_permission_overrides FOR ALL TO authenticated
  USING (user_has_permission(auth.uid(), 'manage_roles'));

-- ============================================================================
-- PART 12: Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_role_key ON user_roles(role_key);
CREATE INDEX IF NOT EXISTS idx_role_section_access_section ON role_section_access(section_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
