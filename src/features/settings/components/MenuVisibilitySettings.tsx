import { useState, useEffect } from 'react';
import { useMenuVisibility } from '../../../hooks/useMenuVisibility';
import type { Platform } from '../../../hooks/useMenuVisibility';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { X, Users, Check, Monitor, Tablet, Smartphone } from 'lucide-react';

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

                return (
                <tr key={item.menu_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{item.menu_name}</td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {/* Desktop icon */}
                      <button
                        onClick={() => handleTogglePlatform(item.menu_id, 'desktop')}
                        className={`p-1.5 rounded transition-colors ${
                          showDesktop
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                        }`}
                        title={showDesktop ? 'Visible on desktop (click to hide)' : 'Hidden on desktop (click to show)'}
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                      {/* Tablet icon */}
                      <button
                        onClick={() => handleTogglePlatform(item.menu_id, 'tablet')}
                        className={`p-1.5 rounded transition-colors ${
                          showTablet
                            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                        }`}
                        title={showTablet ? 'Visible on tablet (click to hide)' : 'Hidden on tablet (click to show)'}
                      >
                        <Tablet className="w-4 h-4" />
                      </button>
                      {/* Phone icon */}
                      <button
                        onClick={() => handleTogglePlatform(item.menu_id, 'mobile')}
                        className={`p-1.5 rounded transition-colors ${
                          showMobile
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-400'
                        }`}
                        title={showMobile ? 'Visible on phone (click to hide)' : 'Hidden on phone (click to show)'}
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
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

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Role settings apply to all users with that role.
            User overrides let you enable/disable specific menu items for individual users,
            regardless of their role settings.
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
