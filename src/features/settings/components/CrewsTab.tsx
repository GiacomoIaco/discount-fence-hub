import { useState, useMemo, useEffect } from 'react';
import { UserPlus, Phone, Send, Trash2, X, Search, Wifi, WifiOff, Clock, AlertCircle } from 'lucide-react';
import { useCrews, useCreateCrew } from '../../fsm/hooks/useCrews';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { showSuccess, showError, showInfo } from '../../../lib/toast';
import type { Crew } from '../../fsm/types';

interface CrewInvitation {
  id: string;
  phone?: string;
  role: string;
  sent_at: string;
  expires_at: string;
  is_used: boolean;
  reminder_count?: number;
  last_reminder_sent_at?: string;
}

type StatusFilter = 'all' | 'internal' | 'contractor' | 'connected' | 'not_invited';

type CrewAppStatus = 'connected' | 'invited' | 'expired' | 'not_invited';

interface CrewWithStatus extends Crew {
  appStatus: CrewAppStatus;
  invitation?: CrewInvitation;
}

const CrewsTab = () => {
  const { profile } = useAuth();
  const { data: crews = [], isLoading: crewsLoading, refetch: refetchCrews } = useCrews();
  const createCrew = useCreateCrew();

  const [invitations, setInvitations] = useState<CrewInvitation[]>([]);
  const [invitationsLoaded, setInvitationsLoaded] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Invite form
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteIsContractor, setInviteIsContractor] = useState(true);
  const [inviteLanguage, setInviteLanguage] = useState<'en' | 'es'>('es');
  const [inviteCrewId, setInviteCrewId] = useState<string | null>(null); // null = new crew

  // Load crew-role invitations
  useEffect(() => {
    loadCrewInvitations();
  }, []);

  async function loadCrewInvitations() {
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('id, phone, role, sent_at, expires_at, is_used, reminder_count, last_reminder_sent_at')
        .eq('role', 'crew')
        .eq('is_used', false)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading crew invitations:', error);
    } finally {
      setInvitationsLoaded(true);
    }
  }

  // Normalize phone to last 10 digits for matching
  const normPhone = (phone: string | null | undefined): string => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
  };

  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  // Build crew list with app status
  const crewsWithStatus: CrewWithStatus[] = useMemo(() => {
    return crews.map((crew) => {
      // Connected: has a lead_user_id linked
      if (crew.lead_user_id) {
        return { ...crew, appStatus: 'connected' as const };
      }

      // Check for matching invitation by invitation_id or phone
      const crewPhoneNorm = normPhone(crew.lead_phone);
      const matchingInv = invitations.find((inv) => {
        if (crew.invitation_id && inv.id === crew.invitation_id) return true;
        if (crewPhoneNorm && inv.phone) {
          return normPhone(inv.phone) === crewPhoneNorm;
        }
        return false;
      });

      if (matchingInv) {
        const isExpired = new Date(matchingInv.expires_at) < new Date();
        return {
          ...crew,
          appStatus: isExpired ? 'expired' as const : 'invited' as const,
          invitation: matchingInv,
        };
      }

      return { ...crew, appStatus: 'not_invited' as const };
    });
  }, [crews, invitations]);

  // Filter
  const filteredCrews = useMemo(() => {
    return crewsWithStatus.filter((crew) => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = crew.name.toLowerCase().includes(q);
        const matchesPhone = crew.lead_phone?.includes(searchQuery) || false;
        const matchesLeadName = crew.lead_name?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesPhone && !matchesLeadName) return false;
      }

      // Filter
      switch (filter) {
        case 'internal':
          return !crew.is_subcontractor;
        case 'contractor':
          return crew.is_subcontractor;
        case 'connected':
          return crew.appStatus === 'connected';
        case 'not_invited':
          return crew.appStatus === 'not_invited' || crew.appStatus === 'expired';
        default:
          return true;
      }
    });
  }, [crewsWithStatus, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = crewsWithStatus.length;
    const connected = crewsWithStatus.filter((c) => c.appStatus === 'connected').length;
    const invited = crewsWithStatus.filter((c) => c.appStatus === 'invited').length;
    const notInvited = crewsWithStatus.filter((c) => c.appStatus === 'not_invited' || c.appStatus === 'expired').length;
    return { total, connected, invited, notInvited };
  }, [crewsWithStatus]);

  const generateCrewCode = (name: string): string => {
    // Generate a code like "CRW-JOHN" from name
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    return `CRW-${clean || 'NEW'}`;
  };

  const openInviteForCrew = (crew: Crew) => {
    setInviteCrewId(crew.id);
    setInviteName(crew.lead_name || crew.name);
    setInvitePhone(crew.lead_phone || '');
    setInviteIsContractor(crew.is_subcontractor);
    setInviteLanguage(crew.is_subcontractor ? 'es' : 'en');
    setShowInviteModal(true);
  };

  const openNewInvite = () => {
    setInviteCrewId(null);
    setInviteName('');
    setInvitePhone('');
    setInviteIsContractor(true);
    setInviteLanguage('es');
    setShowInviteModal(true);
  };

  const handleInviteCrew = async () => {
    if (!profile || !inviteName.trim() || !invitePhone.trim()) return;

    setInviting(true);
    try {
      let crewId = inviteCrewId;

      // If new crew, create it first
      if (!crewId) {
        const code = generateCrewCode(inviteName);
        const result = await createCrew.mutateAsync({
          name: inviteName.trim(),
          code,
          crew_size: 1,
          max_daily_lf: 0,
          product_skills: [],
          business_unit_id: '',
          location_code: '',
          home_territory_id: '',
          crew_type: 'standard',
          lead_user_id: '',
          is_active: true,
          is_subcontractor: inviteIsContractor,
          lead_name: inviteName.trim(),
          lead_phone: invitePhone.trim(),
        });
        crewId = result.id;
      }

      // Send SMS invitation
      const response = await fetch('/.netlify/functions/send-invitation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: invitePhone.trim(),
          role: 'crew',
          invitedBy: profile.id,
          invitedByName: profile.full_name,
          language: inviteLanguage,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send invitation');

      // Link invitation_id to crew
      const invId = result.invitation?.id;
      if (crewId && invId) {
        await supabase
          .from('crews')
          .update({ invitation_id: invId })
          .eq('id', crewId);
      }

      showSuccess(`SMS invite sent to ${inviteName}`);
      setShowInviteModal(false);
      setInviteName('');
      setInvitePhone('');
      setInviteCrewId(null);

      // Refresh
      refetchCrews();
      loadCrewInvitations();
    } catch (error) {
      console.error('Error inviting crew:', error);
      showError(error instanceof Error ? error.message : 'Failed to invite crew');
    } finally {
      setInviting(false);
    }
  };

  const handleSendReminder = async (crew: CrewWithStatus) => {
    if (!profile || !crew.invitation) return;

    setRemindingId(crew.invitation.id);
    try {
      const response = await fetch('/.netlify/functions/send-invitation-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: crew.invitation.id,
          requestingUserId: profile.id,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send reminder');

      showSuccess(result.message || 'Reminder sent');
      loadCrewInvitations();
    } catch (error) {
      console.error('Error sending reminder:', error);
      showError(error instanceof Error ? error.message : 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  const handleDeleteInvitation = async (crew: CrewWithStatus) => {
    if (!crew.invitation) return;
    if (!confirm(`Delete invitation for ${crew.name}?`)) return;

    try {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', crew.invitation.id);

      if (error) throw error;

      // Clear invitation_id on crew
      if (crew.invitation_id) {
        await supabase
          .from('crews')
          .update({ invitation_id: null })
          .eq('id', crew.id);
      }

      showInfo('Invitation deleted');
      refetchCrews();
      loadCrewInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      showError('Failed to delete invitation');
    }
  };

  const getStatusBadge = (status: CrewAppStatus) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Wifi className="w-3 h-3" /> Connected
          </span>
        );
      case 'invited':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" /> Invited
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3" /> Expired
          </span>
        );
      case 'not_invited':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <WifiOff className="w-3 h-3" /> Not Invited
          </span>
        );
    }
  };

  const isLoading = crewsLoading || !invitationsLoaded;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{stats.total} crews</span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-green-600">{stats.connected} connected</span>
          <span className="text-xs text-blue-600">{stats.invited} invited</span>
          <span className="text-xs text-gray-500">{stats.notInvited} pending</span>
        </div>
        <button
          onClick={openNewInvite}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Crew</span>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search crews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1">
          {([
            ['all', 'All'],
            ['internal', 'Internal'],
            ['contractor', 'Contractor'],
            ['connected', 'Connected'],
            ['not_invited', 'Not Invited'],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Crew List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading crews...</div>
        ) : filteredCrews.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {crewsWithStatus.length === 0
              ? 'No crews yet. Invite your first crew!'
              : 'No crews match your filters'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Crew</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Phone</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">App Status</th>
                  <th className="text-center px-4 py-2 font-medium text-gray-700 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCrews.map((crew) => (
                  <tr key={crew.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div>
                        <span className="font-medium text-gray-900">{crew.name}</span>
                        {crew.lead_name && crew.lead_name !== crew.name && (
                          <span className="text-gray-500 text-xs ml-1">({crew.lead_name})</span>
                        )}
                        {crew.lead_name && crew.lead_user_id && (
                          <div className="text-xs text-green-600">{crew.lead_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {crew.lead_phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {formatPhone(crew.lead_phone)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          crew.is_subcontractor
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {crew.is_subcontractor ? 'Contractor' : 'Internal'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{getStatusBadge(crew.appStatus)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {crew.appStatus === 'not_invited' && (
                          <button
                            onClick={() => openInviteForCrew(crew)}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded flex items-center gap-1"
                            title="Send SMS invite"
                          >
                            <UserPlus className="w-3 h-3" /> Invite
                          </button>
                        )}
                        {crew.appStatus === 'expired' && (
                          <button
                            onClick={() => openInviteForCrew(crew)}
                            className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded flex items-center gap-1"
                            title="Re-invite"
                          >
                            <UserPlus className="w-3 h-3" /> Re-invite
                          </button>
                        )}
                        {crew.appStatus === 'invited' && crew.invitation && (
                          <>
                            <button
                              onClick={() => handleSendReminder(crew)}
                              disabled={remindingId === crew.invitation.id}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded disabled:opacity-50"
                              title="Send reminder"
                            >
                              {remindingId === crew.invitation.id ? (
                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteInvitation(crew)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete invitation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {crew.appStatus === 'connected' && (
                          <span className="text-xs text-gray-400">Active</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {inviteCrewId ? 'Invite Crew to App' : 'Add & Invite Crew'}
              </h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Crew Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Juan's Crew"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!inviteCrewId}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 rounded-l-lg text-sm">
                    +1
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="(512) 555-1234"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  They'll get an SMS with a link to log in via phone code
                </p>
              </div>

              {!inviteCrewId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setInviteIsContractor(false); setInviteLanguage('en'); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        !inviteIsContractor
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInviteIsContractor(true); setInviteLanguage('es'); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        inviteIsContractor
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Contractor
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMS Language</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteLanguage('es')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      inviteLanguage === 'es'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Espanol
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteLanguage('en')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      inviteLanguage === 'en'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleInviteCrew}
                  disabled={inviting || !inviteName.trim() || !invitePhone.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    'Sending...'
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      Send SMS Invite
                    </>
                  )}
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
    </div>
  );
};

export default CrewsTab;
