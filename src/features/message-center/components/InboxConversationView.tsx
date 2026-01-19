/**
 * InboxConversationView - Shows full conversation thread inline within the Unified Inbox
 * Supports: Team Chat, SMS, Ticket Chat, Announcements
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Users, User, MessageSquare, Ticket, Megaphone } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import type { UnifiedMessage, Conversation, TeamChatConversation, TicketChatData, CompanyMessage } from '../types';

interface InboxConversationViewProps {
  message: UnifiedMessage;
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  is_own: boolean;
  created_at: string;
  type?: 'text' | 'system';
}

export function InboxConversationView({ message, onBack }: InboxConversationViewProps) {
  const { user, profile } = useAuth();
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // For SMS conversations, use the existing hook
  const conversationId = message.type === 'sms' ? (message.rawData as Conversation).id : null;
  const { data: smsMessages } = useMessages(conversationId);
  const sendSmsMutation = useSendMessage();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, smsMessages]);

  // Load messages based on type
  useEffect(() => {
    if (message.type === 'sms') {
      // SMS messages are loaded by useMessages hook
      setIsLoading(false);
      return;
    }

    loadMessages();
  }, [message]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      switch (message.type) {
        case 'team_chat':
          await loadTeamChatMessages();
          break;
        case 'ticket_chat':
          await loadTicketMessages();
          break;
        case 'team_announcement':
          await loadAnnouncementDetails();
          break;
        default:
          setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamChatMessages = async () => {
    const chatData = message.rawData as TeamChatConversation;
    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', chatData.conversation_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get sender names
    const senderIds = [...new Set(messages?.map(m => m.sender_id) || [])];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', senderIds);

    const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    setChatMessages(messages?.map(m => ({
      id: m.id,
      content: m.content,
      sender_id: m.sender_id,
      sender_name: nameMap.get(m.sender_id) || 'Unknown',
      is_own: m.sender_id === user?.id,
      created_at: m.created_at,
    })) || []);
  };

  const loadTicketMessages = async () => {
    const ticketData = message.rawData as TicketChatData;
    const { data: notes, error } = await supabase
      .from('request_notes')
      .select('id, content, user_id, created_at, note_type')
      .eq('request_id', ticketData.request_id)
      .eq('note_type', 'comment')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get sender names
    const userIds = [...new Set(notes?.map(n => n.user_id).filter(Boolean) || [])];
    const { data: profiles } = userIds.length > 0 ? await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', userIds) : { data: [] };

    const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    setChatMessages(notes?.map(n => ({
      id: n.id,
      content: n.content,
      sender_id: n.user_id || '',
      sender_name: nameMap.get(n.user_id) || 'System',
      is_own: n.user_id === user?.id,
      created_at: n.created_at,
    })) || []);
  };

  const loadAnnouncementDetails = async () => {
    const announcement = message.rawData as CompanyMessage;
    setChatMessages([{
      id: announcement.id,
      content: announcement.body,
      sender_id: announcement.created_by,
      sender_name: 'Company Announcement',
      is_own: false,
      created_at: announcement.published_at || announcement.created_at,
      type: 'system',
    }]);
  };

  // Send reply based on message type
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || isSending || !user?.id) return;

    setIsSending(true);
    try {
      switch (message.type) {
        case 'sms': {
          const conv = message.rawData as Conversation;
          await sendSmsMutation.mutateAsync({
            conversation_id: conv.id,
            channel: 'sms',
            direction: 'outbound',
            body: replyText,
            to_phone: conv.contact?.phone_primary,
            from_user_id: user.id,
          });
          break;
        }

        case 'team_chat': {
          const chatData = message.rawData as TeamChatConversation;
          await supabase.from('direct_messages').insert({
            conversation_id: chatData.conversation_id,
            sender_id: user.id,
            content: replyText,
          });
          // Reload messages
          await loadTeamChatMessages();
          break;
        }

        case 'ticket_chat': {
          const ticketData = message.rawData as TicketChatData;
          await supabase.from('request_notes').insert({
            request_id: ticketData.request_id,
            user_id: user.id,
            content: replyText,
            note_type: 'comment',
          });
          // Reload messages
          await loadTicketMessages();
          break;
        }
      }

      setReplyText('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setIsSending(false);
    }
  }, [replyText, isSending, user?.id, message, sendSmsMutation]);

  // Get header info
  const getHeaderInfo = () => {
    switch (message.type) {
      case 'sms':
        return {
          icon: MessageSquare,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          title: message.title,
          subtitle: 'SMS Conversation',
        };
      case 'team_chat': {
        const chatData = message.rawData as TeamChatConversation;
        return {
          icon: chatData.is_group ? Users : User,
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          title: message.title,
          subtitle: chatData.is_group ? `${chatData.participant_count} members` : 'Direct Message',
        };
      }
      case 'ticket_chat':
        return {
          icon: Ticket,
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
          title: message.title,
          subtitle: 'Ticket Chat',
        };
      case 'team_announcement':
        return {
          icon: Megaphone,
          iconBg: 'bg-purple-100',
          iconColor: 'text-purple-600',
          title: message.title,
          subtitle: 'Announcement',
        };
      default:
        return {
          icon: MessageSquare,
          iconBg: 'bg-gray-100',
          iconColor: 'text-gray-600',
          title: message.title,
          subtitle: '',
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const HeaderIcon = headerInfo.icon;
  const canReply = ['sms', 'team_chat', 'ticket_chat'].includes(message.type);
  const displayMessages = message.type === 'sms'
    ? (smsMessages || []).map(m => ({
        id: m.id,
        content: m.body,
        sender_id: m.from_contact_id || m.from_user_id || '',
        sender_name: m.direction === 'inbound' ? message.title : (profile?.full_name || 'You'),
        is_own: m.direction === 'outbound',
        created_at: m.created_at,
      }))
    : chatMessages;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', headerInfo.iconBg)}>
            <HeaderIcon className={cn('w-5 h-5', headerInfo.iconColor)} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{headerInfo.title}</h1>
            {headerInfo.subtitle && (
              <p className="text-xs text-gray-500">{headerInfo.subtitle}</p>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No messages yet
          </div>
        ) : (
          displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%]',
                msg.is_own ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              {!msg.is_own && (
                <span className="text-xs text-gray-500 mb-1 px-1">{msg.sender_name}</span>
              )}
              <div
                className={cn(
                  'px-4 py-2.5 rounded-2xl',
                  msg.is_own
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
              <span className="text-xs text-gray-400 mt-1 px-1">
                {formatTime(msg.created_at)}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Composer */}
      {canReply && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent max-h-32"
              style={{ minHeight: '48px' }}
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || isSending}
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default InboxConversationView;
