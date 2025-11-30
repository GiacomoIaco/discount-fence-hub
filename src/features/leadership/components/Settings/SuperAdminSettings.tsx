import { useState } from 'react';
import { ArrowLeft, Shield, Search, X, Plus, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { useUsers } from '../../../requests/hooks/useRequests';

interface SuperAdminSettingsProps {
  onBack: () => void;
}

interface SuperAdmin {
  id: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
}

export default function SuperAdminSettings({ onBack }: SuperAdminSettingsProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch all super admins
  const { data: superAdmins, isLoading } = useQuery({
    queryKey: ['super-admins'],
    queryFn: async (): Promise<SuperAdmin[]> => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, is_super_admin')
        .eq('is_super_admin', true);

      if (error) throw error;
      return data || [];
    },
  });

  // Add super admin mutation
  const addSuperAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_super_admin: true })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] });
      setShowAddModal(false);
    },
  });

  // Remove super admin mutation
  const removeSuperAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_super_admin: false })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admins'] });
    },
  });

  const handleRemove = async (admin: SuperAdmin) => {
    if (admin.id === profile?.id) {
      alert("You cannot remove yourself as Super Admin!");
      return;
    }

    if (!confirm(`Remove ${admin.full_name} as Super Admin?`)) return;

    try {
      await removeSuperAdmin.mutateAsync(admin.id);
    } catch (error) {
      console.error('Failed to remove super admin:', error);
      alert('Failed to remove super admin');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Management</h1>
              <p className="text-sm text-gray-600">
                Manage users with full system access
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Sensitive Privilege</h3>
              <p className="text-sm text-amber-700 mt-1">
                Super Admins have unrestricted access to all features across the entire application,
                including Leadership Hub, all functions, CEO scoring, and system settings.
                Only grant this to trusted users.
              </p>
            </div>
          </div>
        </div>

        {/* Super Admins List */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Super Admins</h2>
              <span className="text-sm text-gray-500">({superAdmins?.length || 0})</span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Super Admin
            </button>
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading...</p>
              </div>
            ) : superAdmins && superAdmins.length > 0 ? (
              <div className="space-y-3">
                {superAdmins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                        <span className="text-purple-700 font-semibold">
                          {admin.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {admin.full_name}
                          {admin.id === profile?.id && (
                            <span className="ml-2 text-xs text-purple-600">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{admin.email}</div>
                      </div>
                    </div>
                    {admin.id !== profile?.id && (
                      <button
                        onClick={() => handleRemove(admin)}
                        disabled={removeSuperAdmin.isPending}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No super admins found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Super Admin Modal */}
      {showAddModal && (
        <AddSuperAdminModal
          existingSuperAdminIds={superAdmins?.map(a => a.id) || []}
          onAdd={(userId) => addSuperAdmin.mutateAsync(userId)}
          onClose={() => setShowAddModal(false)}
          isLoading={addSuperAdmin.isPending}
        />
      )}
    </div>
  );
}

interface AddSuperAdminModalProps {
  existingSuperAdminIds: string[];
  onAdd: (userId: string) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function AddSuperAdminModal({ existingSuperAdminIds, onAdd, onClose, isLoading }: AddSuperAdminModalProps) {
  const [search, setSearch] = useState('');
  const { users, loading: usersLoading } = useUsers();

  const filteredUsers = users
    .filter(user => !existingSuperAdminIds.includes(user.id))
    .filter(user =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleSelect = async (userId: string) => {
    if (!confirm('Are you sure you want to grant Super Admin privileges to this user? They will have full access to all system features.')) {
      return;
    }

    try {
      await onAdd(userId);
    } catch (error) {
      console.error('Failed to add super admin:', error);
      alert('Failed to add super admin');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Super Admin</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* User List */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            {usersLoading ? (
              <div className="p-4 text-center text-gray-500">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {search ? 'No users match your search' : 'No available users'}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-purple-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
