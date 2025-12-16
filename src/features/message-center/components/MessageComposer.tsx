import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Image, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { QuickReplyPicker } from './QuickReplyPicker';
import { useQuickReplies } from '../hooks/useQuickReplies';
import * as quickReplyService from '../services/quickReplyService';
import type { ShortcodeContext, QuickReply } from '../types';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isOptedOut?: boolean;
  shortcodeContext?: ShortcodeContext;
}

export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  isOptedOut = false,
  shortcodeContext = {}
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [shortcutMatch, setShortcutMatch] = useState<QuickReply | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: quickReplies = [] } = useQuickReplies();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Detect shortcut as user types
  useEffect(() => {
    const detected = quickReplyService.detectShortcut(message);
    if (detected) {
      const match = quickReplies.find(r => r.shortcut === detected.shortcut);
      setShortcutMatch(match || null);
    } else {
      setShortcutMatch(null);
    }
  }, [message, quickReplies]);

  const handleSelectQuickReply = useCallback((reply: QuickReply) => {
    const processed = quickReplyService.replaceShortcodes(reply.body, shortcodeContext);
    setMessage(processed);
    setShowQuickReplies(false);
    textareaRef.current?.focus();

    // Increment use count
    quickReplyService.incrementUseCount(reply.id).catch(console.error);
  }, [shortcodeContext]);

  const handleApplyShortcut = useCallback(() => {
    if (shortcutMatch) {
      handleSelectQuickReply(shortcutMatch);
    }
  }, [shortcutMatch, handleSelectQuickReply]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isOptedOut) return;

    onSend(message.trim());
    setMessage('');
    setShortcutMatch(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Tab to apply shortcut
    if (e.key === 'Tab' && shortcutMatch) {
      e.preventDefault();
      handleApplyShortcut();
      return;
    }

    // Enter to send (unless shift is held)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show opt-out warning
  if (isOptedOut) {
    return (
      <div className="border-t bg-yellow-50 p-4">
        <div className="flex items-center gap-3 text-yellow-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">This contact has opted out of SMS</p>
            <p className="text-xs text-yellow-700">They texted STOP and cannot receive messages until they reply START.</p>
          </div>
        </div>
      </div>
    );
  }

  // Character count for SMS
  const isOverSMSLimit = message.length > 160;
  const smsCount = Math.ceil(message.length / 160);

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4 relative">
      {/* Quick Reply Picker */}
      {showQuickReplies && (
        <QuickReplyPicker
          replies={quickReplies}
          onSelect={handleSelectQuickReply}
          onClose={() => setShowQuickReplies(false)}
        />
      )}

      {/* Shortcut Match Preview */}
      {shortcutMatch && (
        <div className="absolute bottom-full left-4 right-4 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg z-40">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded text-blue-700">
                  {shortcutMatch.shortcut}
                </code>
                <span className="font-medium text-blue-900 text-sm">{shortcutMatch.title}</span>
              </div>
              <p className="text-xs text-blue-700 mt-1 line-clamp-2">
                {quickReplyService.replaceShortcodes(shortcutMatch.body, shortcodeContext)}
              </p>
            </div>
            <div className="text-xs text-blue-600 ml-2 whitespace-nowrap">
              Press <kbd className="bg-blue-100 px-1 rounded">Tab</kbd>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Quick Reply Button */}
        <button
          type="button"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className={cn(
            'p-2 rounded-lg transition-colors',
            showQuickReplies
              ? 'bg-yellow-100 text-yellow-600'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          )}
          title="Quick replies"
        >
          <Zap className="w-5 h-5" />
        </button>

        {/* Attachment Buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach file (coming soon)"
            disabled
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach image (coming soon)"
            disabled
          >
            <Image className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm"
          />
          {/* Character count for SMS */}
          {message.length > 0 && !shortcutMatch && (
            <span
              className={`absolute bottom-2 right-2 text-xs ${
                isOverSMSLimit ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              {message.length}
              {isOverSMSLimit && ` (${smsCount} SMS)`}
            </span>
          )}
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send • Type <code className="bg-gray-100 px-1 rounded">/</code> for shortcuts
      </p>
    </form>
  );
}

export default MessageComposer;
