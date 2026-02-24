/**
 * ComposeSheet - Bottom sheet for starting new conversations from Unified Inbox
 * Supports starting 1:1 and group team chats
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Users, User, Search, ArrowLeft } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface ComposeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
  currentUserId?: string;
}

type ComposeStep = 'choose' | 'direct' | 'group';

export function ComposeSheet({
  isOpen,
  onClose,
  onConversationCreated,
  currentUserId,
}: ComposeSheetProps) {
  const [step, setStep] = useState<ComposeStep>('choose');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load team members
  const loadTeamMembers = useCallback(async () => {
    if (!currentUserId) return;

    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .neq('id', currentUserId)
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUserId]);

  // Load members when stepping into direct or group
  useEffect(() => {
    if (isOpen && (step === 'direct' || step === 'group') && teamMembers.length === 0) {
      loadTeamMembers();
    }
  }, [isOpen, step, teamMembers.length, loadTeamMembers]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setStep('choose');
      setSearchQuery('');
      setSelectedParticipants([]);
      setGroupName('');
    }
  }, [isOpen]);

  // Filter members by search
  const filteredMembers = teamMembers.filter(
    (m) =>
      m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchQuery.toLowerCase())
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

          {/* Step 2: Direct - Select member */}
          {step === 'direct' && (
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Members list */}
              {loadingMembers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No team members found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => startDirectConversation(member.id)}
                      disabled={isCreating}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <div className="font-semibold text-gray-900">{member.full_name}</div>
                      <div className="text-sm text-gray-600">{member.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Group - Name + select participants */}
          {step === 'group' && (
            <div className="p-4 space-y-4">
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

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Selected count */}
              {selectedParticipants.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedParticipants.length} member{selectedParticipants.length !== 1 ? 's' : ''} selected
                </div>
              )}

              {/* Members list with checkboxes */}
              {loadingMembers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No team members found</p>
              ) : (
                <div className="space-y-2 pb-20">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(member.id)}
                        onChange={() => toggleParticipant(member.id)}
                        disabled={isCreating}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{member.full_name}</div>
                        <div className="text-sm text-gray-600 truncate">{member.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

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
