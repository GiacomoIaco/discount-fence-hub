/**
 * InboxPeekToast - Preview popup for new messages when the right pane is closed.
 * Shows above the FloatingMessageButton on desktop for ~6 seconds, then auto-dismisses.
 * Clicking opens the right pane inbox.
 */

import { X, MessageSquare, Users, Megaphone, Ticket, Bell } from 'lucide-react';
import { useRightPane } from '../context/RightPaneContext';
import { useInboxPeek } from '../hooks/useInboxPeek';
import type { PeekMessage } from '../context/RightPaneContext';

const typeConfig: Record<PeekMessage['type'], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  sms: { icon: MessageSquare, label: 'SMS', color: 'text-green-600' },
  team_chat: { icon: Users, label: 'Chat', color: 'text-blue-600' },
  ticket_chat: { icon: Ticket, label: 'Ticket', color: 'text-purple-600' },
  team_announcement: { icon: Megaphone, label: 'Announcement', color: 'text-orange-600' },
  system_notification: { icon: Bell, label: 'Notification', color: 'text-gray-600' },
};

export function InboxPeekToast() {
  // Subscribe to realtime message events for peek notifications
  useInboxPeek();
  const { peekMessage, dismissPeek, open } = useRightPane();

  if (!peekMessage) return null;

  const config = typeConfig[peekMessage.type];
  const Icon = config.icon;

  const handleClick = () => {
    dismissPeek();
    open();
  };

  return (
    <div
      className="fixed bottom-24 right-6 z-50 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <button
        onClick={handleClick}
        className="w-full bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-left hover:bg-gray-50 transition-colors group"
      >
        {/* Close button */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); dismissPeek(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); dismissPeek(); } }}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={`mt-0.5 p-2 rounded-lg bg-gray-100 ${config.color}`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {peekMessage.senderName}
              </span>
              <span className="text-[10px] text-gray-400 uppercase font-medium shrink-0">
                {config.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 leading-snug">
              {peekMessage.preview}
            </p>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        <div className="mt-3 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ animation: 'shrink-width 6s linear forwards' }}
          />
        </div>
      </button>

      {/* Inline keyframe for the progress bar */}
      <style>{`
        @keyframes shrink-width {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default InboxPeekToast;
