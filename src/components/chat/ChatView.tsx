import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Paperclip, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { showError, showSuccess } from '../../lib/toast';
import type { DirectMessage, ConversationWithDetails } from '../../types/chat';

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
}

interface MessageWithSenderInfo extends DirectMessage {
  sender_name: string;
  is_own_message: boolean;
}

export default function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageWithSenderInfo[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages for this conversation
  useEffect(() => {
    if (!conversation) return;

    loadMessages();
    markAsRead();

    // Subscribe to new messages in this conversation
    const subscription = supabase
      .channel(`conversation:${conversation.conversation_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.conversation_id}`
        },
        (payload) => {
          const newMsg = payload.new as DirectMessage;
          const messageWithInfo: MessageWithSenderInfo = {
            ...newMsg,
            sender_name: newMsg.sender_id === user?.id ? 'You' : conversation.other_user_name,
            is_own_message: newMsg.sender_id === user?.id
          };
          setMessages((prev) => [...prev, messageWithInfo]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversation.conversation_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithInfo: MessageWithSenderInfo[] = (data || []).map((msg) => ({
        ...msg,
        sender_name: msg.sender_id === user?.id ? 'You' : conversation.other_user_name,
        is_own_message: msg.sender_id === user?.id
      }));

      setMessages(messagesWithInfo);
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await supabase.rpc('mark_conversation_read', {
        conv_id: conversation.conversation_id
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversation.conversation_id,
          sender_id: user?.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      showError('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);

      // Upload to storage
      const filePath = `${conversation.conversation_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      // Send message with file attachment
      const { error: messageError } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversation.conversation_id,
          sender_id: user?.id,
          content: `Sent a file: ${file.name}`,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        });

      if (messageError) throw messageError;

      showSuccess('File uploaded');

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showError('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 flex-1">
          <div
            className={`w-2 h-2 rounded-full ${
              conversation.other_user_status === 'online'
                ? 'bg-green-500'
                : conversation.other_user_status === 'away'
                ? 'bg-yellow-500'
                : 'bg-gray-300'
            }`}
          />
          <div>
            <h2 className="font-semibold text-gray-900">{conversation.other_user_name}</h2>
            <p className="text-xs text-gray-500">
              {conversation.other_user_status === 'online' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_own_message ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.is_own_message
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {/* File attachment */}
                {message.file_url && (
                  <div className="mb-2">
                    {message.file_type?.startsWith('image/') ? (
                      <img
                        src={message.file_url}
                        alt={message.file_name || 'Image'}
                        className="rounded max-w-full h-auto mb-1"
                      />
                    ) : (
                      <a
                        href={message.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 p-2 rounded ${
                          message.is_own_message ? 'bg-blue-700' : 'bg-gray-200'
                        }`}
                      >
                        <Paperclip className="w-4 h-4" />
                        <span className="text-sm truncate">{message.file_name}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Message content */}
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                {/* Timestamp */}
                <p
                  className={`text-xs mt-1 ${
                    message.is_own_message ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title="Attach file"
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
