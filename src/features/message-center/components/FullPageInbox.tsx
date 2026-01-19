/**
 * FullPageInbox - Desktop full-page version of the Unified Inbox
 * Shows all message types with conversation view and compose functionality
 */

import { useState, useCallback } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
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
import type { UnifiedMessage, UnifiedInboxFilter } from '../types';

export function FullPageInbox() {
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

  // Handle refresh
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

  // Handle replying
  const handleReply = useCallback(async (message: UnifiedMessage, body: string) => {
    if (!user?.id) return;
    await replyMutation.mutateAsync({ message, replyBody: body, fromUserId: user.id });
  }, [replyMutation, user?.id]);

  // Handle acknowledging
  const handleAcknowledge = useCallback(async (message: UnifiedMessage) => {
    if (!user?.id) return;
    await acknowledgeMutation.mutateAsync({ message, userId: user.id });
  }, [acknowledgeMutation, user?.id]);

  // Handle compose created
  const handleConversationCreated = useCallback(() => {
    refetch();
    setShowCompose(false);
  }, [refetch]);

  // Handle tapping on an inbox item
  const handleItemClick = useCallback(async (message: UnifiedMessage) => {
    await markAsRead(message);

    // For system_notification, we could show details inline or just mark as read
    // For conversations, open inline
    if (message.type !== 'system_notification') {
      setSelectedMessage(message);
    }
  }, [markAsRead]);

  // Handle going back from conversation view
  const handleBackFromConversation = useCallback(() => {
    setSelectedMessage(null);
    refetch();
  }, [refetch]);

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Panel - Message List */}
      <div className={`${selectedMessage ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-96 xl:w-[420px] bg-white border-r border-gray-200`}>
        {/* Header */}
        <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
              {counts.all > 0 && (
                <p className="text-sm text-gray-500">{counts.all} unread</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefetching}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCompose(true)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                aria-label="New message"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <FilterPills
            activeFilter={filter}
            onFilterChange={setFilter}
            counts={counts}
          />
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <InboxSkeleton />
          ) : messages.length === 0 ? (
            <InboxEmptyState filter={filter} />
          ) : (
            <div>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={selectedMessage?.id === message.id ? 'bg-blue-50' : ''}
                >
                  <UnifiedInboxItem
                    message={message}
                    onClick={handleItemClick}
                    onReply={handleReply}
                    onAcknowledge={handleAcknowledge}
                    isReplying={replyMutation.isPending}
                    hideInlineActions={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Conversation View */}
      <div className={`${selectedMessage ? 'flex' : 'hidden lg:flex'} flex-1 flex-col`}>
        {selectedMessage ? (
          <InboxConversationView
            message={selectedMessage}
            onBack={handleBackFromConversation}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a message from the list to view the conversation</p>
            </div>
          </div>
        )}
      </div>

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

export default FullPageInbox;
