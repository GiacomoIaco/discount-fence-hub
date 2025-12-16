import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image } from 'lucide-react';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Type a message...'
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Character count warning for SMS
  const isOverSMSLimit = message.length > 160;
  const smsCount = Math.ceil(message.length / 160);

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
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
          {message.length > 0 && (
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
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

export default MessageComposer;
