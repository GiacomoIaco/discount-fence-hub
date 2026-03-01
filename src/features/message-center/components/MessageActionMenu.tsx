import { useState, useEffect, useRef, useCallback } from 'react';
import { Reply, Pin, PinOff, Copy, X } from 'lucide-react';

const REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '🙏'];

interface MessageActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  messageType: 'sms' | 'team_chat' | 'ticket_chat' | 'team_announcement';
  isPinned?: boolean;
  onReaction: (emoji: string) => void;
  onReply?: () => void;
  onPin?: () => void;
  onCopy?: () => void;
}

export function MessageActionMenu({
  isOpen,
  onClose,
  position,
  messageType,
  isPinned = false,
  onReaction,
  onReply,
  onPin,
  onCopy,
}: MessageActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // SMS doesn't support reply-to (Twilio limitation)
  const showReply = messageType !== 'sms' && messageType !== 'team_announcement' && onReply;
  const showPin = messageType !== 'team_announcement' && onPin;

  // Position menu relative to viewport, adjusting if it would overflow
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y - 60, window.innerHeight - 200),
    zIndex: 60,
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={menuRef}
        style={menuStyle}
        className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reaction bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReaction(emoji); onClose(); }}
              className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 rounded-full transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="py-1">
          {showReply && (
            <button
              onClick={() => { onReply(); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          )}
          {showPin && (
            <button
              onClick={() => { onPin(); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onCopy && (
            <button
              onClick={() => { onCopy(); onClose(); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageActionMenu;
