/**
 * Single list item for the unified inbox
 * Shows: type icon | title & preview | timestamp | unread indicator
 */

import { MessageSquare, Megaphone, Bell } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { UnifiedMessage } from '../types';

interface UnifiedInboxItemProps {
  message: UnifiedMessage;
  onClick: (message: UnifiedMessage) => void;
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

export function UnifiedInboxItem({ message, onClick }: UnifiedInboxItemProps) {
  const IconComponent = iconMap[message.icon as keyof typeof iconMap] || Bell;

  return (
    <button
      onClick={() => onClick(message)}
      className={cn(
        'w-full flex items-start gap-3 p-4 text-left transition-colors',
        'border-b border-gray-100 last:border-b-0',
        'hover:bg-gray-50 active:bg-gray-100',
        'min-h-[72px]' // Ensure good touch target
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
      </div>
    </button>
  );
}

export default UnifiedInboxItem;
