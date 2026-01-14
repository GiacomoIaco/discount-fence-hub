/**
 * Permission Helper Components
 *
 * These components provide declarative permission checking in JSX.
 */

import type { ReactNode } from 'react';
import { usePermission } from '../../contexts/PermissionContext';
import type {
  PermissionKey,
  AppRole,
  RequirePermissionProps,
  RequireSectionProps,
  RequireRoleProps,
} from './types';
import { ROLE_HIERARCHY } from './defaults';

// ============================================================================
// RequirePermission
// ============================================================================

/**
 * Renders children only if user has the specified permission.
 *
 * @example
 * <RequirePermission permission="view_costs">
 *   <CostBreakdown />
 * </RequirePermission>
 *
 * @example
 * <RequirePermission permission="edit_prices" fallback={<PriceDisplay value={price} />}>
 *   <PriceEditor value={price} onChange={setPrice} />
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps): ReactNode {
  const { hasPermission, isLoading } = usePermission();

  // Don't render anything while loading
  if (isLoading) return null;

  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// RequireSection
// ============================================================================

/**
 * Renders children only if user has access to the specified section.
 *
 * @example
 * <RequireSection section="analytics">
 *   <AnalyticsDashboard />
 * </RequireSection>
 */
export function RequireSection({
  section,
  children,
  fallback = null,
}: RequireSectionProps): ReactNode {
  const { hasSection, isLoading } = usePermission();

  if (isLoading) return null;

  return hasSection(section) ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// RequireRole
// ============================================================================

/**
 * Renders children only if user has one of the specified roles.
 *
 * @example
 * <RequireRole roles={['owner', 'admin']}>
 *   <AdminPanel />
 * </RequireRole>
 */
export function RequireRole({
  roles,
  children,
  fallback = null,
}: RequireRoleProps): ReactNode {
  const { role, isSuperAdmin, isLoading } = usePermission();

  if (isLoading) return null;

  // Super admin has access to everything
  if (isSuperAdmin) return <>{children}</>;

  // Check if user's role is in the list
  if (role && roles.includes(role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// ============================================================================
// RequireMinRole
// ============================================================================

interface RequireMinRoleProps {
  minRole: AppRole;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if user has at least the specified role level.
 * Lower hierarchy number = more access (owner=1, crew=9).
 *
 * @example
 * <RequireMinRole minRole="sales_manager">
 *   <ApprovalButton />
 * </RequireMinRole>
 */
export function RequireMinRole({
  minRole,
  children,
  fallback = null,
}: RequireMinRoleProps): ReactNode {
  const { role, isSuperAdmin, isLoading } = usePermission();

  if (isLoading) return null;

  // Super admin has access to everything
  if (isSuperAdmin) return <>{children}</>;

  if (!role) return <>{fallback}</>;

  // Compare hierarchy levels (lower = more access)
  const userLevel = ROLE_HIERARCHY[role] || 999;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

  return userLevel <= requiredLevel ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// RequireAnyPermission
// ============================================================================

interface RequireAnyPermissionProps {
  permissions: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children if user has ANY of the specified permissions.
 *
 * @example
 * <RequireAnyPermission permissions={['view_costs', 'view_margins']}>
 *   <FinancialSummary />
 * </RequireAnyPermission>
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
}: RequireAnyPermissionProps): ReactNode {
  const { hasPermission, isSuperAdmin, isLoading } = usePermission();

  if (isLoading) return null;

  if (isSuperAdmin) return <>{children}</>;

  const hasAny = permissions.some((p) => hasPermission(p));
  return hasAny ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// RequireAllPermissions
// ============================================================================

interface RequireAllPermissionsProps {
  permissions: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if user has ALL of the specified permissions.
 *
 * @example
 * <RequireAllPermissions permissions={['edit_prices', 'approve_quotes']}>
 *   <QuoteApprovalEditor />
 * </RequireAllPermissions>
 */
export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
}: RequireAllPermissionsProps): ReactNode {
  const { hasPermission, isSuperAdmin, isLoading } = usePermission();

  if (isLoading) return null;

  if (isSuperAdmin) return <>{children}</>;

  const hasAll = permissions.every((p) => hasPermission(p));
  return hasAll ? <>{children}</> : <>{fallback}</>;
}

// ============================================================================
// HideFromRole
// ============================================================================

interface HideFromRoleProps {
  roles: AppRole[];
  children: ReactNode;
}

/**
 * Hides children from users with specified roles.
 * Useful for hiding elements from certain roles.
 *
 * @example
 * <HideFromRole roles={['crew', 'yard']}>
 *   <SensitiveInfo />
 * </HideFromRole>
 */
export function HideFromRole({
  roles,
  children,
}: HideFromRoleProps): ReactNode {
  const { role, isLoading } = usePermission();

  if (isLoading) return null;

  // If user's role is in the hide list, don't render
  if (role && roles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}

// ============================================================================
// IfSuperAdmin
// ============================================================================

interface IfSuperAdminProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if user is a super admin.
 *
 * @example
 * <IfSuperAdmin>
 *   <DangerZone />
 * </IfSuperAdmin>
 */
export function IfSuperAdmin({
  children,
  fallback = null,
}: IfSuperAdminProps): ReactNode {
  const { isSuperAdmin, isLoading } = usePermission();

  if (isLoading) return null;

  return isSuperAdmin ? <>{children}</> : <>{fallback}</>;
}
