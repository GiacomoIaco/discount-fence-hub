/**
 * InlineReplyComposer - Compact composer for quick inline replies in the unified inbox
 * Appears below a message item when user wants to reply
 */

import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface InlineReplyComposerProps {
  placeholder?: string;
  onSend: (body: string) => Promise<void>;
  onCancel: () => void;
  isSending?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}

export function InlineReplyComposer({
  placeholder = 'Type a reply...',
  onSend,
  onCancel,
  isSending = false,
  maxLength = 500,
  autoFocus = true,
}: InlineReplyComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isSending) return;

    await onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to cancel
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    // Enter to send (unless shift is held)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isOverLimit = value.length > maxLength;
  const canSend = value.trim().length > 0 && !isOverLimit && !isSending;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
    >
      <div className="flex items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSending}
          rows={1}
          className={cn(
            'flex-1 px-3 py-2 bg-transparent resize-none text-sm',
            'focus:outline-none placeholder:text-gray-400',
            'disabled:text-gray-400'
          )}
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          {/* Character count */}
          {value.length > 0 && (
            <span
              className={cn(
                'text-xs mr-1',
                isOverLimit ? 'text-red-500' : 'text-gray-400'
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}

          {/* Cancel button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              'p-1.5 rounded transition-colors',
              canSend
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
            title="Send (Enter)"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="px-3 pb-2 text-xs text-gray-400">
        Press <kbd className="bg-gray-200 px-1 rounded">Enter</kbd> to send,{' '}
        <kbd className="bg-gray-200 px-1 rounded">Shift+Enter</kbd> for new line
      </div>
    </form>
  );
}

export default InlineReplyComposer;
