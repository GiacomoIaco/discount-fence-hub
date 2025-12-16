import { useEffect, useRef, useState } from 'react';
import { X, Minimize2, MessageSquare, Phone, Mail, User, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../../lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { MessageComposer } from './MessageComposer';
import * as messageService from '../services/messageService';
import * as quickReplyService from '../services/quickReplyService';
import type { Message, Conversation, ConversationWithContact, ShortcodeContext } from '../types';

export function RightPaneMessaging() {
  const {
    isOpen,
    isMinimized,
    selectedContact,
    selectedConversation,
    prefilledMessage,
    close,
    minimize,
    setConversation,
    setPrefilledMessage
  } = useRightPane();

  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setLocalConversation] = useState<ConversationWithContact | Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch or create conversation when contact is selected
  useEffect(() => {
    async function loadConversation() {
      if (selectedConversation) {
        setLocalConversation(selectedConversation);
        return;
      }

      if (!selectedContact) {
        setLocalConversation(null);
        return;
      }

      setIsLoading(true);
      try {
        // Try to find existing conversation with this contact
        const conversations = await messageService.getConversations('all');
        const existing = conversations.find(c => c.contact_id === selectedContact.id);

        if (existing) {
          setLocalConversation(existing);
          setConversation(existing as Conversation);
        } else {
          // Create new conversation
          const newConvo = await messageService.createConversation(selectedContact.id);
          setLocalConversation(newConvo);
          setConversation(newConvo);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      loadConversation();
    }
  }, [selectedContact, selectedConversation, isOpen, setConversation]);

  const { data: messages = [], isLoading: messagesLoading } = useMessages(conversation?.id || null);
  const sendMessage = useSendMessage();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build shortcode context
  const shortcodeContext: ShortcodeContext = selectedContact
    ? quickReplyService.buildShortcodeContext(selectedContact)
    : {};

  const handleSend = (body: string) => {
    if (!conversation || !selectedContact) return;

    sendMessage.mutate({
      conversation_id: conversation.id,
      channel: 'sms',
      direction: 'outbound',
      body,
      to_phone: selectedContact.phone_primary
    });

    // Clear prefilled message after sending
    if (prefilledMessage) {
      setPrefilledMessage('');
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Minimized state
  if (isMinimized) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg cursor-pointer hover:bg-blue-700 transition-colors z-50"
        onClick={() => minimize()}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {selectedContact && (
            <span className="text-sm font-medium max-w-[150px] truncate">
              {selectedContact.display_name}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl border-l flex flex-col z-50 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            {selectedContact?.avatar_url ? (
              <img
                src={selectedContact.avatar_url}
                alt={selectedContact.display_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5 text-blue-600" />
            )}
          </div>

          {/* Contact Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {selectedContact?.display_name || 'New Message'}
            </h3>
            {selectedContact?.phone_primary && (
              <p className="text-xs text-gray-500">{selectedContact.phone_primary}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {selectedContact?.phone_primary && (
            <a
              href={`tel:${selectedContact.phone_primary}`}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {selectedContact?.email_primary && (
            <a
              href={`mailto:${selectedContact.email_primary}`}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={minimize}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={close}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isLoading || messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-12 h-12 mb-2" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer
        onSend={handleSend}
        disabled={!conversation || sendMessage.isPending}
        isOptedOut={selectedContact?.sms_opted_out}
        shortcodeContext={shortcodeContext}
        placeholder={
          prefilledMessage
            ? prefilledMessage
            : `Message ${selectedContact?.display_name || 'contact'}...`
        }
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isOutbound
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white border shadow-sm rounded-bl-md'
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs',
            isOutbound ? 'text-blue-200' : 'text-gray-400'
          )}
        >
          <span>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
          {isOutbound && (
            <span className="ml-1">
              {message.status === 'sending' && '⏳'}
              {message.status === 'sent' && '✓'}
              {message.status === 'delivered' && '✓✓'}
              {message.status === 'failed' && '❌'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default RightPaneMessaging;
