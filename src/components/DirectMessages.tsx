import { useState, useEffect } from 'react';
import { MessageSquare, Plus, X, Users, User, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { showError, showSuccess } from '../lib/toast';
import type { ConversationWithDetails } from '../types/chat';
import ChatView from './chat/ChatView';
import AnnouncementsView from './AnnouncementsView';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface DirectMessagesProps {
  onUnreadCountChange?: (count: number) => void;
}

export default function DirectMessages({ onUnreadCountChange }: DirectMessagesProps = {}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [conversationType, setConversationType] = useState<'direct' | 'group' | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [announcementsUnreadCount, setAnnouncementsUnreadCount] = useState(0);

  // Special ID for announcements "conversation"
  const ANNOUNCEMENTS_ID = '__announcements__';

  // Propagate unread announcements count to parent
  useEffect(() => {
    onUnreadCountChange?.(announcementsUnreadCount);
  }, [announcementsUnreadCount, onUnreadCountChange]);

  // Load user's conversations
  useEffect(() => {
    if (!user) return;

    loadConversations();
    loadAnnouncementsUnreadCount();

    // Subscribe to realtime updates for new messages
    const subscription = supabase
      .channel('user-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages'
        },
        () => {
          // Reload conversations when new message arrives
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_messages'
        },
        () => {
          // Reload announcements count when new announcement arrives
          loadAnnouncementsUnreadCount();
        }
      )
      .subscribe();

    // Also poll every 30 seconds as backup (in case realtime fails)
    const pollingInterval = setInterval(() => {
      loadAnnouncementsUnreadCount();
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollingInterval);
    };
  }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      // Call the helper function to get conversations with details
      const { data, error} = await supabase
        .rpc('get_user_conversations');

      if (error) throw error;

      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnnouncementsUnreadCount = async () => {
    try {
      const { data, error } = await supabase
        .from('user_unread_messages')
        .select('unread_count')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!error && data) {
        setAnnouncementsUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error loading announcements unread count:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      setLoadingMembers(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .neq('id', user?.id) // Exclude current user
        .order('full_name');

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
      showError('Failed to load team members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const startConversation = async (otherUserId: string) => {
    try {
      setCreatingConversation(true);

      // Call the database function to get or create conversation
      const { data, error } = await supabase
        .rpc('get_or_create_direct_conversation', { other_user_id: otherUserId });

      if (error) throw error;

      // Reload conversations to get the new one
      await loadConversations();

      // Select the new conversation
      setSelectedConversation(data);
      setShowNewConversation(false);
      setConversationType(null);
      showSuccess('Conversation started!');
    } catch (error) {
      console.error('Error starting conversation:', error);
      showError('Failed to start conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  const createGroupConversation = async () => {
    try {
      // Validate
      if (!groupName.trim()) {
        showError('Please enter a group name');
        return;
      }

      if (selectedParticipants.length === 0) {
        showError('Please select at least one participant');
        return;
      }

      setCreatingConversation(true);

      // Call the database function to create group conversation
      const { data, error } = await supabase
        .rpc('create_group_conversation', {
          conversation_name: groupName.trim(),
          participant_ids: selectedParticipants
        });

      if (error) throw error;

      // Reload conversations to get the new one
      await loadConversations();

      // Select the new conversation
      setSelectedConversation(data);
      setShowNewConversation(false);
      setConversationType(null);
      setGroupName('');
      setSelectedParticipants([]);
      showSuccess('Group conversation created!');
    } catch (error) {
      console.error('Error creating group conversation:', error);
      showError('Failed to create group conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  const selectedConv = conversations.find(
    (c) => c.conversation_id === selectedConversation
  );

  return (
    <div className="h-full flex flex-col md:flex-row bg-gray-50">
      {/* Conversation List - Desktop: Always visible, Mobile: Hidden when chat open */}
      <div
        className={`${
          selectedConversation ? 'hidden md:flex' : 'flex'
        } md:w-1/3 md:border-r md:border-gray-200 h-full flex-col bg-white`}
      >
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Direct Messages</h1>
            </div>
            <button
              onClick={() => {
                setShowNewConversation(true);
                loadTeamMembers();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1 p-4">
            {/* Company Announcements - Pinned at top */}
            <button
              onClick={() => setSelectedConversation(ANNOUNCEMENTS_ID)}
              className={`w-full text-left p-4 rounded-lg transition-colors border-b-2 border-gray-100 ${
                selectedConversation === ANNOUNCEMENTS_ID
                  ? 'bg-blue-50 border-2 border-blue-200'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-900">Company Announcements</h3>
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                      PINNED
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Official company updates, surveys, and announcements
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 ml-3">
                  {announcementsUnreadCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                      {announcementsUnreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Regular conversations */}
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-500 p-8 mt-4">
                <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No conversations yet</p>
                <p className="text-sm">Start a conversation with a team member</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.conversation_id}
                  onClick={() => setSelectedConversation(conv.conversation_id)}
                  className={`w-full text-left p-4 rounded-lg transition-colors ${
                    selectedConversation === conv.conversation_id
                      ? 'bg-blue-50 border-2 border-blue-200'
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* Group/Direct icon */}
                        {conv.is_group ? (
                          <Users className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div
                            className={`w-2 h-2 rounded-full ${
                              conv.other_user_status === 'online'
                                ? 'bg-green-500'
                                : conv.other_user_status === 'away'
                                ? 'bg-yellow-500'
                                : 'bg-gray-300'
                            }`}
                          />
                        )}
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conv.is_group
                            ? conv.conversation_name
                            : conv.other_user_name}
                        </h3>
                        {conv.is_group && (
                          <span className="text-xs text-gray-500">
                            ({conv.participant_count})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 ml-3">
                      {/* Unread count badge */}
                      {conv.unread_count > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                      {/* Timestamp */}
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(conv.last_message_at)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Chat View - Desktop: Always visible if selected, Mobile: Full screen */}
      <div
        className={`${
          selectedConversation ? 'flex' : 'hidden md:flex'
        } md:w-2/3 h-full flex-col`}
      >
        {selectedConversation === ANNOUNCEMENTS_ID ? (
          <AnnouncementsView
            onBack={() => setSelectedConversation(null)}
            onUnreadCountChange={setAnnouncementsUnreadCount}
          />
        ) : selectedConv ? (
          <ChatView
            conversation={selectedConv}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full bg-white text-gray-500">
            <MessageSquare className="w-24 h-24 mb-4 text-gray-200" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a conversation from the list to start chatting</p>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {!conversationType
                  ? 'New Conversation'
                  : conversationType === 'direct'
                  ? 'New Direct Message'
                  : 'New Group Chat'}
              </h2>
              <button
                onClick={() => {
                  setShowNewConversation(false);
                  setConversationType(null);
                  setSelectedParticipants([]);
                  setGroupName('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!conversationType ? (
                /* Choose conversation type */
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setConversationType('direct');
                      loadTeamMembers();
                    }}
                    className="w-full p-6 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">Direct Message</h3>
                        <p className="text-sm text-gray-600">Start a 1-on-1 conversation</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setConversationType('group');
                      loadTeamMembers();
                    }}
                    className="w-full p-6 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">Group Chat</h3>
                        <p className="text-sm text-gray-600">Create a conversation with multiple people</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : conversationType === 'group' ? (
                /* Group conversation creation */
                <div className="space-y-4">
                  {/* Group name input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g., Sales Team, Project Alpha"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={creatingConversation}
                    />
                  </div>

                  {/* Participant selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Participants * ({selectedParticipants.length} selected)
                    </label>
                    {loadingMembers ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No team members found</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <label
                            key={member.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedParticipants.includes(member.id)
                                ? 'bg-blue-50 border-blue-500'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedParticipants.includes(member.id)}
                              onChange={() => toggleParticipant(member.id)}
                              disabled={creatingConversation}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{member.full_name}</div>
                              <div className="text-sm text-gray-600 truncate">{member.email}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Create button */}
                  <button
                    onClick={createGroupConversation}
                    disabled={creatingConversation || !groupName.trim() || selectedParticipants.length === 0}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {creatingConversation ? 'Creating...' : 'Create Group Chat'}
                  </button>
                </div>
              ) : (
                /* Direct conversation - select single user */
                <>
                  {loadingMembers ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No team members found</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => startConversation(member.id)}
                          disabled={creatingConversation}
                          className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="font-semibold text-gray-900">{member.full_name}</div>
                          <div className="text-sm text-gray-600">{member.email}</div>
                          <div className="text-xs text-gray-500 mt-1 capitalize">{member.role}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format timestamps
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
