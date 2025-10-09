import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, AtSign } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import {
  getMessages,
  sendMessage,
  markConversationRead,
  subscribeToConversation,
  type DirectMessage,
  type ConversationWithDetails
} from '../../lib/messages';
import { supabase } from '../../lib/supabase';
import { MentionAutocomplete } from './MentionAutocomplete';

interface ConversationViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onMessageSent: () => void;
}

export function ConversationView({ conversation, onBack, onMessageSent }: ConversationViewProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCurrentUser();
    loadMessages();
    markAsRead();

    // Subscribe to new messages
    const unsubscribe = subscribeToConversation(conversation.id, (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
      markAsRead();
    });

    return () => {
      unsubscribe();
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getMessages(conversation.id);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await markConversationRead(conversation.id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const message = await sendMessage(conversation.id, newMessage);
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
      onMessageSent();
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;

    setNewMessage(value);
    setCursorPosition(position);

    // Check for @mention trigger
    const textBeforeCursor = value.substring(0, position);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Only show mentions if @ is at start or after a space, and no space after @
      const charBeforeAt = lastAtSymbol > 0 ? textBeforeCursor[lastAtSymbol - 1] : ' ';
      if ((charBeforeAt === ' ' || lastAtSymbol === 0) && !textAfterAt.includes(' ')) {
        setShowMentions(true);
        setMentionSearch(textAfterAt);
        return;
      }
    }

    setShowMentions(false);
    setMentionSearch('');
  };

  const handleMentionSelect = (username: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const textAfterCursor = newMessage.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const beforeAt = newMessage.substring(0, lastAtSymbol);
      const newText = beforeAt + '@' + username + ' ' + textAfterCursor;
      setNewMessage(newText);
      setShowMentions(false);
      setMentionSearch('');

      // Focus back on input
      setTimeout(() => {
        inputRef.current?.focus();
        const newPosition = (beforeAt + '@' + username + ' ').length;
        inputRef.current?.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'h:mm a');
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const renderMessageContent = (content: string) => {
    // Highlight @mentions in messages
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-blue-600 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-700 font-medium">
            {conversation.otherUser?.name.charAt(0).toUpperCase() || '?'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {conversation.otherUser?.name || 'Unknown User'}
          </h2>
          <p className="text-sm text-gray-500 truncate">
            {conversation.otherUser?.email}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AtSign className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No messages yet</p>
            <p className="text-gray-400 text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.sender_id === currentUserId;
              const showDateDivider = index === 0 ||
                new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString();

              return (
                <div key={message.id}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                        {isToday(new Date(message.created_at)) ? 'Today' :
                         isYesterday(new Date(message.created_at)) ? 'Yesterday' :
                         format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </div>
                    </div>
                  )}

                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`px-4 py-2 rounded-2xl ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {renderMessageContent(message.content)}
                        </p>
                      </div>
                      <p className={`text-xs text-gray-400 mt-1 px-2 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        {formatMessageDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white relative">
        {/* Mention Autocomplete */}
        {showMentions && (
          <div className="absolute bottom-full left-0 right-0 mb-2">
            <MentionAutocomplete
              search={mentionSearch}
              onSelect={handleMentionSelect}
              onClose={() => setShowMentions(false)}
            />
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message... (use @ to mention)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <AtSign className="w-3 h-3" />
          Type @ to mention someone
        </p>
      </div>
    </div>
  );
}
