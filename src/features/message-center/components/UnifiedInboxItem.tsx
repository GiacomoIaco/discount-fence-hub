/**
 * Single list item for the unified inbox
 * Shows: type icon | title & preview | timestamp | unread indicator
 * Supports inline reply for SMS conversations
 */

import { useState, useCallback, useRef } from 'react';
import { MessageSquare, Megaphone, Bell, Reply, Check, ExternalLink, Users, User, Ticket, Archive, ArchiveRestore, Mail, MailOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { InlineReplyComposer } from './InlineReplyComposer';
import type { UnifiedMessage, Conversation } from '../types';

interface UnifiedInboxItemProps {
  message: UnifiedMessage;
  onClick: (message: UnifiedMessage) => void;
  onReply?: (message: UnifiedMessage, body: string) => Promise<void>;
  onAcknowledge?: (message: UnifiedMessage) => Promise<void>;
  onDismiss?: (message: UnifiedMessage) => void;
  onRestore?: (message: UnifiedMessage) => void;
  onToggleRead?: (message: UnifiedMessage) => void;
  isReplying?: boolean;
  /** Hide inline actions (Reply, Mark Read, Open) - use for mobile where tap opens conversation */
  hideInlineActions?: boolean;
}

const SWIPE_THRESHOLD = 60; // px to trigger action

// Icon component mapping
const iconMap = {
  MessageSquare,
  Megaphone,
  Bell,
  Users,
  User,
  Ticket,
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
  onDismiss,
  onRestore,
  onToggleRead,
  isReplying: externalIsReplying,
  hideInlineActions = false,
}: UnifiedInboxItemProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isSwipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // If vertical scroll is dominant, don't swipe
    if (!isSwipingRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStartRef.current = null;
      return;
    }

    // Once horizontal movement exceeds 10px, lock into swipe mode
    if (Math.abs(deltaX) > 10) {
      isSwipingRef.current = true;
    }

    if (isSwipingRef.current) {
      e.preventDefault(); // Prevent scroll during swipe
      // Clamp swipe range
      const clamped = Math.max(-120, Math.min(120, deltaX));
      setSwipeX(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    if (Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      if (swipeX > 0 && onDismiss) {
        // Swipe right → Archive
        onDismiss(message);
      } else if (swipeX < 0 && onToggleRead) {
        // Swipe left → Toggle read/unread
        onToggleRead(message);
      }
    }

    // Reset
    setSwipeX(0);
    touchStartRef.current = null;
    isSwipingRef.current = false;
  }, [swipeX, message, onDismiss, onToggleRead]);

  const IconComponent = iconMap[message.icon as keyof typeof iconMap] || Bell;

  // Determine if this message type supports inline reply (only when actions are shown)
  const canReply = !hideInlineActions && message.type === 'sms' && onReply;
  const canAcknowledge =
    !hideInlineActions &&
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

  // Left border color by message type
  const borderColorMap: Record<string, string> = {
    sms: 'border-l-blue-500',
    team_chat: 'border-l-green-500',
    team_announcement: 'border-l-purple-500',
    ticket_chat: 'border-l-orange-500',
    system_notification: 'border-l-amber-500',
  };
  const borderColor = borderColorMap[message.type] || 'border-l-gray-300';

  // Type badge label
  const typeBadgeMap: Record<string, { label: string; className: string }> = {
    sms: { label: 'SMS', className: 'bg-blue-50 text-blue-600' },
    team_chat: { label: 'Chat', className: 'bg-green-50 text-green-600' },
    team_announcement: { label: 'Announce', className: 'bg-purple-50 text-purple-600' },
    ticket_chat: { label: 'Ticket', className: 'bg-orange-50 text-orange-600' },
    system_notification: { label: 'Alert', className: 'bg-amber-50 text-amber-600' },
  };
  const typeBadge = typeBadgeMap[message.type];

  const isSwipeActive = Math.abs(swipeX) > 0;
  const swipeRightActive = swipeX >= SWIPE_THRESHOLD;
  const swipeLeftActive = swipeX <= -SWIPE_THRESHOLD;

  return (
    <div className="border-b border-gray-100 last:border-b-0 group relative overflow-hidden">
      {/* Swipe reveal backgrounds */}
      {isSwipeActive && (
        <>
          {/* Right swipe → Archive (orange) */}
          {swipeX > 0 && (
            <div className={cn(
              'absolute inset-y-0 left-0 flex items-center pl-5 transition-colors',
              swipeRightActive ? 'bg-orange-500' : 'bg-orange-200'
            )} style={{ width: Math.abs(swipeX) }}>
              <Archive className={cn('w-5 h-5', swipeRightActive ? 'text-white' : 'text-orange-600')} />
            </div>
          )}
          {/* Left swipe → Toggle read (blue) */}
          {swipeX < 0 && (
            <div className={cn(
              'absolute inset-y-0 right-0 flex items-center justify-end pr-5 transition-colors',
              swipeLeftActive ? 'bg-blue-500' : 'bg-blue-200'
            )} style={{ width: Math.abs(swipeX) }}>
              {message.isUnread
                ? <MailOpen className={cn('w-5 h-5', swipeLeftActive ? 'text-white' : 'text-blue-600')} />
                : <Mail className={cn('w-5 h-5', swipeLeftActive ? 'text-white' : 'text-blue-600')} />
              }
            </div>
          )}
        </>
      )}

      {/* Main Item Row */}
      <div
        onClick={() => !isSwipingRef.current && onClick(message)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer bg-white relative',
          !isSwipeActive && 'transition-colors hover:bg-gray-50 active:bg-gray-100',
          'border-l-[3px]',
          borderColor
        )}
        style={isSwipeActive ? { transform: `translateX(${swipeX}px)` } : undefined}
      >
        {/* Type Icon - smaller */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            message.iconBgColor
          )}
        >
          <IconComponent className={cn('w-4 h-4', message.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Sender + timestamp */}
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                'text-sm truncate',
                message.isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
              )}
            >
              {message.title}
            </h3>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
          {/* Row 2: Type badge + preview */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {typeBadge && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', typeBadge.className)}>
                {typeBadge.label}
              </span>
            )}
            <p
              className={cn(
                'text-xs truncate',
                message.isUnread ? 'text-gray-600' : 'text-gray-400'
              )}
            >
              {message.preview}
            </p>
          </div>

          {/* Action Buttons Row */}
          {(canReply || canAcknowledge) && !showReplyComposer && (
            <div className="flex items-center gap-2 mt-1.5">
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

        {/* Right side: unread dot + archive */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {message.isUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
          {message.isDismissed && onRestore ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(message); }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              aria-label="Restore"
              title="Restore to inbox"
            >
              <ArchiveRestore className="w-4 h-4" />
            </button>
          ) : onDismiss ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(message); }}
              className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Archive"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          ) : null}
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
