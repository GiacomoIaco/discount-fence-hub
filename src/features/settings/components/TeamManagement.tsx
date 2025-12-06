import { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, Trash2, Ban, CheckCircle, X, Search, Filter, Pencil, Phone } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { showInfo, showSuccess, showError } from '../../../lib/toast';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  is_used: boolean;
  inviter_name?: string;
}

interface TeamManagementProps {
  userRole: UserRole;
}

const TeamManagement = ({ userRole }: TeamManagementProps) => {
  const { profile } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales');
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const canManageUsers = userRole === 'admin' || userRole === 'sales-manager';

  useEffect(() => {
    if (canManageUsers) {
      loadTeamMembers();
      loadInvitations();
    }
  }, [canManageUsers]);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          *,
          inviter:invited_by(full_name)
        `)
        .eq('is_used', false)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      const enrichedInvitations = data?.map(inv => ({
        ...inv,
        inviter_name: inv.inviter?.full_name || 'Unknown'
      })) || [];

      setInvitations(enrichedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !canManageUsers || !profile) return;

    setInviting(true);
    try {
      const response = await fetch('/.netlify/functions/send-invitation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          invitedBy: profile.id,
          invitedByName: profile.full_name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      const message = `Invitation created! Share this link with ${inviteEmail}:\n\n${result.invitationLink}`;
      showInfo(message, 10000);

      setInviteEmail('');
      setInviteRole('sales');
      setShowInviteModal(false);
      loadInvitations();
    } catch (error) {
      console.error('Error inviting user:', error);
      showError(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMember || userRole !== 'admin') return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone || null,
        })
        .eq('id', editingMember.id);

      if (error) throw error;

      showSuccess('User updated successfully');
      setShowEditModal(false);
      setEditingMember(null);
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating user:', error);
      showError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (userRole !== 'admin') return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      loadTeamMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      showError('Failed to update role');
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    if (userRole !== 'admin') return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      loadTeamMembers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userRole !== 'admin' || !profile) return;
    if (userId === profile.id) {
      showError('You cannot delete your own account');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${userName}? This action cannot be undone.`)) return;

    try {
      const response = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          requestingUserId: profile.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      showSuccess(result.message);
      loadTeamMembers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showError(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    if (!canManageUsers) return;
    if (!confirm('Delete this invitation?')) return;

    try {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;
      loadInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      showError('Failed to delete invitation');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'sales-manager': return 'bg-blue-100 text-blue-800';
      case 'operations': return 'bg-green-100 text-green-800';
      case 'yard': return 'bg-amber-100 text-amber-800';
      case 'sales': return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'sales-manager': return 'Sales Mgr';
      case 'operations': return 'Operations';
      case 'yard': return 'Yard';
      case 'sales': return 'Sales';
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Handle different lengths
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    // Return original if can't format
    return phone;
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (!canManageUsers) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <Shield className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600">
          You don't have permission to manage team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Team Management</h2>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="sales-manager">Sales Manager</option>
            <option value="operations">Operations</option>
            <option value="yard">Yard</option>
            <option value="sales">Sales</option>
          </select>
        </div>
      </div>

      {/* Pending Invitations Table */}
      {invitations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-blue-200 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-gray-900 text-sm">Pending Invitations ({invitations.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-100/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Email</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Invited By</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Expires</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-700 w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-100">
                {invitations.map(invitation => (
                  <tr key={invitation.id} className="hover:bg-blue-50/50">
                    <td className="px-4 py-2 text-gray-900">{invitation.email}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(invitation.role)}`}>
                        {getRoleLabel(invitation.role)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{invitation.inviter_name}</td>
                    <td className="px-4 py-2 text-gray-600">{new Date(invitation.expires_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteInvitation(invitation.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Members Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200">
          <span className="font-medium text-gray-900 text-sm">Team Members ({filteredMembers.length})</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No team members found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Email</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Phone</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Joined</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Role</th>
                  {userRole === 'admin' && (
                    <th className="text-center px-4 py-2 font-medium text-gray-700 w-32">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map(member => (
                  <tr key={member.id} className={`hover:bg-gray-50 ${!member.is_active ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 font-medium text-xs">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-900 truncate">{member.full_name}</span>
                            {member.id === profile?.id && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">You</span>
                            )}
                            {!member.is_active && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Inactive</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 truncate max-w-[200px]">{member.email}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {member.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {formatPhoneNumber(member.phone)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {userRole === 'admin' && member.id !== profile?.id ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value as UserRole)}
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadgeColor(member.role)}`}
                        >
                          <option value="sales">Sales</option>
                          <option value="operations">Operations</option>
                          <option value="yard">Yard</option>
                          <option value="sales-manager">Sales Mgr</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                          {getRoleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {member.id !== profile?.id && (
                            <>
                              <button
                                onClick={() => handleToggleActive(member.id, member.is_active)}
                                className={`p-1 rounded ${
                                  member.is_active
                                    ? 'text-orange-600 hover:bg-orange-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                                title={member.is_active ? 'Block' : 'Unblock'}
                              >
                                {member.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(member.id, member.full_name)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sales">Sales</option>
                  <option value="operations">Operations</option>
                  <option value="yard">Yard</option>
                  <option value="sales-manager">Sales Manager</option>
                  {userRole === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteEmail}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit User</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Required for SMS notifications</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editForm.full_name || !editForm.email}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
