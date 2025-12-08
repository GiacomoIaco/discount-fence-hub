import { useState, useEffect } from 'react';
import { useMenuVisibility } from '../../../hooks/useMenuVisibility';
import type { Platform, MenuCategory } from '../../../hooks/useMenuVisibility';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { X, Users, Check, Monitor, Tablet, Smartphone } from 'lucide-react';

const CATEGORY_OPTIONS: { value: MenuCategory; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'communication', label: 'Communication' },
  { value: 'requests', label: 'Requests' },
  { value: 'operations', label: 'Operations' },
  { value: 'admin', label: 'Leadership' },
  { value: 'tools', label: 'Tools' },
  { value: 'system', label: 'System' },
];

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const MenuVisibilitySettings = () => {
  const {
    menuVisibility,
    toggleRoleVisibility,
    togglePlatformVisibility,
    isPlatformSupported,
    addUserOverride,
    removeUserOverride,
    loading,
  } = useMenuVisibility();

  const roles = ['sales', 'operations', 'yard', 'sales-manager', 'admin'];
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (showUserModal) {
      loadUsers();
    }
  }, [showUserModal]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleToggleRole = async (menuId: string, role: string) => {
    const success = await toggleRoleVisibility(menuId, role);
    if (success) {
      showSuccess('Menu visibility updated');
    } else {
      showError('Failed to update menu visibility');
    }
  };

  const handleTogglePlatform = async (menuId: string, platform: Platform) => {
    const success = await togglePlatformVisibility(menuId, platform);
    if (success) {
      showSuccess('Platform visibility updated');
    } else {
      showError('Failed to update platform visibility');
    }
  };

  const handleUpdateCategory = async (menuId: string, category: MenuCategory) => {
    try {
      const { error } = await supabase
        .from('menu_visibility')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('menu_id', menuId);

      if (error) throw error;
      showSuccess('Category updated');
      // Reload to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Error updating category:', error);
      showError('Failed to update category');
    }
  };

  const handleUpdateSortOrder = async (menuId: string, sortOrder: number) => {
    try {
      const { error } = await supabase
        .from('menu_visibility')
        .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
        .eq('menu_id', menuId);

      if (error) throw error;
      showSuccess('Sort order updated');
    } catch (error) {
      console.error('Error updating sort order:', error);
      showError('Failed to update sort order');
    }
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      'sales': 'Sales',
      'operations': 'Ops',
      'yard': 'Yard',
      'sales-manager': 'Sales Mgr',
      'admin': 'Admin',
    };
    return labels[role] || role;
  };

  const openUserModal = (menuId: string) => {
    setSelectedMenuItem(menuId);
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedMenuItem(null);
  };

  const getUserOverrideStatus = (menuId: string, userId: string): 'enabled' | 'disabled' | 'none' => {
    const item = menuVisibility.find(m => m.menu_id === menuId);
    if (!item) return 'none';

    if (item.enabled_users?.includes(userId)) return 'enabled';
    if (item.disabled_users?.includes(userId)) return 'disabled';
    return 'none';
  };

  const handleUserOverride = async (menuId: string, userId: string, status: 'enabled' | 'disabled' | 'none') => {
    if (status === 'none') {
      const success = await removeUserOverride(menuId, userId);
      if (success) {
        showSuccess('User override removed');
      } else {
        showError('Failed to remove override');
      }
    } else {
      const success = await addUserOverride(menuId, userId, status === 'enabled');
      if (success) {
        showSuccess('User override added');
      } else {
        showError('Failed to add override');
      }
    }
  };

  const getOverrideCount = (menuId: string): number => {
    const item = menuVisibility.find(m => m.menu_id === menuId);
    if (!item) return 0;
    return (item.enabled_users?.length || 0) + (item.disabled_users?.length || 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading menu settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Menu Visibility Control</h2>
          <p className="text-sm text-gray-600 mt-1">
            Control which menu items are visible to each role. Check the box to show the menu item.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Menu Item</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700 min-w-[120px]">Category</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-700 min-w-[50px]">Order</th>
                <th className="text-center py-3 px-2 font-semibold text-gray-700">
                  <div className="flex items-center justify-center gap-1">
                    <Monitor className="w-4 h-4" />
                    <Tablet className="w-4 h-4" />
                    <Smartphone className="w-4 h-4" />
                  </div>
                </th>
                {roles.map(role => (
                  <th key={role} className="text-center py-3 px-2 font-semibold text-gray-700 min-w-[60px]">
                    {getRoleLabel(role)}
                  </th>
                ))}
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {menuVisibility.map(item => {
                // Get platform visibility (use new columns or fallback to legacy)
                const showDesktop = item.show_on_desktop ?? (item.available_on !== 'mobile');
                const showTablet = item.show_on_tablet ?? true;
                const showMobile = item.show_on_mobile ?? (item.available_on !== 'desktop');

                // Get platform support (does the feature have a UI for this platform?)
                const supportsDesktop = isPlatformSupported(item.menu_id, 'desktop');
                const supportsTablet = isPlatformSupported(item.menu_id, 'tablet');
                const supportsMobile = isPlatformSupported(item.menu_id, 'mobile');

                // Helper to render platform icon with correct state
                const renderPlatformIcon = (
                  platform: 'desktop' | 'tablet' | 'mobile',
                  Icon: typeof Monitor,
                  isEnabled: boolean,
                  isSupported: boolean,
                  activeColor: string,
                  activeBg: string
                ) => {
                  if (!isSupported) {
                    // Unsupported: show crossed-out icon
                    return (
                      <div
                        className="p-1.5 rounded bg-gray-50 relative cursor-not-allowed"
                        title={`Not available on ${platform} (no ${platform} UI)`}
                      >
                        <Icon className="w-4 h-4 text-gray-200" />
                        {/* Diagonal line through icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-0.5 bg-gray-300 rotate-45 rounded"></div>
                        </div>
                      </div>
                    );
                  }

                  // Supported: clickable toggle
                  return (
                    <button
                      onClick={() => handleTogglePlatform(item.menu_id, platform)}
                      className={`p-1.5 rounded transition-colors ${
                        isEnabled
                          ? `${activeBg} ${activeColor} hover:opacity-80`
                          : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                      }`}
                      title={isEnabled ? `Visible on ${platform} (click to hide)` : `Hidden on ${platform} (click to show)`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                };

                return (
                <tr key={item.menu_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.menu_name}</td>
                  <td className="py-3 px-2">
                    <select
                      value={item.category || 'tools'}
                      onChange={(e) => handleUpdateCategory(item.menu_id, e.target.value as MenuCategory)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {CATEGORY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="text-center py-3 px-2">
                    <input
                      type="number"
                      value={item.sort_order || 100}
                      onChange={(e) => handleUpdateSortOrder(item.menu_id, parseInt(e.target.value) || 100)}
                      className="w-14 text-sm text-center border border-gray-300 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={1}
                      max={999}
                    />
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {renderPlatformIcon('desktop', Monitor, showDesktop, supportsDesktop, 'text-blue-600', 'bg-blue-100')}
                      {renderPlatformIcon('tablet', Tablet, showTablet, supportsTablet, 'text-purple-600', 'bg-purple-100')}
                      {renderPlatformIcon('mobile', Smartphone, showMobile, supportsMobile, 'text-green-600', 'bg-green-100')}
                    </div>
                  </td>
                  {roles.map(role => {
                    const isVisible = item.visible_for_roles?.includes(role);
                    return (
                      <td key={role} className="text-center py-3 px-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => handleToggleRole(item.menu_id, role)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          />
                        </label>
                      </td>
                    );
                  })}
                  <td className="text-center py-3 px-4">
                    <button
                      onClick={() => openUserModal(item.menu_id)}
                      className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <Users className="w-4 h-4" />
                      <span>Manage</span>
                      {getOverrideCount(item.menu_id) > 0 && (
                        <span className="ml-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {getOverrideCount(item.menu_id)}
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <p className="text-sm text-blue-800">
            <strong>Category:</strong> Controls which section the item appears in on mobile navigation.
            <strong> Order:</strong> Lower numbers appear first within each category.
          </p>
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Role settings apply to all users with that role.
            User overrides let you enable/disable specific menu items for individual users.
          </p>
        </div>
      </div>

      {/* User Override Modal */}
      {showUserModal && selectedMenuItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">User Overrides</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {menuVisibility.find(m => m.menu_id === selectedMenuItem)?.menu_name}
                </p>
              </div>
              <button
                onClick={closeUserModal}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingUsers ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading users...</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map(user => {
                    const overrideStatus = getUserOverrideStatus(selectedMenuItem, user.id);
                    const menuItem = menuVisibility.find(m => m.menu_id === selectedMenuItem);
                    const roleAllows = menuItem?.visible_for_roles?.includes(user.role);

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Role: <span className="font-medium capitalize">{user.role}</span>
                            {roleAllows && overrideStatus === 'none' && (
                              <span className="ml-2 text-green-600">✓ Visible by role</span>
                            )}
                            {!roleAllows && overrideStatus === 'none' && (
                              <span className="ml-2 text-red-600">✗ Hidden by role</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleUserOverride(selectedMenuItem, user.id, overrideStatus === 'enabled' ? 'none' : 'enabled')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              overrideStatus === 'enabled'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                            }`}
                          >
                            {overrideStatus === 'enabled' && <Check className="w-4 h-4 inline mr-1" />}
                            Enable
                          </button>
                          <button
                            onClick={() => handleUserOverride(selectedMenuItem, user.id, overrideStatus === 'disabled' ? 'none' : 'disabled')}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                              overrideStatus === 'disabled'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700'
                            }`}
                          >
                            {overrideStatus === 'disabled' && <Check className="w-4 h-4 inline mr-1" />}
                            Disable
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={closeUserModal}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuVisibilitySettings;
