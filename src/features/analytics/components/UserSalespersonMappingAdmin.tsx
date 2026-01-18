/**
 * Admin interface for managing user-to-salesperson mappings
 * Allows admins to link app users to their Jobber salesperson names
 * Can be used as a modal or as a standalone settings page
 * Supports auto-matching based on name similarity
 */

import { useState, useMemo } from 'react';
import { X, User, Link2, Check, AlertCircle, Trash2, Search, Pencil, Wand2, Sparkles } from 'lucide-react';
import { useAllSalespersonMappings, useAllJobberSalespeople, useUpdateSalespersonMapping, useDeleteSalespersonMapping } from '../hooks/useUserSalespersonMapping';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

interface MatchSuggestion {
  salesperson: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
}

/**
 * Find the best matching salesperson for a user based on name similarity
 */
function findBestMatch(userName: string | null, salespeople: string[]): MatchSuggestion | null {
  if (!userName || salespeople.length === 0) return null;

  const normalizedUserName = userName.toLowerCase().trim();
  const userNameParts = normalizedUserName.split(/\s+/);
  const userFirstName = userNameParts[0] || '';
  const userLastName = userNameParts[userNameParts.length - 1] || '';

  let bestMatch: MatchSuggestion | null = null;

  for (const sp of salespeople) {
    const normalizedSp = sp.toLowerCase().trim();
    const spParts = normalizedSp.split(/\s+/);
    const spFirstName = spParts[0] || '';
    const spLastName = spParts[spParts.length - 1] || '';

    // Exact match (full name)
    if (normalizedUserName === normalizedSp) {
      return { salesperson: sp, confidence: 1.0, matchType: 'exact' };
    }

    // First + Last name match
    if (userFirstName === spFirstName && userLastName === spLastName) {
      if (!bestMatch || bestMatch.confidence < 0.95) {
        bestMatch = { salesperson: sp, confidence: 0.95, matchType: 'exact' };
      }
      continue;
    }

    // First name only match (common for short names)
    if (userFirstName === spFirstName && userFirstName.length > 2) {
      if (!bestMatch || bestMatch.confidence < 0.7) {
        bestMatch = { salesperson: sp, confidence: 0.7, matchType: 'fuzzy' };
      }
      continue;
    }

    // Partial match: one name contains the other
    if (normalizedUserName.includes(normalizedSp) || normalizedSp.includes(normalizedUserName)) {
      if (!bestMatch || bestMatch.confidence < 0.6) {
        bestMatch = { salesperson: sp, confidence: 0.6, matchType: 'partial' };
      }
      continue;
    }

    // First name starts with match
    if (spFirstName.startsWith(userFirstName) || userFirstName.startsWith(spFirstName)) {
      if (!bestMatch || bestMatch.confidence < 0.5) {
        bestMatch = { salesperson: sp, confidence: 0.5, matchType: 'partial' };
      }
    }
  }

  return bestMatch;
}

/**
 * Inner content component - used by both modal and settings page versions
 */
function UserSalespersonMappingContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('');
  const [isAutoMatching, setIsAutoMatching] = useState(false);

  // Fetch all users
  const { data: users = [] } = useQuery({
    queryKey: ['all_users_for_mapping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      return (data || []) as UserProfile[];
    },
  });

  // Fetch existing mappings
  const { data: mappings = [], isLoading: mappingsLoading } = useAllSalespersonMappings();

  // Fetch available salespeople from Jobber data (both residential and builder)
  const { data: salespeople = [] } = useAllJobberSalespeople();

  // Mutations
  const updateMapping = useUpdateSalespersonMapping();
  const deleteMapping = useDeleteSalespersonMapping();

  // Create a lookup for existing mappings
  const mappingsByUserId = Object.fromEntries(
    mappings.map(m => [m.user_id, m])
  );

  // Calculate suggested matches for unmapped users
  const suggestedMatches = useMemo(() => {
    const suggestions: Record<string, MatchSuggestion | null> = {};
    for (const user of users) {
      if (!mappingsByUserId[user.id]) {
        suggestions[user.id] = findBestMatch(user.full_name, salespeople);
      }
    }
    return suggestions;
  }, [users, salespeople, mappingsByUserId]);

  // Filter users by search term
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count unmapped users with high-confidence suggestions
  const autoMatchableCount = useMemo(() => {
    return Object.values(suggestedMatches).filter(s => s && s.confidence >= 0.7).length;
  }, [suggestedMatches]);

  const handleSaveMapping = async (userId: string, salespersonName?: string) => {
    const spName = salespersonName || selectedSalesperson;
    if (!spName) {
      toast.error('Please select a salesperson');
      return;
    }

    try {
      await updateMapping.mutateAsync({
        userId,
        salespersonName: spName,
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

  const handleAutoMatchAll = async () => {
    const toMatch = Object.entries(suggestedMatches)
      .filter(([, suggestion]) => suggestion && suggestion.confidence >= 0.7)
      .map(([userId, suggestion]) => ({ userId, salesperson: suggestion!.salesperson }));

    if (toMatch.length === 0) {
      toast.error('No high-confidence matches found');
      return;
    }

    setIsAutoMatching(true);
    let successCount = 0;
    let errorCount = 0;

    for (const { userId, salesperson } of toMatch) {
      try {
        await updateMapping.mutateAsync({
          userId,
          salespersonName: salesperson,
          isVerified: false, // Auto-matched, not manually verified
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsAutoMatching(false);

    if (errorCount === 0) {
      toast.success(`Auto-matched ${successCount} users`);
    } else {
      toast.success(`Matched ${successCount} users, ${errorCount} failed`);
    }
  };

  const startEditing = (userId: string, currentSalesperson?: string) => {
    setEditingUserId(userId);
    setSelectedSalesperson(currentSalesperson || '');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-blue-600 bg-blue-50';
    return 'text-amber-600 bg-amber-50';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Good';
    return 'Low';
  };

  return (
    <>
      {/* Header with Auto-Match button */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {autoMatchableCount > 0 && (
          <button
            onClick={handleAutoMatchAll}
            disabled={isAutoMatching}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Wand2 className="w-4 h-4" />
            {isAutoMatching ? 'Matching...' : `Auto-Match ${autoMatchableCount} Users`}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <AlertCircle className="w-4 h-4" />
        <span>
          {mappings.length} of {users.length} users mapped.
          {autoMatchableCount > 0 && (
            <span className="text-purple-600 ml-1">
              {autoMatchableCount} can be auto-matched.
            </span>
          )}
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
            const suggestion = suggestedMatches[user.id];

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
                      <div className="flex items-center gap-2">
                        {/* Show suggestion if available */}
                        {suggestion && suggestion.confidence >= 0.5 && (
                          <button
                            onClick={() => handleSaveMapping(user.id, suggestion.salesperson)}
                            disabled={updateMapping.isPending}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border',
                              getConfidenceColor(suggestion.confidence)
                            )}
                            title={`Auto-match: ${suggestion.salesperson} (${Math.round(suggestion.confidence * 100)}% confidence)`}
                          >
                            <Sparkles className="w-4 h-4" />
                            <span className="hidden sm:inline">{suggestion.salesperson}</span>
                            <span className="text-xs opacity-75">
                              ({getConfidenceLabel(suggestion.confidence)})
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => startEditing(user.id)}
                          className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          <Link2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Manual</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-match indicator for existing mappings */}
                {mapping && mapping.match_type !== 'manual' && !mapping.is_verified && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Auto-matched ({mapping.match_type}, {Math.round(mapping.match_confidence * 100)}% confidence) - Click to verify
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
