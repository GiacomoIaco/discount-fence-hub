import { useState } from 'react';
import { ArrowLeft, Search, X, Crown, Users, Plus, Shield } from 'lucide-react';
import {
  useFunctionsQuery,
  useFunctionOwnersQuery,
  useFunctionMembersQuery,
  useAddFunctionOwner,
  useRemoveFunctionOwner,
  useAddFunctionMember,
  useRemoveFunctionMember,
} from '../../hooks/useLeadershipQuery';
import { useLeadershipPermissions } from '../../hooks/useLeadershipPermissions';
import { useUsers } from '../../../requests/hooks/useRequests';

interface AccessManagementProps {
  onBack: () => void;
}

export default function AccessManagement({ onBack }: AccessManagementProps) {
  const { data: functions, isLoading: functionsLoading } = useFunctionsQuery();
  const { isSuperAdmin, canManageOwners } = useLeadershipPermissions();

  if (functionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading access management...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">Access Management</h1>
              <p className="text-sm text-gray-600">
                Manage function owners and members
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Legend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Access Levels</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 p-1.5 rounded">
                <Crown className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <span className="font-medium text-gray-900">Function Owner</span>
                <p className="text-gray-600 text-xs mt-0.5">
                  Can view all functions in Leadership Hub, edit their own function, and manage members
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-1.5 rounded">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <span className="font-medium text-gray-900">Function Member</span>
                <p className="text-gray-600 text-xs mt-0.5">
                  Can see Team View in My Todos for their function (no Leadership Hub access)
                </p>
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-purple-700">
              <Shield className="w-4 h-4" />
              <span>You are a Super Admin - you can manage owners and members for all functions</span>
            </div>
          )}
        </div>

        {/* Functions List */}
        <div className="space-y-4">
          {functions && functions.length > 0 ? (
            functions.map((func) => (
              <FunctionAccessCard
                key={func.id}
                functionId={func.id}
                functionName={func.name}
                functionColor={func.color}
                canManageOwners={canManageOwners}
              />
            ))
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No functions found. Create functions first in Functions & Areas settings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FunctionAccessCardProps {
  functionId: string;
  functionName: string;
  functionColor?: string;
  canManageOwners: boolean;
}

function FunctionAccessCard({ functionId, functionName, functionColor, canManageOwners }: FunctionAccessCardProps) {
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: owners, isLoading: ownersLoading } = useFunctionOwnersQuery(functionId);
  const { data: members, isLoading: membersLoading } = useFunctionMembersQuery(functionId);
  const { canManageMembers } = useLeadershipPermissions(functionId);

  const addOwner = useAddFunctionOwner();
  const removeOwner = useRemoveFunctionOwner();
  const addMember = useAddFunctionMember();
  const removeMember = useRemoveFunctionMember();

  const handleAddOwner = async (userId: string) => {
    try {
      await addOwner.mutateAsync({ functionId, userId });
      setShowAddOwner(false);
    } catch (error) {
      console.error('Failed to add owner:', error);
    }
  };

  const handleRemoveOwner = async (ownerId: string) => {
    if (!confirm('Remove this owner from the function?')) return;
    try {
      await removeOwner.mutateAsync({ id: ownerId, functionId });
    } catch (error) {
      console.error('Failed to remove owner:', error);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await addMember.mutateAsync({ functionId, userId });
      setShowAddMember(false);
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!confirm('Remove this member from the function?')) return;
    try {
      await removeMember.mutateAsync({ id: memberId, functionId, userId });
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  // Get IDs of users already assigned to exclude from picker
  const ownerIds = owners?.map(o => o.user_id) || [];
  const memberIds = members?.map(m => m.user_id) || [];
  const excludeFromOwnerPicker = [...ownerIds];
  const excludeFromMemberPicker = [...ownerIds, ...memberIds]; // Members can't be owners

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-100"
        style={{ borderLeftWidth: '4px', borderLeftColor: functionColor || '#6B7280' }}
      >
        <h3 className="text-base font-semibold text-gray-900">{functionName}</h3>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Owners Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">Owners</span>
              <span className="text-xs text-gray-400">({owners?.length || 0})</span>
            </div>
            {canManageOwners && (
              <button
                onClick={() => setShowAddOwner(true)}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Owner
              </button>
            )}
          </div>

          {ownersLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : owners && owners.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {owners.map((owner) => (
                <span
                  key={owner.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700 text-white text-xs font-medium rounded-full"
                >
                  {owner.user_profile?.full_name || 'Unknown'}
                  {canManageOwners && (
                    <button
                      onClick={() => handleRemoveOwner(owner.id)}
                      className="ml-0.5 hover:bg-slate-600 rounded-full p-0.5"
                      title="Remove owner"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">No owners assigned</div>
          )}

          {/* Add Owner Modal */}
          {showAddOwner && (
            <UserPickerModal
              title="Add Function Owner"
              excludeUserIds={excludeFromOwnerPicker}
              onSelect={handleAddOwner}
              onClose={() => setShowAddOwner(false)}
              isLoading={addOwner.isPending}
            />
          )}
        </div>

        {/* Members Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Members</span>
              <span className="text-xs text-gray-400">({members?.length || 0})</span>
            </div>
            {canManageMembers && (
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-3 h-3" />
                Add Member
              </button>
            )}
          </div>

          {membersLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : members && members.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-700 text-white text-xs font-medium rounded-full"
                >
                  {member.user_profile?.full_name || 'Unknown'}
                  {canManageMembers && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.user_id)}
                      className="ml-0.5 hover:bg-slate-600 rounded-full p-0.5"
                      title="Remove member"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">No members assigned</div>
          )}

          {/* Add Member Modal */}
          {showAddMember && (
            <UserPickerModal
              title="Add Function Member"
              excludeUserIds={excludeFromMemberPicker}
              onSelect={handleAddMember}
              onClose={() => setShowAddMember(false)}
              isLoading={addMember.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface UserPickerModalProps {
  title: string;
  excludeUserIds: string[];
  onSelect: (userId: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

function UserPickerModal({ title, excludeUserIds, onSelect, onClose, isLoading }: UserPickerModalProps) {
  const [search, setSearch] = useState('');
  const { users, loading: usersLoading } = useUsers();

  const filteredUsers = users
    .filter(user => !excludeUserIds.includes(user.id))
    .filter(user =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  onClick={() => onSelect(user.id)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50"
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
