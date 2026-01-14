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
import {
  DEFAULT_ROLE_SECTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  mapLegacyRole,
} from '../lib/permissions/defaults';

// ============================================================================
// Context Definition
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Create fallback permissions from legacy role
  const createFallbackPermissions = useCallback((
    legacyRole: string | null | undefined,
    isSuperAdmin: boolean
  ): UserPermissions => {
    const role = mapLegacyRole(legacyRole);

    // Super admin gets everything
    if (isSuperAdmin) {
      return {
        role,
        isSuperAdmin: true,
        sections: new Set(Object.values(DEFAULT_ROLE_SECTIONS).flat() as SectionKey[]),
        permissions: new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat() as PermissionKey[]),
        buScope: [],
      };
    }

    return {
      role,
      isSuperAdmin: false,
      sections: new Set(DEFAULT_ROLE_SECTIONS[role] || []),
      permissions: new Set(DEFAULT_ROLE_PERMISSIONS[role] || []),
      buScope: [],
    };
  }, []);

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
        // Fallback to legacy role from profile
        const fallback = createFallbackPermissions(
          profile?.role,
          profile?.is_super_admin || false
        );
        setPermissions(fallback);
      }
    });
  }, [user?.id, profile?.role, profile?.is_super_admin, loadPermissions, createFallbackPermissions]);

  // Check if user has access to a section
  const hasSection = useCallback((section: SectionKey): boolean => {
    if (!permissions) return false;
    if (permissions.isSuperAdmin) return true;
    return permissions.sections.has(section);
  }, [permissions]);

  // Check if user has a permission
  const hasPermission = useCallback((permission: PermissionKey): boolean => {
    if (!permissions) return false;
    if (permissions.isSuperAdmin) return true;
    return permissions.permissions.has(permission);
  }, [permissions]);

  // Refresh permissions
  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const loaded = await loadPermissions(user.id);
    if (loaded) {
      setPermissions(loaded);
    }
  }, [user?.id, loadPermissions]);

  // Memoized context value
  const value = useMemo<PermissionContextValue>(() => ({
    permissions,
    hasSection,
    hasPermission,
    role: permissions?.role || null,
    isSuperAdmin: permissions?.isSuperAdmin || false,
    isLoading,
    refresh,
  }), [permissions, hasSection, hasPermission, isLoading, refresh]);

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
