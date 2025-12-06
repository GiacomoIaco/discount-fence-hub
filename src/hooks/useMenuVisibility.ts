import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type Platform = 'desktop' | 'mobile' | 'both';

export interface MenuVisibilityItem {
  id: string;
  menu_id: string;
  menu_name: string;
  visible_for_roles: string[];
  enabled_users: string[];
  disabled_users: string[];
  available_on: Platform;
  updated_at: string;
  updated_by?: string;
}

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
    optionsOrRole?: string | { overrideRole?: string; platform?: 'desktop' | 'mobile' }
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
      const availableOn = item.available_on || 'desktop';
      if (availableOn !== 'both' && availableOn !== platform) {
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
   * @param menuId - The menu item ID
   * @param platform - The platform to check
   * @returns boolean - Whether the feature is available on this platform
   */
  const isAvailableOnPlatform = (menuId: string, platform: 'desktop' | 'mobile'): boolean => {
    const item = menuVisibility.get(menuId);
    if (!item) return true; // Default to available if no rules

    const availableOn = item.available_on || 'desktop';
    return availableOn === 'both' || availableOn === platform;
  };

  /**
   * Get all menu items available on a specific platform
   * @param platform - The platform to filter by
   * @returns MenuVisibilityItem[] - Menu items available on the platform
   */
  const getMenuItemsForPlatform = (platform: 'desktop' | 'mobile'): MenuVisibilityItem[] => {
    return Array.from(menuVisibility.values()).filter(item => {
      const availableOn = item.available_on || 'desktop';
      return availableOn === 'both' || availableOn === platform;
    });
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
    getMenuItemsForPlatform,
    toggleRoleVisibility,
    addUserOverride,
    removeUserOverride,
    loadMenuVisibility,
    loading,
  };
};
