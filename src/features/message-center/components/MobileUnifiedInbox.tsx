/**
 * MobileUnifiedInbox - Full-screen unified inbox for mobile
 * Shows SMS, Team Announcements, and System Notifications in a single feed
 */

import { useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUnifiedMessages } from '../hooks/useUnifiedMessages';
import { useMarkUnifiedItemRead } from '../hooks/useMarkUnifiedItemRead';
import { useReplyToUnifiedMessage, useAcknowledgeUnifiedItem } from '../hooks/useReplyToUnifiedMessage';
import { FilterPills } from './FilterPills';
import { UnifiedInboxItem } from './UnifiedInboxItem';
import { InboxSkeleton } from './InboxSkeleton';
import { InboxEmptyState } from './InboxEmptyState';
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
  onOpenConversation,
}: MobileUnifiedInboxProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<UnifiedInboxFilter>('all');

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

  // Handle replying to an SMS
  const handleReply = useCallback(async (message: UnifiedMessage, body: string) => {
    if (!user?.id) return;
    await replyMutation.mutateAsync({ message, replyBody: body, fromUserId: user.id });
  }, [replyMutation, user?.id]);

  // Handle acknowledging an announcement or notification
  const handleAcknowledge = useCallback(async (message: UnifiedMessage) => {
    if (!user?.id) return;
    await acknowledgeMutation.mutateAsync({ message, userId: user.id });
  }, [acknowledgeMutation, user?.id]);

  // Handle tapping on an inbox item
  const handleItemClick = useCallback(async (message: UnifiedMessage) => {
    // Mark as read first
    await markAsRead(message);

    // Navigate based on message type
    switch (message.type) {
      case 'sms': {
        const conversation = message.rawData as Conversation;
        onOpenConversation(conversation);
        break;
      }

      case 'team_chat': {
        // Navigate to Chat section with the conversation ID
        onNavigate('direct-messages', { conversationId: message.actionId });
        break;
      }

      case 'team_announcement': {
        // Navigate to Announcements section
        onNavigate('team-communication');
        break;
      }

      case 'ticket_chat': {
        // Navigate to the ticket/request detail page
        onNavigate('requests', { id: message.actionId });
        break;
      }

      case 'system_notification': {
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
          case 'conversation': {
            // For message_received notifications, open the conversation
            const conv = message.rawData as Conversation;
            if (conv) {
              onOpenConversation(conv);
            }
            break;
          }
          default:
            // Generic notification - no navigation
            console.log('Notification tapped:', message.actionType, message.actionId);
        }
        break;
      }
    }
  }, [markAsRead, onNavigate, onOpenConversation]);

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
    </div>
  );
}

export default MobileUnifiedInbox;
