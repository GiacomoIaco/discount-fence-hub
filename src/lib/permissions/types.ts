/**
 * Unified Permission System Types
 *
 * This file defines all types for the RBAC (Role-Based Access Control) system.
 * These types mirror the database tables in migration 230.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Application roles - 9 simplified roles
 * Hierarchy: 1=owner (most access) to 9=crew (least access)
 */
export type AppRole =
  | 'owner'        // 1 - Full access
  | 'admin'        // 2 - Full system access
  | 'sales_manager' // 3 - Sales team lead, can see financials
  | 'sales_rep'    // 4 - Creates quotes, NO cost visibility
  | 'front_desk'   // 5 - Handles requests, scheduling
  | 'ops_manager'  // 6 - Operations lead
  | 'operations'   // 7 - Field operations
  | 'yard'         // 8 - Yard management
  | 'crew';        // 9 - Field workers

/**
 * Application sections - areas of the app that can be accessed
 */
export type SectionKey =
  // FSM Hub
  | 'requests'
  | 'quotes'
  | 'jobs'
  | 'invoices'
  | 'schedule'
  | 'projects'
  // Client Hub
  | 'clients'
  | 'properties'
  // Ops Hub
  | 'calculator'
  | 'yard'
  // Sales Hub
  | 'sales-coach'
  | 'presentation'
  | 'survey'
  | 'photo-gallery'
  | 'resources'
  // Communication
  | 'chat'
  | 'notifications'
  // Analytics
  | 'analytics'
  // Leadership
  | 'leadership'
  | 'roadmap'
  // Admin
  | 'settings'
  | 'team'
  | 'users'
  // Help
  | 'help';

/**
 * Feature permissions - granular capabilities
 */
export type PermissionKey =
  // Financial
  | 'view_costs'
  | 'view_margins'
  | 'view_profitability'
  | 'view_analytics'
  // Editing
  | 'edit_prices'
  | 'give_discounts'
  | 'edit_costs'
  // Workflow
  | 'approve_quotes'
  | 'create_invoices'
  | 'record_payments'
  | 'manage_schedule'
  | 'assign_crews'
  | 'convert_entities'
  // Operations
  | 'manage_yard'
  | 'view_yard'
  | 'manage_inventory'
  // Admin
  | 'manage_team'
  | 'manage_roles'
  | 'manage_settings'
  | 'export_data'
  | 'view_all_bus'
  | 'manage_integrations';

/**
 * Permission override types
 */
export type OverrideType = 'grant' | 'revoke';

// ============================================================================
// User Permission State
// ============================================================================

/**
 * Complete user permission state - loaded from database
 */
export interface UserPermissions {
  /** User's assigned role */
  role: AppRole;
  /** Is super admin (bypasses all checks) */
  isSuperAdmin: boolean;
  /** Sections the user can access */
  sections: Set<SectionKey>;
  /** Permissions the user has (after overrides) */
  permissions: Set<PermissionKey>;
  /** BU scope (empty = all) */
  buScope: string[];
}

/**
 * Raw permission data from database
 */
export interface RawUserPermissions {
  role_key: string;
  is_super_admin: boolean;
  sections: string[];
  permissions: string[];
  bu_scope: string[];
}

// ============================================================================
// Database Table Types
// ============================================================================

export interface AppRoleRow {
  role_key: AppRole;
  display_name: string;
  description: string | null;
  hierarchy_level: number;
  is_system_role: boolean;
  created_at: string;
}

export interface SectionCodeRow {
  section_key: SectionKey;
  display_name: string;
  hub: string | null;
  description: string | null;
  created_at: string;
}

export interface PermissionCodeRow {
  permission_key: PermissionKey;
  display_name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface UserRoleRow {
  user_id: string;
  role_key: AppRole;
  assigned_at: string;
  assigned_by: string | null;
}

export interface UserPermissionOverrideRow {
  user_id: string;
  permission_key: PermissionKey;
  override_type: OverrideType;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

// ============================================================================
// Context Types
// ============================================================================

export interface PermissionContextValue {
  /** User's complete permission state */
  permissions: UserPermissions | null;
  /** Check if user can access a section */
  hasSection: (section: SectionKey) => boolean;
  /** Check if user has a permission */
  hasPermission: (permission: PermissionKey) => boolean;
  /** User's role key (reflects override if active) */
  role: AppRole | null;
  /** User's real role (never overridden) */
  realRole: AppRole | null;
  /** Is super admin */
  isSuperAdmin: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Refresh permissions from database */
  refresh: () => Promise<void>;
  /** Admin role override — view the app as a different role */
  roleOverride: AppRole | null;
  /** Set role override (null to clear) */
  setRoleOverride: (role: AppRole | null) => void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Props for RequirePermission component
 */
export interface RequirePermissionProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Props for RequireSection component
 */
export interface RequireSectionProps {
  section: SectionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Props for RequireRole component
 */
export interface RequireRoleProps {
  roles: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
