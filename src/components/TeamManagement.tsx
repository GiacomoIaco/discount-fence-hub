import { useState, useEffect } from 'react';
import { Users, UserPlus, Mail, Shield, Trash2, Ban, CheckCircle, X, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { showInfo } from '../lib/toast';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin';

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('sales');
  const [inviting, setInviting] = useState(false);
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
        .order('created_at', { ascending: false });

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
      // Create invitation
      const { data: invitation, error: invError } = await supabase
        .from('user_invitations')
        .insert({
          email: inviteEmail,
          role: inviteRole,
          invited_by: profile.id,
        })
        .select()
        .single();

      if (invError) throw invError;

      // TODO: Send invitation email via Netlify function
      // For now, just show success message with invitation link
      const inviteLink = `${window.location.origin}/signup?token=${invitation.token}`;

      const message = `Invitation created! Share this message with ${inviteEmail}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Welcome to Discount Fence Hub!

You've been invited to join our team.

1️⃣ Click this link to sign up:
${inviteLink}

2️⃣ After signing in, install the app:
   • iPhone/iPad: Tap Share → Add to Home Screen
   • Android: Tap Menu → Install App
   • Desktop: Look for install icon in address bar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      showInfo(message);

      setInviteEmail('');
      setInviteRole('sales');
      setShowInviteModal(false);
      loadInvitations();
    } catch (error) {
      console.error('Error inviting user:', error);
      showInfo('Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
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
      showInfo('Failed to update role');
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
      showInfo('Failed to update user status');
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
      showInfo('Failed to delete invitation');
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'sales-manager': return 'bg-blue-100 text-blue-800';
      case 'operations': return 'bg-green-100 text-green-800';
      case 'sales': return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'sales-manager': return 'Sales Manager';
      case 'operations': return 'Operations';
      case 'sales': return 'Sales';
    }
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
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Shield className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">
            You don't have permission to manage team members.
            <br />
            Contact an administrator for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Invite User</span>
          </button>
        </div>
        <p className="text-gray-600">
          Manage team members, roles, and invitations
        </p>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="sales-manager">Sales Manager</option>
              <option value="operations">Operations</option>
              <option value="sales">Sales</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <span>Pending Invitations ({invitations.length})</span>
          </h3>
          <div className="space-y-3">
            {invitations.map(invitation => (
              <div key={invitation.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{invitation.email}</p>
                  <p className="text-sm text-gray-500">
                    Invited by {invitation.inviter_name} • {new Date(invitation.invited_at).toLocaleDateString()}
                    {' • Expires '}{new Date(invitation.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(invitation.role)}`}>
                    {getRoleLabel(invitation.role)}
                  </span>
                  <button
                    onClick={() => handleDeleteInvitation(invitation.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete invitation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Team Members ({filteredMembers.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading team members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No team members found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredMembers.map(member => (
              <div key={member.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {member.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-gray-900">{member.full_name}</h4>
                        {!member.is_active && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                            Inactive
                          </span>
                        )}
                        {member.id === profile?.id && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      {member.phone && (
                        <p className="text-sm text-gray-500">{member.phone}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Role Selector (Admin only) */}
                    {userRole === 'admin' && member.id !== profile?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value as UserRole)}
                        className={`px-3 py-1 rounded-full text-sm font-medium border-2 ${getRoleBadgeColor(member.role)}`}
                      >
                        <option value="sales">Sales</option>
                        <option value="operations">Operations</option>
                        <option value="sales-manager">Sales Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(member.role)}`}>
                        {getRoleLabel(member.role)}
                      </span>
                    )}

                    {/* Actions (Admin only, not on self) */}
                    {userRole === 'admin' && member.id !== profile?.id && (
                      <button
                        onClick={() => handleToggleActive(member.id, member.is_active)}
                        className={`p-2 rounded-lg ${
                          member.is_active
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={member.is_active ? 'Deactivate user' : 'Activate user'}
                      >
                        {member.is_active ? <Ban className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sales">Sales</option>
                  <option value="operations">Operations</option>
                  <option value="sales-manager">Sales Manager</option>
                  {userRole === 'admin' && <option value="admin">Admin</option>}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteEmail}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
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
