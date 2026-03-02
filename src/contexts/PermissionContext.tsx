import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type {
  AppRole,
  SectionKey,
  PermissionKey,
  UserPermissions,
  RawUserPermissions,
  PermissionContextValue,
} from '../lib/permissions/types';

// ============================================================================
// Context Definition
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleOverride, setRoleOverride] = useState<AppRole | null>(null);
  const [overridePermissions, setOverridePermissions] = useState<UserPermissions | null>(null);

  // Load permissions from database
  const loadPermissions = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);

      // Try to load from the new permission system
      const { data, error } = await supabase
        .rpc('get_user_permissions', { p_user_id: userId });

      if (error) {
        console.warn('Permission system not available, using legacy fallback:', error.message);
        return null;
      }

      if (data && data.length > 0) {
        const raw = data[0] as RawUserPermissions;
        return {
          role: raw.role_key as AppRole,
          isSuperAdmin: raw.is_super_admin,
          sections: new Set(raw.sections as SectionKey[]),
          permissions: new Set(raw.permissions as PermissionKey[]),
          buScope: raw.bu_scope || [],
        } as UserPermissions;
      }

      return null;
    } catch (err) {
      console.error('Error loading permissions:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load permissions for an overridden role
  const loadRolePermissions = useCallback(async (role: AppRole) => {
    try {
      const [sectionsRes, permsRes] = await Promise.all([
        supabase.from('role_section_access').select('section_key').eq('role_key', role),
        supabase.from('role_permissions').select('permission_key').eq('role_key', role),
      ]);

      return {
        role,
        isSuperAdmin: false,
        sections: new Set((sectionsRes.data || []).map(r => r.section_key as SectionKey)),
        permissions: new Set((permsRes.data || []).map(r => r.permission_key as PermissionKey)),
        buScope: permissions?.buScope || [],
      } as UserPermissions;
    } catch (err) {
      console.error('Error loading role permissions for override:', err);
      return null;
    }
  }, [permissions?.buScope]);

  // Load override permissions when roleOverride changes
  useEffect(() => {
    if (!roleOverride) {
      setOverridePermissions(null);
      return;
    }
    loadRolePermissions(roleOverride).then(setOverridePermissions);
  }, [roleOverride, loadRolePermissions]);

  // Load permissions when user changes
  useEffect(() => {
    if (!user?.id) {
      setPermissions(null);
      setIsLoading(false);
      return;
    }

    loadPermissions(user.id).then((loaded) => {
      if (loaded) {
        setPermissions(loaded);
      } else {
        // All active users should have user_roles entries (backfilled by migration 279)
        console.error('No permissions found for user - ensure user_roles entry exists');
        setPermissions(null);
      }
    });
  }, [user?.id, loadPermissions]);

  // The effective permissions (override or real)
  const effective = roleOverride && overridePermissions ? overridePermissions : permissions;

  // Check if user has access to a section
  const hasSection = useCallback((section: SectionKey): boolean => {
    if (!effective) return false;
    if (effective.isSuperAdmin) return true;
    return effective.sections.has(section);
  }, [effective]);

  // Check if user has a permission
  const hasPermission = useCallback((permission: PermissionKey): boolean => {
    if (!effective) return false;
    if (effective.isSuperAdmin) return true;
    return effective.permissions.has(permission);
  }, [effective]);

  // Refresh permissions
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const loaded = await loadPermissions(user.id);
    if (loaded) {
      setPermissions(loaded);
    }
  }, [user?.id, loadPermissions]);

  // Clear override when user changes
  useEffect(() => {
    setRoleOverride(null);
  }, [user?.id]);

  // Memoized context value
  const value = useMemo<PermissionContextValue>(() => ({
    permissions: effective,
    hasSection,
    hasPermission,
    role: effective?.role || null,
    realRole: permissions?.role || null,
    isSuperAdmin: permissions?.isSuperAdmin || false,
    isLoading,
    refresh,
    roleOverride,
    setRoleOverride,
  }), [effective, permissions, hasSection, hasPermission, isLoading, refresh, roleOverride]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePermission(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to check if user has access to a section
 */
export function useHasSection(section: SectionKey): boolean {
  const { hasSection } = usePermission();
  return hasSection(section);
}

/**
 * Hook to check if user has a permission
 */
export function useHasPermission(permission: PermissionKey): boolean {
  const { hasPermission } = usePermission();
  return hasPermission(permission);
}

/**
 * Hook to check if user can see financial data (costs, margins, profitability)
 */
export function useCanSeeFinancials(): boolean {
  const { hasPermission, isSuperAdmin } = usePermission();
  if (isSuperAdmin) return true;
  return hasPermission('view_costs') || hasPermission('view_margins') || hasPermission('view_profitability');
}

/**
 * Hook to check if user can edit prices
 */
export function useCanEditPrices(): boolean {
  const { hasPermission, isSuperAdmin } = usePermission();
  if (isSuperAdmin) return true;
  return hasPermission('edit_prices');
}

/**
 * Hook to check if user can give discounts
 */
export function useCanGiveDiscounts(): boolean {
  const { hasPermission, isSuperAdmin } = usePermission();
  if (isSuperAdmin) return true;
  return hasPermission('give_discounts');
}
