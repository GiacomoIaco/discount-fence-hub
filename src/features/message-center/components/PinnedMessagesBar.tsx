import { useState } from 'react';
import { Pin, ChevronDown, ChevronUp, X } from 'lucide-react';

interface PinnedMessageItem {
  id: string;
  message_id: string;
  message_type: string;
  pinned_at: string;
}

interface PinnedMessagesBarProps {
  pinnedMessages: PinnedMessageItem[];
  messageContentMap: Record<string, string>;
  onJumpToMessage: (messageId: string) => void;
  onUnpin: (messageId: string, messageType: string) => void;
}

export function PinnedMessagesBar({
  pinnedMessages,
  messageContentMap,
  onJumpToMessage,
  onUnpin,
}: PinnedMessagesBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pinnedMessages.length === 0) return null;

  const latestPin = pinnedMessages[0];
  const latestContent = messageContentMap[latestPin.message_id] || 'Pinned message';

  // Collapsed: single-line banner showing latest pin
  if (!isExpanded) {
    return (
      <button
        onClick={() => pinnedMessages.length > 1 ? setIsExpanded(true) : onJumpToMessage(latestPin.message_id)}
        className="flex items-center gap-2 w-full px-4 py-2 bg-amber-50 border-b border-amber-200 hover:bg-amber-100 transition-colors text-left"
      >
        <Pin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 rotate-45" />
        <span className="text-sm text-amber-900 truncate flex-1">
          {latestContent}
        </span>
        {pinnedMessages.length > 1 && (
          <span className="text-xs text-amber-600 font-medium flex-shrink-0">
            {pinnedMessages.length} pinned
          </span>
        )}
        {pinnedMessages.length > 1 && (
          <ChevronDown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        )}
      </button>
    );
  }

  // Expanded: show all pinned messages
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-amber-600 rotate-45" />
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            {pinnedMessages.length} Pinned Message{pinnedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-amber-100">
        {pinnedMessages.map((pin) => {
          const content = messageContentMap[pin.message_id] || 'Pinned message';
          return (
            <div
              key={pin.id}
              className="flex items-center gap-2 px-4 py-2 hover:bg-amber-100 transition-colors group"
            >
              <button
                onClick={() => onJumpToMessage(pin.message_id)}
                className="flex-1 text-sm text-amber-900 truncate text-left"
              >
                {content}
              </button>
              <button
                onClick={() => onUnpin(pin.message_id, pin.message_type)}
                className="p-1 text-amber-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Unpin"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PinnedMessagesBar;
