/**
 * EntityMessagesTab - Messages tab for entity detail pages
 * Shows all messages linked to a Job, Quote, Request, or Invoice
 * Allows sending new messages with the entity link
 */

import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Phone,
  Mail,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useEntityMessages,
  useSendEntityMessage,
  type EntityType,
} from '../../message-center/hooks/useEntityMessages';
import type { Message, Conversation, Contact } from '../../message-center/types';

interface EntityMessagesTabProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string; // e.g., "Job #J-1234"
  // Optional: Pre-linked conversation for SMS
  conversationId?: string;
  contactPhone?: string;
  contactName?: string;
  // Navigation callback to open full message hub
  onOpenMessageHub?: (conversationId: string) => void;
}

export function EntityMessagesTab({
  entityType,
  entityId,
  entityLabel,
  conversationId,
  contactPhone,
  contactName,
  onOpenMessageHub,
}: EntityMessagesTabProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [sendChannel, setSendChannel] = useState<'in_app' | 'sms'>('in_app');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading, error } = useEntityMessages({
    entityType,
    entityId,
  });

  const sendMessage = useSendEntityMessage();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user?.id) return;

    await sendMessage.mutateAsync({
      entityType,
      entityId,
      conversationId,
      body: newMessage.trim(),
      channel: sendChannel,
      toPhone: sendChannel === 'sms' ? contactPhone : undefined,
      fromUserId: user.id,
    });

    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Failed to load messages: {error.message}
      </div>
    );
  }

  const canSendSms = !!contactPhone;

  return (
    <div className="bg-white rounded-lg border flex flex-col" style={{ minHeight: '400px' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            Messages
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {messages?.length || 0} message{messages?.length !== 1 ? 's' : ''} linked to {entityLabel}
          </p>
        </div>

        {/* Channel toggle for SMS-capable entities */}
        {canSendSms && (
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSendChannel('in_app')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                sendChannel === 'in_app'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Mail className="w-4 h-4 inline-block mr-1" />
              Note
            </button>
            <button
              onClick={() => setSendChannel('sms')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                sendChannel === 'sms'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Phone className="w-4 h-4 inline-block mr-1" />
              SMS
            </button>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <MessageSquare className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={user?.id}
              onOpenConversation={
                message.conversation_id && onOpenMessageHub
                  ? () => onOpenMessageHub(message.conversation_id)
                  : undefined
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t bg-white p-4">
        {sendChannel === 'sms' && contactPhone && (
          <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            Sending SMS to {contactName || contactPhone}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sendChannel === 'sms'
                  ? `SMS to ${contactName || 'client'}...`
                  : `Add a note about ${entityLabel}...`
              }
              disabled={sendMessage.isPending}
              rows={1}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
            {newMessage.length > 0 && sendChannel === 'sms' && (
              <span
                className={cn(
                  'absolute bottom-2 right-2 text-xs',
                  newMessage.length > 160 ? 'text-orange-500' : 'text-gray-400'
                )}
              >
                {newMessage.length}
                {newMessage.length > 160 && ` (${Math.ceil(newMessage.length / 160)} SMS)`}
              </span>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-400">
          Press Enter to send
        </p>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message & { conversation?: Conversation & { contact?: Contact } };
  currentUserId?: string;
  onOpenConversation?: () => void;
}

function MessageBubble({ message, currentUserId, onOpenConversation }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isFromCurrentUser = message.from_user_id === currentUserId;

  // Get sender name
  const senderName = (() => {
    if (message.sender?.full_name) return message.sender.full_name;
    if (message.conversation?.contact?.display_name) return message.conversation.contact.display_name;
    if (message.from_phone) return message.from_phone;
    return 'Unknown';
  })();

  // Channel badge
  const channelBadge = (() => {
    switch (message.channel) {
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
            <Phone className="w-3 h-3" />
            SMS
          </span>
        );
      case 'in_app':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
            <Mail className="w-3 h-3" />
            Note
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        'flex',
        isFromCurrentUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2',
          isFromCurrentUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white border shadow-sm rounded-bl-md'
        )}
      >
        {/* Header with sender and channel */}
        <div
          className={cn(
            'flex items-center gap-2 mb-1 text-xs',
            isFromCurrentUser ? 'text-blue-200' : 'text-gray-500'
          )}
        >
          <span className="font-medium">{senderName}</span>
          {channelBadge}
        </div>

        {/* Message body */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

        {/* Footer with timestamp and status */}
        <div
          className={cn(
            'flex items-center justify-between gap-2 mt-1 text-xs',
            isFromCurrentUser ? 'text-blue-200' : 'text-gray-400'
          )}
        >
          <span>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>

          <div className="flex items-center gap-2">
            {/* SMS status indicators */}
            {message.channel === 'sms' && isOutbound && (
              <span>
                {message.status === 'sending' && '\u23f3'}
                {message.status === 'sent' && '\u2713'}
                {message.status === 'delivered' && '\u2713\u2713'}
                {message.status === 'failed' && '\u274c'}
              </span>
            )}

            {/* Link to conversation */}
            {message.conversation_id && onOpenConversation && (
              <button
                onClick={onOpenConversation}
                className={cn(
                  'flex items-center gap-1 hover:underline',
                  isFromCurrentUser ? 'text-blue-200' : 'text-gray-400'
                )}
              >
                <ExternalLink className="w-3 h-3" />
                View thread
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntityMessagesTab;
