import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ConversationWithDetails } from '../types/chat';
import ChatView from './chat/ChatView';

export default function DirectMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Load user's conversations
  useEffect(() => {
    if (!user) return;

    loadConversations();

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
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      // Call the helper function to get conversations with details
      const { data, error } = await supabase
        .rpc('get_user_conversations');

      if (error) throw error;

      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Direct Messages</h1>
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
              <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm">Start a conversation with a team member</p>
            </div>
          ) : (
            <div className="space-y-1 p-4">
              {conversations.map((conv) => (
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
                        {/* Online status indicator */}
                        <div
                          className={`w-2 h-2 rounded-full ${
                            conv.other_user_status === 'online'
                              ? 'bg-green-500'
                              : conv.other_user_status === 'away'
                              ? 'bg-yellow-500'
                              : 'bg-gray-300'
                          }`}
                        />
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conv.other_user_name}
                        </h3>
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat View - Desktop: Always visible if selected, Mobile: Full screen */}
      <div
        className={`${
          selectedConversation ? 'flex' : 'hidden md:flex'
        } md:w-2/3 h-full flex-col`}
      >
        {selectedConv ? (
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
