import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, Building2, AlertCircle, Target, Search } from 'lucide-react';
import { useState } from 'react';
import type { ConversationWithContact } from '../types';

interface ConversationListProps {
  conversations: ConversationWithContact[];
  selectedId: string | null;
  onSelect: (conversation: ConversationWithContact) => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const contactName = conv.contact?.display_name?.toLowerCase() || '';
    const companyName = conv.contact?.company_name?.toLowerCase() || '';
    const preview = conv.last_message_preview?.toLowerCase() || '';
    return contactName.includes(query) || companyName.includes(query) || preview.includes(query);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Group conversations
  const projectSignals = filteredConversations.filter(c => c.has_project_signal);
  const needsAttention = filteredConversations.filter(c => c.sentiment === 'negative' || c.sentiment === 'urgent');
  const regular = filteredConversations.filter(c => !c.has_project_signal && c.sentiment !== 'negative' && c.sentiment !== 'urgent');

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <MessageSquare className="w-12 h-12 mb-2 text-gray-300" />
            <p className="text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Project Signals Section */}
            {projectSignals.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-2 text-xs font-semibold text-orange-600 bg-orange-50 flex items-center gap-1 sticky top-0">
                  <Target className="w-3 h-3" />
                  PROJECT DETECTED ({projectSignals.length})
                </div>
                {projectSignals.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => onSelect(conv)}
                  />
                ))}
              </div>
            )}

            {/* Needs Attention Section */}
            {needsAttention.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 flex items-center gap-1 sticky top-0">
                  <AlertCircle className="w-3 h-3" />
                  NEEDS ATTENTION ({needsAttention.length})
                </div>
                {needsAttention.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => onSelect(conv)}
                  />
                ))}
              </div>
            )}

            {/* Regular Conversations */}
            {regular.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  ALL MESSAGES ({regular.length})
                </div>
                {regular.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedId === conv.id}
                    onClick={() => onSelect(conv)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ConversationCardProps {
  conversation: ConversationWithContact;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationCard({ conversation, isSelected, onClick }: ConversationCardProps) {
  const contact = conversation.contact;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Contact Name */}
          <div className="flex items-center gap-2">
            {contact?.avatar_url ? (
              <img src={contact.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {contact?.display_name || 'Unknown'}
              </p>
              {contact?.company_name && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {contact.company_name}
                </p>
              )}
            </div>
          </div>

          {/* Last Message Preview */}
          <p className="mt-1 text-sm text-gray-600 truncate ml-12">
            {conversation.last_message_direction === 'outbound' && (
              <span className="text-gray-400">You: </span>
            )}
            {conversation.last_message_preview || 'No messages yet'}
          </p>

          {/* Badges */}
          <div className="mt-1 flex items-center gap-2 ml-12">
            {conversation.has_project_signal && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                {Math.round((conversation.project_confidence || 0) * 100)}% match
              </span>
            )}
            {conversation.sentiment === 'negative' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Negative
              </span>
            )}
            {conversation.sentiment === 'urgent' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Urgent
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Time & Unread */}
        <div className="flex flex-col items-end ml-2">
          {conversation.last_message_at && (
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })}
            </span>
          )}
          {conversation.unread_count > 0 && (
            <span className="mt-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-blue-600 rounded-full">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default ConversationList;
