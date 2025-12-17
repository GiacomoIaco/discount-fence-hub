import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import type { Message } from '../types';

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p className="text-sm">No messages in this conversation</p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {/* Date Divider */}
          <div className="flex items-center justify-center my-4">
            <span className="px-3 py-1 text-xs text-gray-500 bg-white rounded-full shadow-sm">
              {date}
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {msgs.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const senderName = message.sender?.full_name;

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
        }`}
      >
        {/* Sender name for outbound messages (internal attribution) */}
        {isOutbound && senderName && (
          <p className="text-xs text-blue-200 mb-1 font-medium">
            {senderName}
          </p>
        )}

        {/* Message Body */}
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>

        {/* Footer: Time + Status */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 ${
            isOutbound ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          <span className="text-xs">
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>

        {/* AI Detection Banner */}
        {message.is_project_signal && (
          <div className={`mt-2 p-2 rounded text-xs ${
            isOutbound ? 'bg-blue-500/30 text-blue-100' : 'bg-orange-100 text-orange-800'
          }`}>
            Project signal detected ({Math.round((message.project_confidence || 0) * 100)}% confidence)
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3" />;
    case 'sent':
      return <Check className="w-3 h-3" />;
    case 'delivered':
    case 'read':
      return <CheckCheck className="w-3 h-3" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-300" />;
    default:
      return null;
  }
}

function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};

  messages.forEach((message) => {
    const date = format(new Date(message.created_at), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return groups;
}

export default MessageThread;
