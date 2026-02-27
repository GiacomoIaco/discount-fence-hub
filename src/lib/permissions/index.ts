/**
 * Unified Permission System
 *
 * This module provides role-based access control (RBAC) with:
 * - 9 simplified roles
 * - Section access (which parts of the app can be accessed)
 * - Feature permissions (what actions can be performed)
 * - User overrides (grant/revoke specific permissions)
 *
 * Usage:
 *
 * 1. Wrap your app with PermissionProvider (alongside AuthProvider):
 *    <AuthProvider>
 *      <PermissionProvider>
 *        <App />
 *      </PermissionProvider>
 *    </AuthProvider>
 *
 * 2. Use hooks in components:
 *    const { hasPermission, hasSection } = usePermission();
 *    if (hasPermission('view_costs')) { ... }
 *
 * 3. Use helper components for declarative access control:
 *    <RequirePermission permission="view_costs">
 *      <CostBreakdown />
 *    </RequirePermission>
 */

// Types
export type {
  AppRole,
  SectionKey,
  PermissionKey,
  OverrideType,
  UserPermissions,
  RawUserPermissions,
  PermissionContextValue,
  RequirePermissionProps,
  RequireSectionProps,
  RequireRoleProps,
  AppRoleRow,
  SectionCodeRow,
  PermissionCodeRow,
  UserRoleRow,
  UserPermissionOverrideRow,
} from './types';

// Defaults and constants
export {
  ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES,
  DEFAULT_ROLE_SECTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from './defaults';

// Components
export {
  RequirePermission,
  RequireSection,
  RequireRole,
  RequireMinRole,
  RequireAnyPermission,
  RequireAllPermissions,
  HideFromRole,
  IfSuperAdmin,
} from './components';

// Re-export context hooks for convenience
export {
  usePermission,
  useHasSection,
  useHasPermission,
  useCanSeeFinancials,
  useCanEditPrices,
  useCanGiveDiscounts,
} from '../../contexts/PermissionContext';
