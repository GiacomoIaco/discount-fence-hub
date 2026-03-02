/**
 * ComposeSheet - Bottom sheet for starting new conversations from Unified Inbox
 * Supports starting 1:1 and group team chats
 * Member picker has two tabs: Team (office staff) and Crews (field crews)
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Users, User, Search, ArrowLeft, HardHat } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { ROLE_DISPLAY_NAMES } from '../../../lib/permissions/defaults';
import type { AppRole } from '../../../lib/permissions/types';

interface TeamMember {
  id: string;
  full_name: string;
  role: string; // legacy role from user_profiles
  role_key?: AppRole; // from user_roles
}

interface CrewPerson {
  id: string; // crews.id
  lead_user_id: string; // auth user id — used as participant
  lead_name: string;
  name: string; // crew name
  is_subcontractor: boolean;
  crew_size: number;
}

type PersonEntry = {
  userId: string;
  displayName: string;
  subtitle: string;
  source: 'team' | 'crew';
};

interface ComposeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
  currentUserId?: string;
}

type ComposeStep = 'choose' | 'direct' | 'group';
type MemberTab = 'team' | 'crews';

export function ComposeSheet({
  isOpen,
  onClose,
  onConversationCreated,
  currentUserId,
}: ComposeSheetProps) {
  const [step, setStep] = useState<ComposeStep>('choose');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [crewPersons, setCrewPersons] = useState<CrewPerson[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<MemberTab>('team');

  // Get role display label
  const getRoleLabel = (member: TeamMember): string => {
    const key = member.role_key || member.role;
    return ROLE_DISPLAY_NAMES[key as AppRole] || key || '';
  };

  // Load team members (non-crew) and crew persons in parallel
  const loadAllMembers = useCallback(async () => {
    if (!currentUserId) return;

    setLoadingMembers(true);
    try {
      const [teamResult, rolesResult, crewResult] = await Promise.all([
        // Team: all user_profiles except current user
        supabase
          .from('user_profiles')
          .select('id, full_name, role')
          .neq('id', currentUserId)
          .order('full_name'),
        // Roles: get role_key for each user
        supabase
          .from('user_roles')
          .select('user_id, role_key'),
        // Crews: only those with a linked user (can receive messages)
        supabase
          .from('crews')
          .select('id, lead_user_id, lead_name, name, is_subcontractor, crew_size')
          .not('lead_user_id', 'is', null)
          .eq('is_active', true)
          .order('name'),
      ]);

      if (teamResult.error) throw teamResult.error;

      // Build a role_key lookup
      const roleMap = new Map<string, AppRole>();
      if (rolesResult.data) {
        for (const r of rolesResult.data) {
          roleMap.set(r.user_id, r.role_key as AppRole);
        }
      }

      // Split: team members are non-crew, crew members are crew role
      const allProfiles = (teamResult.data || []).map((p) => ({
        ...p,
        role_key: roleMap.get(p.id),
      }));

      // Crew user IDs from the crews table
      const crewUserIds = new Set(
        (crewResult.data || [])
          .filter((c) => c.lead_user_id)
          .map((c) => c.lead_user_id)
      );

      // Team = profiles that are NOT crew (by role_key or by crews table match)
      const team = allProfiles.filter(
        (p) => p.role_key !== 'crew' && !crewUserIds.has(p.id)
      );

      setTeamMembers(team);
      setCrewPersons(
        (crewResult.data || []).filter(
          (c) => c.lead_user_id && c.lead_user_id !== currentUserId
        ) as CrewPerson[]
      );
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUserId]);

  // Load members when stepping into direct or group
  useEffect(() => {
    if (isOpen && (step === 'direct' || step === 'group') && teamMembers.length === 0 && crewPersons.length === 0) {
      loadAllMembers();
    }
  }, [isOpen, step, teamMembers.length, crewPersons.length, loadAllMembers]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setStep('choose');
      setSearchQuery('');
      setSelectedParticipants([]);
      setGroupName('');
      setActiveTab('team');
    }
  }, [isOpen]);

  // Build unified person entries for the active tab
  const getPersonEntries = (): PersonEntry[] => {
    if (activeTab === 'team') {
      return teamMembers.map((m) => ({
        userId: m.id,
        displayName: m.full_name || 'Unknown',
        subtitle: getRoleLabel(m),
        source: 'team' as const,
      }));
    }
    return crewPersons.map((c) => ({
      userId: c.lead_user_id,
      displayName: c.lead_name || c.name,
      subtitle: c.is_subcontractor ? 'Contractor' : 'Internal',
      source: 'crew' as const,
    }));
  };

  // Filter by search
  const filteredPersons = getPersonEntries().filter(
    (p) =>
      p.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Start direct conversation
  const startDirectConversation = async (otherUserId: string) => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
        other_user_id: otherUserId,
      });

      if (error) throw error;

      onConversationCreated(data);
      onClose();
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Create group conversation
  const createGroupConversation = async () => {
    if (isCreating || !groupName.trim() || selectedParticipants.length === 0) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        conversation_name: groupName.trim(),
        participant_ids: selectedParticipants,
      });

      if (error) throw error;

      onConversationCreated(data);
      onClose();
    } catch (error) {
      console.error('Error creating group conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle participant selection
  const toggleParticipant = (userId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Tab pills component
  const TabPills = () => (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      <button
        onClick={() => setActiveTab('team')}
        className={cn(
          'flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors',
          activeTab === 'team'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        Team ({teamMembers.length})
      </button>
      <button
        onClick={() => setActiveTab('crews')}
        className={cn(
          'flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
          activeTab === 'crews'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        <HardHat className="w-3.5 h-3.5" />
        Crews ({crewPersons.length})
      </button>
    </div>
  );

  // Shared person list for direct messages (click to start chat)
  const DirectPersonList = () => (
    <>
      {loadingMembers ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredPersons.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {activeTab === 'crews' ? 'No connected crews' : 'No team members found'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredPersons.map((person) => (
            <button
              key={person.userId}
              onClick={() => startDirectConversation(person.userId)}
              disabled={isCreating}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-3"
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                person.source === 'crew' ? 'bg-orange-100' : 'bg-blue-100'
              )}>
                {person.source === 'crew'
                  ? <HardHat className="w-5 h-5 text-orange-600" />
                  : <User className="w-5 h-5 text-blue-600" />
                }
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{person.displayName}</div>
                <div className="text-xs text-gray-500">{person.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  // Shared person list for group chats (checkboxes)
  const GroupPersonList = () => (
    <>
      {loadingMembers ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filteredPersons.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {activeTab === 'crews' ? 'No connected crews' : 'No team members found'}
        </p>
      ) : (
        <div className="space-y-2 pb-20">
          {filteredPersons.map((person) => (
            <label
              key={person.userId}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedParticipants.includes(person.userId)}
                onChange={() => toggleParticipant(person.userId)}
                disabled={isCreating}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                person.source === 'crew' ? 'bg-orange-100' : 'bg-blue-100'
              )}>
                {person.source === 'crew'
                  ? <HardHat className="w-5 h-5 text-orange-600" />
                  : <User className="w-5 h-5 text-blue-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{person.displayName}</div>
                <div className="text-xs text-gray-500">{person.subtitle}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative w-full bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden',
          'sm:max-w-md sm:mx-4',
          'animate-in slide-in-from-bottom duration-300'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {step !== 'choose' && (
              <button
                onClick={() => setStep('choose')}
                className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'choose' && 'New Message'}
              {step === 'direct' && 'Start Chat'}
              {step === 'group' && 'New Group'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-64px)]">
          {/* Step 1: Choose type */}
          {step === 'choose' && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setStep('direct')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Direct Message</div>
                  <div className="text-sm text-gray-500">Start a 1:1 chat with a team member</div>
                </div>
              </button>

              <button
                onClick={() => setStep('group')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Group Chat</div>
                  <div className="text-sm text-gray-500">Create a group with multiple people</div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: Direct - Select person */}
          {step === 'direct' && (
            <div className="p-4 space-y-3">
              {/* Tabs */}
              <TabPills />

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'crews' ? 'Search crews...' : 'Search team members...'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Person list */}
              <DirectPersonList />
            </div>
          )}

          {/* Step 2: Group - Name + select participants */}
          {step === 'group' && (
            <div className="p-4 space-y-3">
              {/* Group name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Project Team"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tabs */}
              <TabPills />

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'crews' ? 'Search crews...' : 'Search team members...'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Selected count */}
              {selectedParticipants.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedParticipants.length} member{selectedParticipants.length !== 1 ? 's' : ''} selected
                </div>
              )}

              {/* Person list with checkboxes */}
              <GroupPersonList />

              {/* Create button - fixed at bottom */}
              <div className="fixed left-0 right-0 p-4 bg-white border-t border-gray-200 above-mobile-nav sm:relative sm:!bottom-auto sm:border-0 sm:p-0 sm:pt-4">
                <button
                  onClick={createGroupConversation}
                  disabled={isCreating || !groupName.trim() || selectedParticipants.length === 0}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isCreating ? 'Creating...' : 'Create Group Chat'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ComposeSheet;
