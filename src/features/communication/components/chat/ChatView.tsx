import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Paperclip, Send, Users } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { showError, showSuccess } from '../../../../lib/toast';
import type { DirectMessage, ConversationWithDetails, ParticipantWithDetails } from '../../../../types/chat';

// Fire-and-forget chat notification
function sendChatNotification(payload: {
  type: 'direct_message' | 'group_message';
  conversationId: string;
  conversationName?: string;
  senderId: string;
  senderName: string;
  messageContent: string;
  isGroup: boolean;
}): void {
  fetch('/.netlify/functions/send-chat-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(response => {
      if (!response.ok) {
        console.warn('Chat notification request failed:', response.status);
      }
    })
    .catch(error => {
      console.error('Failed to send chat notification:', error);
    });
}

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
}

interface MessageWithSenderInfo extends DirectMessage {
  sender_name: string;
  is_own_message: boolean;
}

export default function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<MessageWithSenderInfo[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [participants, setParticipants] = useState<ParticipantWithDetails[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages and participants for this conversation
  useEffect(() => {
    if (!conversation) return;

    loadMessages();
    markAsRead();

    // Load participants if it's a group conversation
    if (conversation.is_group) {
      loadParticipants();
    }

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
          const senderName = getSenderName(newMsg.sender_id);
          const messageWithInfo: MessageWithSenderInfo = {
            ...newMsg,
            sender_name: senderName,
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

  // Re-resolve sender names when participants load (fixes race condition)
  useEffect(() => {
    if (conversation.is_group && participants.length > 0 && messages.length > 0) {
      // Check if any messages have "Unknown" sender that can now be resolved
      const needsUpdate = messages.some(
        msg => !msg.is_own_message && msg.sender_name === 'Unknown'
      );

      if (needsUpdate) {
        setMessages(prev => prev.map(msg => {
          if (msg.is_own_message) return msg;
          const participant = participants.find(p => p.user_id === msg.sender_id);
          return {
            ...msg,
            sender_name: participant?.full_name || msg.sender_name
          };
        }));
      }
    }
  }, [participants]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_conversation_participants', { conv_id: conversation.conversation_id });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const getSenderName = (senderId: string): string => {
    if (senderId === user?.id) return 'You';

    if (conversation.is_group) {
      const participant = participants.find(p => p.user_id === senderId);
      return participant?.full_name || 'Unknown';
    }

    return conversation.other_user_name || 'Unknown';
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
        sender_name: getSenderName(msg.sender_id),
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

    const messageContent = newMessage.trim();

    try {
      setSending(true);

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversation.conversation_id,
          sender_id: user?.id,
          content: messageContent
        });

      if (error) throw error;

      // Send notification (fire-and-forget)
      if (user) {
        sendChatNotification({
          type: conversation.is_group ? 'group_message' : 'direct_message',
          conversationId: conversation.conversation_id,
          conversationName: conversation.conversation_name || undefined,
          senderId: user.id,
          senderName: profile?.full_name || 'Someone',
          messageContent,
          isGroup: conversation.is_group || false,
        });
      }

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
      const fileMessageContent = `Sent a file: ${file.name}`;
      const { error: messageError } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversation.conversation_id,
          sender_id: user?.id,
          content: fileMessageContent,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size
        });

      if (messageError) throw messageError;

      // Send notification (fire-and-forget)
      if (user) {
        sendChatNotification({
          type: conversation.is_group ? 'group_message' : 'direct_message',
          conversationId: conversation.conversation_id,
          conversationName: conversation.conversation_name || undefined,
          senderId: user.id,
          senderName: profile?.full_name || 'Someone',
          messageContent: fileMessageContent,
          isGroup: conversation.is_group || false,
        });
      }

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
          {conversation.is_group ? (
            <Users className="w-5 h-5 text-blue-600" />
          ) : (
            <div
              className={`w-2 h-2 rounded-full ${
                conversation.other_user_status === 'online'
                  ? 'bg-green-500'
                  : conversation.other_user_status === 'away'
                  ? 'bg-yellow-500'
                  : 'bg-gray-300'
              }`}
            />
          )}
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">
              {conversation.is_group ? conversation.conversation_name : conversation.other_user_name}
            </h2>
            <p className="text-xs text-gray-500">
              {conversation.is_group
                ? `${conversation.participant_count} participants`
                : conversation.other_user_status === 'online'
                ? 'Online'
                : 'Offline'}
            </p>
          </div>
        </div>

        {/* Show participants button for group chats */}
        {conversation.is_group && (
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showParticipants ? 'Hide' : 'Show'} Participants
          </button>
        )}
      </div>

      {/* Participants list (for group chats) */}
      {conversation.is_group && showParticipants && (
        <div className="bg-gray-50 border-b px-4 py-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Participants:</h3>
          <div className="flex flex-wrap gap-2">
            {participants.map((participant) => (
              <div
                key={participant.user_id}
                className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-gray-200"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    participant.status === 'online'
                      ? 'bg-green-500'
                      : participant.status === 'away'
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                />
                <span className="text-sm text-gray-900">{participant.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {/* Sender name for group chats (not for own messages) */}
                {conversation.is_group && !message.is_own_message && (
                  <p className="text-xs font-semibold mb-1 text-gray-700">
                    {message.sender_name}
                  </p>
                )}

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
