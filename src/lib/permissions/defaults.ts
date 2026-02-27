/**
 * Default Role Permissions
 *
 * These defaults are used as fallback when database isn't available
 * and for documentation purposes. The database is the source of truth.
 */

import type { AppRole, SectionKey, PermissionKey } from './types';

// ============================================================================
// Role Hierarchy
// ============================================================================

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 1,
  admin: 2,
  sales_manager: 3,
  sales_rep: 4,
  front_desk: 5,
  ops_manager: 6,
  operations: 7,
  yard: 8,
  crew: 9,
};

export const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales_rep: 'Sales Rep',
  front_desk: 'Front Desk',
  ops_manager: 'Ops Manager',
  operations: 'Operations',
  yard: 'Yard',
  crew: 'Crew',
};

// ============================================================================
// Default Section Access by Role
// ============================================================================

const ALL_SECTIONS: SectionKey[] = [
  'requests', 'quotes', 'jobs', 'invoices', 'schedule', 'projects',
  'clients', 'properties', 'calculator', 'yard', 'sales-coach',
  'presentation', 'survey', 'photo-gallery', 'resources', 'chat',
  'notifications', 'analytics', 'leadership', 'roadmap', 'settings',
  'team', 'users', 'help',
];

export const DEFAULT_ROLE_SECTIONS: Record<AppRole, SectionKey[]> = {
  owner: ALL_SECTIONS,
  admin: ALL_SECTIONS,
  sales_manager: [
    'requests', 'quotes', 'jobs', 'invoices', 'schedule', 'projects',
    'clients', 'properties', 'calculator', 'sales-coach', 'presentation',
    'survey', 'photo-gallery', 'resources', 'chat', 'analytics', 'team',
  ],
  sales_rep: [
    'requests', 'quotes', 'schedule', 'projects', 'clients', 'properties',
    'calculator', 'sales-coach', 'presentation', 'survey', 'photo-gallery',
    'resources', 'chat',
  ],
  front_desk: [
    'requests', 'schedule', 'clients', 'properties', 'chat', 'notifications',
  ],
  ops_manager: [
    'jobs', 'invoices', 'schedule', 'projects', 'yard', 'chat',
    'analytics', 'team',
  ],
  operations: [
    'jobs', 'schedule', 'projects', 'yard', 'chat',
  ],
  yard: [
    'yard', 'jobs', 'schedule', 'chat',
  ],
  crew: [
    'jobs', 'schedule', 'chat',
  ],
};

// ============================================================================
// Default Permissions by Role
// ============================================================================

const ALL_PERMISSIONS: PermissionKey[] = [
  'view_costs', 'view_margins', 'view_profitability', 'view_analytics',
  'edit_prices', 'give_discounts', 'edit_costs', 'approve_quotes',
  'create_invoices', 'record_payments', 'manage_schedule', 'assign_crews',
  'convert_entities', 'manage_yard', 'view_yard', 'manage_inventory',
  'manage_team', 'manage_roles', 'manage_settings', 'export_data',
  'view_all_bus', 'manage_integrations',
];

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, PermissionKey[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  sales_manager: [
    'view_costs', 'view_margins', 'view_profitability', 'view_analytics',
    'edit_prices', 'give_discounts', 'approve_quotes', 'convert_entities',
    'manage_schedule', 'manage_team', 'export_data',
  ],
  // Sales Rep: NO cost visibility, NO price editing - only discounts
  sales_rep: [
    'give_discounts', 'convert_entities', 'manage_schedule',
  ],
  front_desk: [
    'manage_schedule',
  ],
  ops_manager: [
    'view_costs', 'view_margins', 'view_profitability', 'view_analytics',
    'create_invoices', 'record_payments', 'manage_schedule', 'assign_crews',
    'convert_entities', 'manage_yard', 'view_yard', 'manage_inventory',
    'manage_team', 'export_data',
  ],
  operations: [
    'manage_schedule', 'assign_crews', 'view_yard', 'manage_yard',
  ],
  yard: [
    'manage_yard', 'view_yard', 'manage_inventory',
  ],
  crew: [
    'view_yard',
  ],
};

// ============================================================================
// Permission Categories
// ============================================================================

export const PERMISSION_CATEGORIES = {
  financial: ['view_costs', 'view_margins', 'view_profitability', 'view_analytics'] as PermissionKey[],
  editing: ['edit_prices', 'give_discounts', 'edit_costs'] as PermissionKey[],
  workflow: ['approve_quotes', 'create_invoices', 'record_payments', 'manage_schedule', 'assign_crews', 'convert_entities'] as PermissionKey[],
  operations: ['manage_yard', 'view_yard', 'manage_inventory'] as PermissionKey[],
  admin: ['manage_team', 'manage_roles', 'manage_settings', 'export_data', 'view_all_bus', 'manage_integrations'] as PermissionKey[],
};

