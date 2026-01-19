/**
 * Empty state component for the unified inbox
 * Shows different messages based on the active filter
 */

import { Inbox, MessageSquare, Megaphone, Bell, Ticket } from 'lucide-react';
import type { UnifiedInboxFilter } from '../types';

interface InboxEmptyStateProps {
  filter: UnifiedInboxFilter;
}

const emptyStates: Record<UnifiedInboxFilter, {
  icon: typeof Inbox;
  iconColor: string;
  iconBgColor: string;
  title: string;
  description: string;
}> = {
  all: {
    icon: Inbox,
    iconColor: 'text-gray-400',
    iconBgColor: 'bg-gray-100',
    title: "You're all caught up!",
    description: 'No new messages, announcements, or notifications.',
  },
  sms: {
    icon: MessageSquare,
    iconColor: 'text-blue-400',
    iconBgColor: 'bg-blue-50',
    title: 'No SMS conversations',
    description: 'Client messages will appear here when you receive them.',
  },
  team: {
    icon: Megaphone,
    iconColor: 'text-purple-400',
    iconBgColor: 'bg-purple-50',
    title: 'No team announcements',
    description: 'Company updates and announcements will appear here.',
  },
  tickets: {
    icon: Ticket,
    iconColor: 'text-orange-400',
    iconBgColor: 'bg-orange-50',
    title: 'No ticket activity',
    description: 'Chat updates from your tickets will appear here.',
  },
  alerts: {
    icon: Bell,
    iconColor: 'text-amber-400',
    iconBgColor: 'bg-amber-50',
    title: 'No notifications',
    description: 'Quote views, invoice payments, and other alerts will appear here.',
  },
};

export function InboxEmptyState({ filter }: InboxEmptyStateProps) {
  const state = emptyStates[filter];
  const Icon = state.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className={`w-16 h-16 rounded-full ${state.iconBgColor} flex items-center justify-center mb-4`}>
        <Icon className={`w-8 h-8 ${state.iconColor}`} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {state.title}
      </h3>
      <p className="text-sm text-gray-500 max-w-xs">
        {state.description}
      </p>
    </div>
  );
}

export default InboxEmptyState;
