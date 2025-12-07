import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type Platform = 'desktop' | 'tablet' | 'mobile';
export type LegacyPlatform = 'desktop' | 'mobile' | 'both';

export interface MenuVisibilityItem {
  id: string;
  menu_id: string;
  menu_name: string;
  visible_for_roles: string[];
  enabled_users: string[];
  disabled_users: string[];
  // Legacy field (kept for backward compatibility)
  available_on: LegacyPlatform;
  // New granular platform controls (enabled/disabled)
  show_on_desktop: boolean;
  show_on_tablet: boolean;
  show_on_mobile: boolean;
  // Platform support (does the feature have a UI for this platform?)
  supported_on_desktop: boolean;
  supported_on_tablet: boolean;
  supported_on_mobile: boolean;
  updated_at: string;
  updated_by?: string;
}

// Screen size breakpoints
export const BREAKPOINTS = {
  mobile: 640,    // < 640px = phone
  tablet: 1024,   // 640px - 1024px = tablet
  desktop: 1024,  // >= 1024px = desktop
};

// Detect current platform based on screen width
export const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
};

export const useMenuVisibility = () => {
  const { user, profile } = useAuth();
  const [menuVisibility, setMenuVisibility] = useState<Map<string, MenuVisibilityItem>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenuVisibility();
  }, []);

  const loadMenuVisibility = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('menu_visibility')
        .select('*')
        .order('menu_name');

      if (error) throw error;

      const map = new Map<string, MenuVisibilityItem>();
      data?.forEach(item => map.set(item.menu_id, item));
      setMenuVisibility(map);
    } catch (error) {
      console.error('Error loading menu visibility:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user can see a menu item
   * @param menuId - The menu item ID
   * @param optionsOrRole - Either an options object or a role string (for backward compatibility)
   * @returns boolean - Whether the user can see the menu item
   */
  const canSeeMenuItem = (
    menuId: string,
    optionsOrRole?: string | { overrideRole?: string; platform?: Platform }
  ): boolean => {
    const item = menuVisibility.get(menuId);

    // If no visibility rules defined, default to visible
    if (!item) return true;

    // Handle backward compatibility: if string passed, treat as overrideRole
    const options = typeof optionsOrRole === 'string'
      ? { overrideRole: optionsOrRole }
      : optionsOrRole || {};

    const { overrideRole, platform } = options;
    const userRole = overrideRole || profile?.role || 'sales';
    const userId = user?.id;

    // Check platform availability first (if platform specified)
    if (platform) {
      if (!isAvailableOnPlatform(menuId, platform)) {
        return false; // Feature not available on this platform
      }
    }

    // Check user-level overrides (only if not using override role)
    if (userId && !overrideRole) {
      // If user is explicitly disabled, hide the menu
      if (item.disabled_users?.includes(userId)) return false;

      // If user is explicitly enabled, show the menu (overrides role settings)
      if (item.enabled_users?.includes(userId)) return true;
    }

    // Check role-level visibility
    return item.visible_for_roles?.includes(userRole) ?? true;
  };

  /**
   * Check if a menu item is available on a specific platform
   * Uses the new granular columns (show_on_desktop, show_on_tablet, show_on_mobile)
   * Falls back to legacy available_on if new columns not set
   * @param menuId - The menu item ID
   * @param platform - The platform to check ('desktop' | 'tablet' | 'mobile')
   * @returns boolean - Whether the feature is available on this platform
   */
  const isAvailableOnPlatform = (menuId: string, platform: Platform): boolean => {
    const item = menuVisibility.get(menuId);
    if (!item) return true; // Default to available if no rules

    // Use new granular columns if available
    if (item.show_on_desktop !== undefined) {
      switch (platform) {
        case 'desktop': return item.show_on_desktop ?? true;
        case 'tablet': return item.show_on_tablet ?? true;
        case 'mobile': return item.show_on_mobile ?? true;
        default: return true;
      }
    }

    // Fallback to legacy available_on
    const availableOn = item.available_on || 'desktop';
    if (availableOn === 'both') return true;
    if (platform === 'tablet') {
      // Tablets fall back to desktop behavior in legacy mode
      return availableOn === 'desktop';
    }
    return availableOn === platform;
  };

  /**
   * Get all menu items available on a specific platform
   * @param platform - The platform to filter by
   * @returns MenuVisibilityItem[] - Menu items available on the platform
   */
  const getMenuItemsForPlatform = (platform: Platform): MenuVisibilityItem[] => {
    return Array.from(menuVisibility.values()).filter(item =>
      isAvailableOnPlatform(item.menu_id, platform)
    );
  };

  /**
   * Check if a platform is supported for a menu item
   * @param menuId - The menu item ID
   * @param platform - The platform to check
   * @returns boolean - Whether the platform is supported (has a UI)
   */
  const isPlatformSupported = (menuId: string, platform: Platform): boolean => {
    const item = menuVisibility.get(menuId);
    if (!item) return true; // Default to supported if no rules

    switch (platform) {
      case 'desktop': return item.supported_on_desktop ?? true;
      case 'tablet': return item.supported_on_tablet ?? true;
      case 'mobile': return item.supported_on_mobile ?? true;
      default: return true;
    }
  };

  /**
   * Toggle platform visibility for a menu item
   * Only works if the platform is supported
   * @param menuId - The menu item ID
   * @param platform - The platform to toggle
   * @returns boolean - Success status
   */
  const togglePlatformVisibility = async (menuId: string, platform: Platform): Promise<boolean> => {
    const item = menuVisibility.get(menuId);
    if (!item) return false;

    // Don't allow toggling unsupported platforms
    if (!isPlatformSupported(menuId, platform)) {
      return false;
    }

    const columnName = `show_on_${platform}` as const;
    const currentValue = item[columnName] ?? true;
    const newValue = !currentValue;

    return updateMenuVisibility(menuId, { [columnName]: newValue });
  };

  const updateMenuVisibility = async (
    menuId: string,
    updates: Partial<MenuVisibilityItem>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('menu_visibility')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('menu_id', menuId);

      if (error) throw error;

      await loadMenuVisibility();
      return true;
    } catch (error) {
      console.error('Error updating menu visibility:', error);
      return false;
    }
  };

  const toggleRoleVisibility = async (menuId: string, role: string): Promise<boolean> => {
    const item = menuVisibility.get(menuId);
    if (!item) return false;

    const currentRoles = item.visible_for_roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];

    return updateMenuVisibility(menuId, { visible_for_roles: newRoles });
  };

  const addUserOverride = async (menuId: string, userId: string, enabled: boolean): Promise<boolean> => {
    const item = menuVisibility.get(menuId);
    if (!item) return false;

    if (enabled) {
      // Add to enabled_users, remove from disabled_users
      const enabledUsers = [...(item.enabled_users || [])];
      if (!enabledUsers.includes(userId)) enabledUsers.push(userId);

      const disabledUsers = (item.disabled_users || []).filter(id => id !== userId);

      return updateMenuVisibility(menuId, {
        enabled_users: enabledUsers,
        disabled_users: disabledUsers,
      });
    } else {
      // Add to disabled_users, remove from enabled_users
      const disabledUsers = [...(item.disabled_users || [])];
      if (!disabledUsers.includes(userId)) disabledUsers.push(userId);

      const enabledUsers = (item.enabled_users || []).filter(id => id !== userId);

      return updateMenuVisibility(menuId, {
        enabled_users: enabledUsers,
        disabled_users: disabledUsers,
      });
    }
  };

  const removeUserOverride = async (menuId: string, userId: string): Promise<boolean> => {
    const item = menuVisibility.get(menuId);
    if (!item) return false;

    const enabledUsers = (item.enabled_users || []).filter(id => id !== userId);
    const disabledUsers = (item.disabled_users || []).filter(id => id !== userId);

    return updateMenuVisibility(menuId, {
      enabled_users: enabledUsers,
      disabled_users: disabledUsers,
    });
  };

  return {
    menuVisibility: Array.from(menuVisibility.values()),
    canSeeMenuItem,
    isAvailableOnPlatform,
    isPlatformSupported,
    getMenuItemsForPlatform,
    toggleRoleVisibility,
    togglePlatformVisibility,
    addUserOverride,
    removeUserOverride,
    loadMenuVisibility,
    loading,
  };
};
