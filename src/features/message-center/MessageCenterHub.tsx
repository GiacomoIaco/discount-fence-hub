import { useState, useEffect, useMemo, useRef } from 'react';
import { MessageSquare, ArrowLeft, Phone, Mail, MoreVertical, Plus, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { MessageCenterSidebar } from './components/MessageCenterSidebar';
import { ConversationList } from './components/ConversationList';
import { MessageThread } from './components/MessageThread';
import { MessageComposer } from './components/MessageComposer';
import { NewConversationModal } from './components/NewConversationModal';
import { useConversations, useConversationCounts, useMarkConversationRead, useArchiveConversation } from './hooks/useConversations';
import { useMessages, useSendMessage } from './hooks/useMessages';
import { buildShortcodeContext } from './services/quickReplyService';
import * as messageService from './services/messageService';
import type { ConversationWithContact, ConversationFilter, Contact } from './types';

export function MessageCenterHub() {
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithContact | null>(null);
  const [isMobileThreadView, setIsMobileThreadView] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(activeFilter);
  const { data: counts = { all: 0, team: 0, clients: 0, requests: 0, archived: 0 } } = useConversationCounts();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversation?.id || null);
  const markRead = useMarkConversationRead();
  const sendMessage = useSendMessage();
  const archiveConversation = useArchiveConversation();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Build shortcode context for quick replies
  const shortcodeContext = useMemo(() => {
    if (!selectedConversation?.contact) return {};

    return buildShortcodeContext(
      selectedConversation.contact,
      selectedConversation,
      undefined, // TODO: Get current user
      {
        // Defaults for field workers
        eta_minutes: '15',
        delay_minutes: '10',
      }
    );
  }, [selectedConversation]);

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

  const handleNewConversation = async (contact: Contact) => {
    try {
      // Check if conversation already exists with this contact
      const existingConv = conversations.find(c => c.contact_id === contact.id);

      if (existingConv) {
        setSelectedConversation(existingConv);
        setIsMobileThreadView(true);
        return;
      }

      // Determine conversation type based on contact type
      // Team members (employees) get 'team_direct', clients get 'client'
      const conversationType = contact.contact_type === 'employee' ? 'team_direct' : 'client';

      // Create new conversation with correct type
      const newConvo = await messageService.createConversation(contact.id, conversationType);

      // Set as selected (with contact info)
      setSelectedConversation({
        ...newConvo,
        contact
      });
      setIsMobileThreadView(true);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleArchiveConversation = async () => {
    if (!selectedConversation) return;

    await archiveConversation.mutateAsync(selectedConversation.id);
    setShowMoreMenu(false);
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
              onClick={() => setShowNewConversation(true)}
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
                    {(selectedConversation.contact?.company_name || selectedConversation.contact?.context_label) && (
                      <p className="text-sm text-gray-500">
                        {selectedConversation.contact.company_name}
                        {selectedConversation.contact.company_name && selectedConversation.contact.context_label && ' · '}
                        {selectedConversation.contact.context_label}
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
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setShowMoreMenu(!showMoreMenu)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="More options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Dropdown Menu */}
                    {showMoreMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                        {selectedConversation?.status === 'archived' ? (
                          <button
                            onClick={async () => {
                              await messageService.unarchiveConversation(selectedConversation.id);
                              setShowMoreMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                            Unarchive
                          </button>
                        ) : (
                          <button
                            onClick={handleArchiveConversation}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Archive className="w-4 h-4" />
                            Archive Conversation
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <MessageThread messages={messages} isLoading={messagesLoading} />

              {/* Composer */}
              <MessageComposer
                onSend={handleSendMessage}
                disabled={sendMessage.isPending}
                placeholder={`Message ${selectedConversation.contact?.display_name || 'contact'}...`}
                isOptedOut={selectedConversation.contact?.sms_opted_out || false}
                shortcodeContext={shortcodeContext}
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

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onSelectContact={handleNewConversation}
      />
    </div>
  );
}

export default MessageCenterHub;
