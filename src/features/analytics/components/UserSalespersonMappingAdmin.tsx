/**
 * Admin interface for managing user-to-salesperson mappings
 * Allows admins to link app users to their Jobber salesperson names
 * Can be used as a modal or as a standalone settings page
 */

import { useState } from 'react';
import { X, User, Link2, Check, AlertCircle, Trash2, Search, Pencil } from 'lucide-react';
import { useAllSalespersonMappings, useDistinctSalespeople, useUpdateSalespersonMapping, useDeleteSalespersonMapping } from '../hooks/useUserSalespersonMapping';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';

/**
 * Inner content component - used by both modal and settings page versions
 */
function UserSalespersonMappingContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('');

  // Fetch all users
  const { data: users = [] } = useQuery({
    queryKey: ['all_users_for_mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing mappings
  const { data: mappings = [], isLoading: mappingsLoading } = useAllSalespersonMappings();

  // Fetch available salespeople from Jobber data
  const { data: salespeople = [] } = useDistinctSalespeople();

  // Mutations
  const updateMapping = useUpdateSalespersonMapping();
  const deleteMapping = useDeleteSalespersonMapping();

  // Create a lookup for existing mappings
  const mappingsByUserId = Object.fromEntries(
    mappings.map(m => [m.user_id, m])
  );

  // Filter users by search term
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveMapping = async (userId: string) => {
    if (!selectedSalesperson) {
      toast.error('Please select a salesperson');
      return;
    }

    try {
      await updateMapping.mutateAsync({
        userId,
        salespersonName: selectedSalesperson,
        isVerified: true,
      });
      toast.success('Mapping saved');
      setEditingUserId(null);
      setSelectedSalesperson('');
    } catch {
      toast.error('Failed to save mapping');
    }
  };

  const handleDeleteMapping = async (userId: string) => {
    try {
      await deleteMapping.mutateAsync(userId);
      toast.success('Mapping removed');
    } catch {
      toast.error('Failed to remove mapping');
    }
  };

  const startEditing = (userId: string, currentSalesperson?: string) => {
    setEditingUserId(userId);
    setSelectedSalesperson(currentSalesperson || '');
  };

  return (
    <>
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <AlertCircle className="w-4 h-4" />
        <span>
          {mappings.length} of {users.length} users mapped.
          Unlinked users won't see their analytics on mobile.
        </span>
      </div>

      {/* User List */}
      <div className="space-y-3">
        {mappingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No users found
          </div>
        ) : (
          filteredUsers.map((user) => {
            const mapping = mappingsByUserId[user.id];
            const isEditing = editingUserId === user.id;

            return (
              <div
                key={user.id}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  mapping ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white',
                  isEditing && 'ring-2 ring-blue-500'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* User info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{user.full_name}</div>
                      <div className="text-sm text-gray-500 truncate">{user.email}</div>
                      <div className="text-xs text-gray-400 capitalize">{user.role}</div>
                    </div>
                  </div>

                  {/* Mapping status / actions */}
                  <div className="flex-shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSalesperson}
                          onChange={(e) => setSelectedSalesperson(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                        >
                          <option value="">Select salesperson...</option>
                          {salespeople.map((sp) => (
                            <option key={sp} value={sp}>{sp}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSaveMapping(user.id)}
                          disabled={!selectedSalesperson || updateMapping.isPending}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingUserId(null);
                            setSelectedSalesperson('');
                          }}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : mapping ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm">
                          <Link2 className="w-4 h-4" />
                          <span className="font-medium">{mapping.salesperson_name}</span>
                          {mapping.is_verified && (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                        <button
                          onClick={() => startEditing(user.id, mapping.salesperson_name)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMapping(user.id)}
                          disabled={deleteMapping.isPending}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Remove mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(user.id)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                      >
                        <Link2 className="w-4 h-4" />
                        Link to Jobber
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto-match indicator */}
                {mapping && mapping.match_type !== 'manual' && !mapping.is_verified && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Auto-matched ({mapping.match_type}, {Math.round(mapping.match_confidence * 100)}% confidence)
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/**
 * Modal version - for use in MobileAnalyticsView or other places
 */
interface UserSalespersonMappingAdminProps {
  onClose: () => void;
}

export function UserSalespersonMappingAdmin({ onClose }: UserSalespersonMappingAdminProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">User-Salesperson Mappings</h2>
            <p className="text-sm text-gray-500">Link app users to their Jobber salesperson data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <UserSalespersonMappingContent />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings page version - for use in desktop Settings
 */
export function SalespersonMappingSettings() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <UserSalespersonMappingContent />
    </div>
  );
}

export default UserSalespersonMappingAdmin;
