/**
 * QuoteReply - Reply-to-specific-message (quote reply) components
 *
 * ReplyPreview: Shows the quoted message preview above the composer textarea
 * QuotedMessage: Inline display of the quoted parent message inside a message bubble
 * useReplyTo: Lightweight state hook for managing the reply-to target
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { X, Reply, CornerDownRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReplyTarget {
  id: string;
  senderName: string;
  content: string;
  /** 'team_chat' uses reply_to_message_id, 'ticket_chat' uses reply_to_note_id */
  messageType: 'team_chat' | 'ticket_chat';
}

// ─── Context / Hook ─────────────────────────────────────────────────────────

interface ReplyToState {
  replyTarget: ReplyTarget | null;
  setReplyTarget: (target: ReplyTarget | null) => void;
  clearReply: () => void;
}

const ReplyToContext = createContext<ReplyToState | null>(null);

export function ReplyToProvider({ children }: { children: React.ReactNode }) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  const clearReply = useCallback(() => setReplyTarget(null), []);

  return (
    <ReplyToContext.Provider value={{ replyTarget, setReplyTarget, clearReply }}>
      {children}
    </ReplyToContext.Provider>
  );
}

export function useReplyTo() {
  const ctx = useContext(ReplyToContext);
  if (!ctx) {
    // Graceful fallback for components outside ReplyToProvider
    const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
    const clearReply = useCallback(() => setReplyTarget(null), []);
    return { replyTarget, setReplyTarget, clearReply };
  }
  return ctx;
}

// ─── ReplyPreview ───────────────────────────────────────────────────────────
// Shows above the composer textarea when replying to a specific message

interface ReplyPreviewProps {
  /** Pass a full ReplyTarget object */
  target?: ReplyTarget;
  /** Or pass individual fields directly */
  senderName?: string;
  content?: string;
  /** Callback when user dismisses the reply preview */
  onCancel?: () => void;
  onClear?: () => void;
}

export function ReplyPreview({ target, senderName, content, onCancel, onClear }: ReplyPreviewProps) {
  const displayName = target?.senderName ?? senderName ?? 'Unknown';
  const displayContent = target?.content ?? content ?? '';
  const handleDismiss = onCancel ?? onClear;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg mx-1 mb-2">
      <Reply className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0 scale-x-[-1]" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-blue-700 block">
          {displayName}
        </span>
        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
          {displayContent}
        </p>
      </div>
      {handleDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          aria-label="Cancel reply"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── QuotedMessage ──────────────────────────────────────────────────────────
// Displayed inside a message bubble to show which message it replies to

interface QuotedMessageProps {
  senderName: string;
  content: string;
  /** Whether the parent bubble is from the current user (outbound style) */
  isOutbound?: boolean;
  onClick?: () => void;
}

export function QuotedMessage({ senderName, content, isOutbound = false, onClick }: QuotedMessageProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg px-3 py-1.5 mb-1.5 border-l-3 transition-colors',
        isOutbound
          ? 'bg-blue-500/30 border-blue-300/60 hover:bg-blue-500/40'
          : 'bg-gray-100 border-gray-300 hover:bg-gray-200',
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold block',
          isOutbound ? 'text-blue-200' : 'text-blue-600'
        )}
      >
        {senderName}
      </span>
      <p
        className={cn(
          'text-xs line-clamp-2 mt-0.5',
          isOutbound ? 'text-blue-100/80' : 'text-gray-500'
        )}
      >
        {content}
      </p>
    </button>
  );
}

// ─── ReplyButton ────────────────────────────────────────────────────────────
// Small reply button shown on hover/long-press on a message bubble

interface ReplyButtonProps {
  onClick: () => void;
  isOutbound?: boolean;
  className?: string;
}

export function ReplyButton({ onClick, isOutbound = false, className }: ReplyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-1 rounded-full transition-all opacity-0 group-hover:opacity-100',
        isOutbound
          ? 'text-blue-200 hover:text-white hover:bg-blue-500/50'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
        className,
      )}
      title="Reply"
    >
      <CornerDownRight className="w-3.5 h-3.5" />
    </button>
  );
}

export default ReplyPreview;
