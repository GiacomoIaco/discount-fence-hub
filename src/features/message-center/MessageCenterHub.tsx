import { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft, Phone, Mail, MoreVertical, Plus } from 'lucide-react';
import { MessageCenterSidebar } from './components/MessageCenterSidebar';
import { ConversationList } from './components/ConversationList';
import { MessageThread } from './components/MessageThread';
import { MessageComposer } from './components/MessageComposer';
import { useConversations, useConversationCounts, useMarkConversationRead } from './hooks/useConversations';
import { useMessages, useSendMessage } from './hooks/useMessages';
import type { ConversationWithContact, ConversationFilter } from './types';

export function MessageCenterHub() {
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithContact | null>(null);
  const [isMobileThreadView, setIsMobileThreadView] = useState(false);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(activeFilter);
  const { data: counts = { all: 0, team: 0, clients: 0, requests: 0, archived: 0 } } = useConversationCounts();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversation?.id || null);
  const markRead = useMarkConversationRead();
  const sendMessage = useSendMessage();

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const handleSelectConversation = (conv: ConversationWithContact) => {
    setSelectedConversation(conv);
    setIsMobileThreadView(true);
  };

  const handleSendMessage = (body: string) => {
    if (!selectedConversation) return;

    sendMessage.mutate({
      conversation_id: selectedConversation.id,
      channel: 'sms',
      direction: 'outbound',
      body,
      to_phone: selectedConversation.contact?.phone_primary
    });
  };

  const handleBack = () => {
    setIsMobileThreadView(false);
    setSelectedConversation(null);
  };

  const handleFilterChange = (filter: ConversationFilter) => {
    setActiveFilter(filter);
    setSelectedConversation(null);
    setIsMobileThreadView(false);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Filter Sidebar */}
      <MessageCenterSidebar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        counts={counts}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List (hidden on mobile when thread is open) */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r bg-white flex-shrink-0 flex flex-col ${
            isMobileThreadView ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* List Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {activeFilter === 'all' && 'All Conversations'}
              {activeFilter === 'team' && 'Team Messages'}
              {activeFilter === 'clients' && 'Client Messages'}
              {activeFilter === 'requests' && 'Project Requests'}
              {activeFilter === 'archived' && 'Archived'}
            </h2>
            <button
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="New Conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Conversation List */}
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id || null}
            onSelect={handleSelectConversation}
            isLoading={conversationsLoading}
          />
        </div>

        {/* Message Thread */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !isMobileThreadView ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="border-b px-4 py-3 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  {/* Back button (mobile only) */}
                  <button
                    onClick={handleBack}
                    className="md:hidden p-1 hover:bg-gray-100 rounded"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Contact Avatar */}
                  {selectedConversation.contact?.avatar_url ? (
                    <img
                      src={selectedConversation.contact.avatar_url}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium">
                        {(selectedConversation.contact?.display_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.contact?.display_name || 'Unknown'}
                    </h2>
                    {selectedConversation.contact?.company_name && (
                      <p className="text-sm text-gray-500">
                        {selectedConversation.contact.company_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {selectedConversation.contact?.phone_primary && (
                    <a
                      href={`tel:${selectedConversation.contact.phone_primary}`}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Call"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                  {selectedConversation.contact?.email_primary && (
                    <a
                      href={`mailto:${selectedConversation.contact.email_primary}`}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="Email"
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                  <button
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    title="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <MessageThread messages={messages} isLoading={messagesLoading} />

              {/* Composer */}
              <MessageComposer
                onSend={handleSendMessage}
                disabled={sendMessage.isPending}
                placeholder={`Message ${selectedConversation.contact?.display_name || 'contact'}...`}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageCenterHub;
