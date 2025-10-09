import { useState, useEffect } from 'react';
import { MessageSquare, Search, X } from 'lucide-react';
import {
  getConversations,
  getUnreadMessagesCount,
  type ConversationWithDetails
} from '../../lib/messages';
import { ConversationView } from './ConversationView';
import { formatDistanceToNow } from 'date-fns';

export function MessagesView() {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadConversations();
    loadUnreadCount();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadMessagesCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConvData = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="h-full flex flex-col lg:flex-row bg-gray-50">
      {/* Conversation List - Mobile/Desktop */}
      <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 bg-white border-r border-gray-200`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No conversations found' : 'No messages yet'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {searchQuery ? 'Try a different search' : 'Start a conversation from a request'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedConversation === conv.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  } ${conv.unreadCount > 0 ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-medium text-sm">
                          {conv.otherUser?.name.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {conv.otherUser?.name || 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {conv.otherUser?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(conv.lastMessage.created_at), { addSuffix: true })}
                        </span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.lastMessage && (
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                      {conv.lastMessage.content}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className={`${selectedConversation ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedConversation && selectedConvData ? (
          <ConversationView
            conversation={selectedConvData}
            onBack={() => setSelectedConversation(null)}
            onMessageSent={loadConversations}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Select a conversation</h3>
            <p className="text-gray-500 text-sm">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
