/**
 * MobileUnifiedInbox - Full-screen unified inbox for mobile
 * Shows SMS, Team Chats, Announcements, Tickets, and System Notifications in a single feed
 * Conversations open inline for reading and replying
 */

import { useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUnifiedMessages } from '../hooks/useUnifiedMessages';
import { useMarkUnifiedItemRead } from '../hooks/useMarkUnifiedItemRead';
import { useReplyToUnifiedMessage, useAcknowledgeUnifiedItem } from '../hooks/useReplyToUnifiedMessage';
import { FilterPills } from './FilterPills';
import { UnifiedInboxItem } from './UnifiedInboxItem';
import { InboxSkeleton } from './InboxSkeleton';
import { InboxEmptyState } from './InboxEmptyState';
import { ComposeSheet } from './ComposeSheet';
import { InboxConversationView } from './InboxConversationView';
import type { Section } from '../../../lib/routes';
import type { UnifiedMessage, UnifiedInboxFilter, Conversation } from '../types';

interface MobileUnifiedInboxProps {
  onBack: () => void;
  onNavigate: (section: Section, params?: Record<string, string>) => void;
  onOpenConversation: (conversation: Conversation) => void;
}

export function MobileUnifiedInbox({
  onBack,
  onNavigate,
}: MobileUnifiedInboxProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<UnifiedInboxFilter>('all');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);

  const {
    messages,
    counts,
    isLoading,
    isRefetching,
    refetch,
  } = useUnifiedMessages({
    userId: user?.id,
    filter,
  });

  const markAsReadMutation = useMarkUnifiedItemRead();
  const replyMutation = useReplyToUnifiedMessage();
  const acknowledgeMutation = useAcknowledgeUnifiedItem();

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Mark item as read
  const markAsRead = useCallback(async (message: UnifiedMessage) => {
    if (!user?.id || !message.isUnread) return;
    try {
      await markAsReadMutation.mutateAsync({ message, userId: user.id });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [markAsReadMutation, user?.id]);

  // Handle replying to an SMS (for desktop inline replies)
  const handleReply = useCallback(async (message: UnifiedMessage, body: string) => {
    if (!user?.id) return;
    await replyMutation.mutateAsync({ message, replyBody: body, fromUserId: user.id });
  }, [replyMutation, user?.id]);

  // Handle acknowledging an announcement or notification
  const handleAcknowledge = useCallback(async (message: UnifiedMessage) => {
    if (!user?.id) return;
    await acknowledgeMutation.mutateAsync({ message, userId: user.id });
  }, [acknowledgeMutation, user?.id]);

  // Handle conversation created from compose sheet
  const handleConversationCreated = useCallback((conversationId: string) => {
    // After creating, refresh the inbox and let user tap the new conversation
    refetch();
    setShowCompose(false);
    // Optionally navigate to it directly
    onNavigate('inbox', { conversationId });
  }, [onNavigate, refetch]);

  // Handle tapping on an inbox item
  const handleItemClick = useCallback(async (message: UnifiedMessage) => {
    // Mark as read first
    await markAsRead(message);

    // For conversations (SMS, team_chat, ticket_chat, announcement), open inline
    // For system_notification, navigate to the related entity
    if (message.type === 'system_notification') {
      // Navigate to the related entity based on actionType
      switch (message.actionType) {
        case 'quote':
          onNavigate('quotes', { id: message.actionId });
          break;
        case 'invoice':
          onNavigate('invoices', { id: message.actionId });
          break;
        case 'job':
          onNavigate('jobs', { id: message.actionId });
          break;
        case 'request':
          onNavigate('requests', { id: message.actionId });
          break;
        case 'ticket':
          onNavigate('requests', { id: message.actionId });
          break;
        default:
          // Generic notification - just mark as read
          console.log('Notification tapped:', message.actionType, message.actionId);
      }
    } else {
      // Open conversation inline
      setSelectedMessage(message);
    }
  }, [markAsRead, onNavigate]);

  // Handle going back from conversation view
  const handleBackFromConversation = useCallback(() => {
    setSelectedMessage(null);
    refetch(); // Refresh to update read status
  }, [refetch]);

  // If a message is selected, show the conversation view
  if (selectedMessage) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <InboxConversationView
          message={selectedMessage}
          onBack={handleBackFromConversation}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
              {counts.all > 0 && (
                <p className="text-xs text-gray-500">{counts.all} unread</p>
              )}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Pills */}
        <FilterPills
          activeFilter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {isLoading ? (
          <InboxSkeleton />
        ) : messages.length === 0 ? (
          <InboxEmptyState filter={filter} />
        ) : (
          <div className="bg-white">
            {messages.map((message) => (
              <UnifiedInboxItem
                key={message.id}
                message={message}
                onClick={handleItemClick}
                onReply={handleReply}
                onAcknowledge={handleAcknowledge}
                isReplying={replyMutation.isPending}
                hideInlineActions={true}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button - Compose */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-20"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="New message"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Compose Sheet */}
      <ComposeSheet
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        onConversationCreated={handleConversationCreated}
        currentUserId={user?.id}
      />
    </div>
  );
}

export default MobileUnifiedInbox;
