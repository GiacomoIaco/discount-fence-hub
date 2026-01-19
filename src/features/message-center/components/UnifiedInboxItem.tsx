/**
 * Single list item for the unified inbox
 * Shows: type icon | title & preview | timestamp | unread indicator
 * Supports inline reply for SMS conversations
 */

import { useState, useCallback } from 'react';
import { MessageSquare, Megaphone, Bell, Reply, Check, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { InlineReplyComposer } from './InlineReplyComposer';
import type { UnifiedMessage, Conversation } from '../types';

interface UnifiedInboxItemProps {
  message: UnifiedMessage;
  onClick: (message: UnifiedMessage) => void;
  onReply?: (message: UnifiedMessage, body: string) => Promise<void>;
  onAcknowledge?: (message: UnifiedMessage) => Promise<void>;
  isReplying?: boolean;
}

// Icon component mapping
const iconMap = {
  MessageSquare,
  Megaphone,
  Bell,
} as const;

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  // Format as date for older messages
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function UnifiedInboxItem({
  message,
  onClick,
  onReply,
  onAcknowledge,
  isReplying: externalIsReplying,
}: UnifiedInboxItemProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const IconComponent = iconMap[message.icon as keyof typeof iconMap] || Bell;

  // Determine if this message type supports inline reply
  const canReply = message.type === 'sms' && onReply;
  const canAcknowledge =
    (message.type === 'team_announcement' || message.type === 'system_notification') &&
    message.isUnread &&
    onAcknowledge;

  const handleReplyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReplyComposer(true);
  }, []);

  const handleAcknowledgeClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAcknowledge) return;

    setIsSending(true);
    try {
      await onAcknowledge(message);
    } finally {
      setIsSending(false);
    }
  }, [message, onAcknowledge]);

  const handleSendReply = useCallback(async (body: string) => {
    if (!onReply) return;

    setIsSending(true);
    try {
      await onReply(message, body);
      setShowReplyComposer(false);
    } finally {
      setIsSending(false);
    }
  }, [message, onReply]);

  const handleCancelReply = useCallback(() => {
    setShowReplyComposer(false);
  }, []);

  // Get contact info for SMS placeholder
  const getReplyPlaceholder = () => {
    if (message.type === 'sms') {
      const conversation = message.rawData as Conversation;
      const contactName = conversation?.contact?.display_name || message.title;
      return `Reply to ${contactName}...`;
    }
    return 'Type a reply...';
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Main Item Row */}
      <div
        onClick={() => onClick(message)}
        className={cn(
          'w-full flex items-start gap-3 p-4 text-left transition-colors cursor-pointer',
          'hover:bg-gray-50 active:bg-gray-100',
          'min-h-[72px]'
        )}
      >
        {/* Type Icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            message.iconBgColor
          )}
        >
          <IconComponent className={cn('w-5 h-5', message.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                'text-sm truncate',
                message.isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
              )}
            >
              {message.title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-500">
                {formatTimestamp(message.timestamp)}
              </span>
              {message.isUnread && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </div>
          </div>
          <p
            className={cn(
              'text-sm mt-0.5 line-clamp-2',
              message.isUnread ? 'text-gray-700' : 'text-gray-500'
            )}
          >
            {message.preview}
          </p>

          {/* Action Buttons Row */}
          {(canReply || canAcknowledge) && !showReplyComposer && (
            <div className="flex items-center gap-2 mt-2">
              {canReply && (
                <button
                  onClick={handleReplyClick}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}

              {canAcknowledge && (
                <button
                  onClick={handleAcknowledgeClick}
                  disabled={isSending}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSending ? 'Marking...' : 'Mark Read'}
                </button>
              )}

              {/* View in full context link */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(message);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline Reply Composer */}
      {showReplyComposer && canReply && (
        <div className="px-4 pb-4">
          <InlineReplyComposer
            placeholder={getReplyPlaceholder()}
            onSend={handleSendReply}
            onCancel={handleCancelReply}
            isSending={isSending || externalIsReplying}
            maxLength={320}
          />
        </div>
      )}
    </div>
  );
}

export default UnifiedInboxItem;
