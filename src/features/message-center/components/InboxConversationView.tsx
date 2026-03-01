/**
 * InboxConversationView - Shows full conversation thread inline within the Unified Inbox
 * Supports: Team Chat, SMS, Ticket Chat, Announcements
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, Users, User, MessageSquare, Ticket, Megaphone, ExternalLink, Phone, Check, CheckCheck, CornerDownRight, Search, X, ChevronUp, ChevronDown, Paperclip, AlertTriangle, Mic } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import { useReadReceipts } from '../hooks/useReadReceipts';
import { useMessageReactions } from '../hooks/useMessageReactions';
import { usePinnedMessages } from '../hooks/usePinnedMessages';
import { uploadAttachment, isImageFile, isAudioFile, formatFileSize } from '../services/attachmentService';
import { MessageAttachmentPicker } from './MessageAttachmentPicker';
import { VoiceMessageRecorder, VoiceMessagePlayer } from './VoiceMessageRecorder';
import { ReplyPreview, QuotedMessage } from './QuoteReply';
import { PinnedMessagesBar } from './PinnedMessagesBar';
import { MessageActionMenu } from './MessageActionMenu';
import { ReactionDisplay } from './ReactionDisplay';
import type { ReplyTarget } from './QuoteReply';
import type { UnifiedMessage, Conversation, TeamChatConversation, TicketChatData, CompanyMessage } from '../types';

interface InboxConversationViewProps {
  message: UnifiedMessage;
  onBack: () => void;
  onNavigateToEntity?: (entityType: string, params: Record<string, string>) => void;
}

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  is_own: boolean;
  created_at: string;
  type?: 'text' | 'system';
  reply_to_id?: string | null;
  reply_to_sender_name?: string;
  reply_to_content?: string;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  priority?: 'normal' | 'urgent' | null;
}

export function InboxConversationView({ message, onBack, onNavigateToEntity }: InboxConversationViewProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // For SMS conversations, use the existing hook
  const conversationId = message.type === 'sms' ? (message.rawData as Conversation).id : null;
  const { data: smsMessages } = useMessages(conversationId);
  const sendSmsMutation = useSendMessage();

  // Read receipts for team chat
  const teamChatConversationId = message.type === 'team_chat'
    ? (message.rawData as TeamChatConversation).conversation_id
    : null;
  const ownMessageIds = useMemo(
    () => chatMessages.filter(m => m.is_own).map(m => m.id),
    [chatMessages]
  );
  const { readStatusMap } = useReadReceipts(teamChatConversationId, ownMessageIds);

  // Pinned messages
  const conversationRef = useMemo(() => {
    if (message.type === 'sms') return `sms:${(message.rawData as Conversation).id}`;
    if (message.type === 'team_chat') return `team_chat:${(message.rawData as TeamChatConversation).conversation_id}`;
    if (message.type === 'ticket_chat') return `ticket_chat:${(message.rawData as TicketChatData).request_id}`;
    return null;
  }, [message]);
  const { pinnedMessages, pinnedMessageIds, togglePin } = usePinnedMessages(conversationRef);

  // Reactions
  const reactionType = useMemo(() => {
    if (message.type === 'sms') return 'sms';
    if (message.type === 'team_chat' || message.type === 'team_announcement') return 'team_chat';
    return 'ticket_chat';
  }, [message.type]);
  const displayMessages = useMemo(() => {
    if (message.type === 'sms') {
      return (smsMessages || []).map(m => ({
        id: m.id,
        content: m.body,
        sender_id: m.from_contact_id || m.from_user_id || '',
        sender_name: m.direction === 'inbound' ? message.title : (profile?.full_name || 'You'),
        is_own: m.direction === 'outbound',
        created_at: m.created_at,
        reply_to_id: null,
        reply_to_sender_name: undefined,
        reply_to_content: undefined,
      } as ChatMessage));
    }
    return chatMessages;
  }, [message.type, message.title, smsMessages, chatMessages, profile?.full_name]);
  const reactionMessageIds = useMemo(() => displayMessages.map(m => m.id), [displayMessages]);
  const { reactionsMap, toggleReaction } = useMessageReactions(reactionType, reactionMessageIds);

  // Action menu state (long-press / right-click)
  const [actionMenu, setActionMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
    messageContent: string;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    setActionMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      messageId: msg.id,
      messageContent: msg.content,
    });
  }, []);

  // Long-press support for mobile
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTouchRef = useRef<{ x: number; y: number } | null>(null);

  const handleMessageTouchStart = useCallback((e: React.TouchEvent, msg: ChatMessage) => {
    const touch = e.touches[0];
    longPressTouchRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      if (longPressTouchRef.current) {
        setActionMenu({
          isOpen: true,
          position: { x: longPressTouchRef.current.x, y: longPressTouchRef.current.y },
          messageId: msg.id,
          messageContent: msg.content,
        });
        longPressTouchRef.current = null;
      }
    }, 500);
  }, []);

  const handleMessageTouchMove = useCallback((e: React.TouchEvent) => {
    if (!longPressTouchRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - longPressTouchRef.current.x);
    const dy = Math.abs(touch.clientY - longPressTouchRef.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTouchRef.current = null;
    }
  }, []);

  const handleMessageTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTouchRef.current = null;
  }, []);

  // Build content map for pinned messages bar
  const messageContentMap = useMemo(() => {
    const map: Record<string, string> = {};
    const allMessages = message.type === 'sms'
      ? (smsMessages || []).map(m => ({ id: m.id, content: m.body }))
      : chatMessages.map(m => ({ id: m.id, content: m.content }));
    for (const m of allMessages) {
      map[m.id] = m.content;
    }
    return map;
  }, [chatMessages, smsMessages, message.type]);

  // In-conversation search: compute matching message IDs
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const allMsgs = message.type === 'sms'
      ? (smsMessages || []).map(m => ({ id: m.id, content: m.body }))
      : chatMessages.map(m => ({ id: m.id, content: m.content }));
    return allMsgs.filter(m => m.content.toLowerCase().includes(query)).map(m => m.id);
  }, [searchQuery, chatMessages, smsMessages, message.type]);

  // Reset active match index when matches change
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchMatches.length]);

  // Scroll to active match
  useEffect(() => {
    if (searchMatches.length > 0 && searchOpen) {
      const matchId = searchMatches[activeMatchIndex];
      document.getElementById(`msg-${matchId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeMatchIndex, searchMatches, searchOpen]);

  // Focus search input when search opens
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const searchMatchSet = useMemo(() => new Set(searchMatches), [searchMatches]);

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

  // Fetch phone number for 1:1 team chat click-to-call
  useEffect(() => {
    if (message.type === 'team_chat') {
      const chatData = message.rawData as TeamChatConversation;
      if (!chatData.is_group && chatData.other_user_id) {
        supabase
          .from('user_profiles')
          .select('phone')
          .eq('id', chatData.other_user_id)
          .single()
          .then(({ data }) => {
            if (data?.phone) setContactPhone(data.phone);
          });
      }
    }
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
      .select('id, content, sender_id, created_at, reply_to_message_id, file_url, file_name, file_type, file_size, priority')
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

    // Build a lookup for reply-to references
    const msgMap = new Map(messages?.map(m => [m.id, m]) || []);

    setChatMessages(messages?.map(m => {
      const replyParent = m.reply_to_message_id ? msgMap.get(m.reply_to_message_id) : null;
      return {
        id: m.id,
        content: m.content,
        sender_id: m.sender_id,
        sender_name: nameMap.get(m.sender_id) || 'Unknown',
        is_own: m.sender_id === user?.id,
        created_at: m.created_at,
        reply_to_id: m.reply_to_message_id || null,
        reply_to_sender_name: replyParent ? (nameMap.get(replyParent.sender_id) || 'Unknown') : undefined,
        reply_to_content: replyParent?.content,
        file_url: m.file_url,
        file_name: m.file_name,
        file_type: m.file_type,
        file_size: m.file_size,
        priority: m.priority,
      };
    }) || []);
  };

  const loadTicketMessages = async () => {
    const ticketData = message.rawData as TicketChatData;
    const { data: notes, error } = await supabase
      .from('request_notes')
      .select('id, content, user_id, created_at, note_type, reply_to_note_id, file_url, file_name, file_type')
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

    // Build a lookup for reply-to references
    const noteMap = new Map(notes?.map(n => [n.id, n]) || []);

    setChatMessages(notes?.map(n => {
      const replyParent = n.reply_to_note_id ? noteMap.get(n.reply_to_note_id) : null;
      return {
        id: n.id,
        content: n.content,
        sender_id: n.user_id || '',
        sender_name: nameMap.get(n.user_id) || 'System',
        is_own: n.user_id === user?.id,
        created_at: n.created_at,
        reply_to_id: n.reply_to_note_id || null,
        reply_to_sender_name: replyParent ? (nameMap.get(replyParent.user_id) || 'System') : undefined,
        reply_to_content: replyParent?.content,
        file_url: n.file_url,
        file_name: n.file_name,
        file_type: n.file_type,
      };
    }) || []);
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

  // Handle tapping reply on a message bubble
  const handleReplyToMessage = useCallback((msg: ChatMessage) => {
    const msgType = message.type === 'team_chat' ? 'team_chat' : 'ticket_chat';
    setReplyTarget({
      id: msg.id,
      senderName: msg.is_own ? 'You' : msg.sender_name,
      content: msg.content,
      messageType: msgType as 'team_chat' | 'ticket_chat',
    });
    textareaRef.current?.focus();
  }, [message.type]);

  // Handle file selected from attachment picker
  const handleFileSelected = useCallback((file: File) => {
    setAttachmentFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
  }, []);

  // Handle voice message send
  const handleVoiceSend = useCallback(async (audioUrl: string, _durationSeconds: number, transcript?: string) => {
    if (!user?.id) return;
    setIsSending(true);
    const content = transcript
      ? `🎤 Voice message\n\n${transcript}`
      : '🎤 Voice message';
    try {
      switch (message.type) {
        case 'team_chat': {
          const chatData = message.rawData as TeamChatConversation;
          await supabase.from('direct_messages').insert({
            conversation_id: chatData.conversation_id,
            sender_id: user.id,
            content,
            file_url: audioUrl,
            file_name: 'voice-message.webm',
            file_type: 'audio/webm',
          });
          await loadTeamChatMessages();
          break;
        }
        case 'ticket_chat': {
          const ticketData = message.rawData as TicketChatData;
          await supabase.from('request_notes').insert({
            request_id: ticketData.request_id,
            user_id: user.id,
            content,
            note_type: 'comment',
            file_url: audioUrl,
            file_name: 'voice-message.webm',
            file_type: 'audio/webm',
          });
          await loadTicketMessages();
          break;
        }
      }
      setIsVoiceMode(false);
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    } catch (error) {
      console.error('Failed to send voice message:', error);
    } finally {
      setIsSending(false);
    }
  }, [user?.id, message, queryClient]);

  // Send reply based on message type
  const handleSendReply = useCallback(async () => {
    if ((!replyText.trim() && !attachmentFile) || isSending || !user?.id) return;

    setIsSending(true);
    try {
      // Upload attachment if present
      let fileData: { file_url: string; file_name: string; file_type: string; file_size: number } | null = null;
      if (attachmentFile) {
        setIsUploading(true);
        const convRef = conversationRef || 'unknown';
        const msgType = message.type === 'sms' ? 'sms' : message.type === 'team_chat' ? 'team_chat' : 'ticket_chat';
        const result = await uploadAttachment(attachmentFile, msgType as 'sms' | 'team_chat' | 'ticket_chat', convRef);
        fileData = { file_url: result.publicUrl, file_name: result.fileName, file_type: result.fileType, file_size: result.fileSize };
        setIsUploading(false);
      }

      switch (message.type) {
        case 'sms': {
          const conv = message.rawData as Conversation;
          await sendSmsMutation.mutateAsync({
            conversation_id: conv.id,
            channel: 'sms',
            direction: 'outbound',
            body: replyText || (fileData ? `📎 ${fileData.file_name}` : ''),
            to_phone: conv.contact?.phone_primary,
            from_user_id: user.id,
            ...(fileData ? { media_url: fileData.file_url } : {}),
          });
          break;
        }

        case 'team_chat': {
          const chatData = message.rawData as TeamChatConversation;
          await supabase.from('direct_messages').insert({
            conversation_id: chatData.conversation_id,
            sender_id: user.id,
            content: replyText || (fileData ? `📎 ${fileData.file_name}` : ''),
            ...(replyTarget?.messageType === 'team_chat' && replyTarget?.id
              ? { reply_to_message_id: replyTarget.id }
              : {}),
            ...(fileData ? { file_url: fileData.file_url, file_name: fileData.file_name, file_type: fileData.file_type, file_size: fileData.file_size } : {}),
          });
          await loadTeamChatMessages();
          break;
        }

        case 'ticket_chat': {
          const ticketData = message.rawData as TicketChatData;
          await supabase.from('request_notes').insert({
            request_id: ticketData.request_id,
            user_id: user.id,
            content: replyText || (fileData ? `📎 ${fileData.file_name}` : ''),
            note_type: 'comment',
            ...(replyTarget?.messageType === 'ticket_chat' && replyTarget?.id
              ? { reply_to_note_id: replyTarget.id }
              : {}),
            ...(fileData ? { file_url: fileData.file_url, file_name: fileData.file_name, file_type: fileData.file_type } : {}),
          });
          await loadTicketMessages();
          break;
        }
      }

      setReplyText('');
      setReplyTarget(null);
      clearAttachment();
      // Invalidate inbox list so conversation moves to top
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    } catch (error) {
      console.error('Failed to send reply:', error);
      setIsUploading(false);
    } finally {
      setIsSending(false);
    }
  }, [replyText, isSending, user?.id, message, sendSmsMutation, replyTarget, attachmentFile, conversationRef, clearAttachment, queryClient]);

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

          {/* Search toggle */}
          <button
            onClick={() => {
              setSearchOpen(prev => !prev);
              if (searchOpen) { setSearchQuery(''); }
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              searchOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
            aria-label="Search messages"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Click-to-call for SMS conversations */}
          {message.type === 'sms' && (message.rawData as Conversation).contact?.phone_primary && (
            <a
              href={`tel:${(message.rawData as Conversation).contact!.phone_primary}`}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Call contact"
            >
              <Phone className="w-5 h-5" />
            </a>
          )}

          {/* Click-to-call for 1:1 team chats */}
          {message.type === 'team_chat' && contactPhone && !(message.rawData as TeamChatConversation).is_group && (
            <a
              href={`tel:${contactPhone}`}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Call contact"
            >
              <Phone className="w-5 h-5" />
            </a>
          )}

          {/* Navigate to source entity */}
          {message.type === 'ticket_chat' && onNavigateToEntity && (
            <button
              onClick={() => onNavigateToEntity('ticket', { id: message.actionId })}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Go to Ticket
            </button>
          )}
        </div>
      </header>

      {/* Search Bar */}
      {searchOpen && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in conversation..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchMatches.length > 0) {
                setActiveMatchIndex(prev => (prev + 1) % searchMatches.length);
              } else if (e.key === 'Escape') {
                setSearchOpen(false);
                setSearchQuery('');
              }
            }}
          />
          {searchQuery && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {searchMatches.length > 0
                ? `${activeMatchIndex + 1} of ${searchMatches.length}`
                : 'No results'}
            </span>
          )}
          {searchMatches.length > 1 && (
            <>
              <button
                onClick={() => setActiveMatchIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                aria-label="Previous match"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveMatchIndex(prev => (prev + 1) % searchMatches.length)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                aria-label="Next match"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned Messages Bar */}
      {message.type !== 'team_announcement' && (
        <PinnedMessagesBar
          pinnedMessages={pinnedMessages}
          messageContentMap={messageContentMap}
          onJumpToMessage={(msgId) => {
            document.getElementById(`msg-${msgId}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }}
          onUnpin={(msgId, msgType) => togglePin({ messageId: msgId, messageType: msgType })}
        />
      )}

      {/* Action Menu (long-press / right-click) */}
      {actionMenu && (
        <MessageActionMenu
          isOpen={actionMenu.isOpen}
          onClose={() => setActionMenu(null)}
          position={actionMenu.position}
          messageType={message.type as 'sms' | 'team_chat' | 'ticket_chat' | 'team_announcement'}
          isPinned={pinnedMessageIds.has(actionMenu.messageId)}
          onReaction={(emoji) => toggleReaction({ messageId: actionMenu.messageId, emoji })}
          onReply={() => {
            const msg = displayMessages.find(m => m.id === actionMenu.messageId);
            if (msg) handleReplyToMessage(msg as ChatMessage);
          }}
          onPin={() => {
            togglePin({
              messageId: actionMenu.messageId,
              messageType: message.type === 'sms' ? 'sms' : message.type === 'team_chat' ? 'team_chat' : 'ticket_chat',
            });
          }}
          onCopy={() => {
            navigator.clipboard.writeText(actionMenu.messageContent);
          }}
        />
      )}

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
          displayMessages.map((msg) => {
            const canQuoteReply = message.type === 'team_chat' || message.type === 'ticket_chat';
            const isSearchMatch = searchQuery && searchMatchSet.has(msg.id);
            const isActiveMatch = isSearchMatch && searchMatches[activeMatchIndex] === msg.id;
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                onContextMenu={(e) => handleContextMenu(e, msg as ChatMessage)}
                onTouchStart={(e) => handleMessageTouchStart(e, msg as ChatMessage)}
                onTouchMove={handleMessageTouchMove}
                onTouchEnd={handleMessageTouchEnd}
                className={cn(
                  'flex flex-col max-w-[85%] group',
                  msg.is_own ? 'ml-auto items-end' : 'mr-auto items-start',
                  isActiveMatch && 'ring-2 ring-blue-400 rounded-2xl',
                  isSearchMatch && !isActiveMatch && 'ring-1 ring-yellow-300 rounded-2xl'
                )}
              >
                {!msg.is_own && (
                  <span className="text-xs text-gray-500 mb-1 px-1">{msg.sender_name}</span>
                )}
                <div className="flex items-center gap-1">
                  {/* Reply button (left side for own messages) */}
                  {canQuoteReply && msg.is_own && (
                    <button
                      type="button"
                      onClick={() => handleReplyToMessage(msg)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                      title="Reply"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div
                    className={cn(
                      'px-4 py-2.5 rounded-2xl',
                      msg.is_own
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm',
                      (msg as ChatMessage).priority === 'urgent' && 'border-l-4 border-red-500'
                    )}
                  >
                    {/* Priority badge */}
                    {(msg as ChatMessage).priority === 'urgent' && (
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className={cn('text-xs font-bold', msg.is_own ? 'text-red-200' : 'text-red-600')}>URGENT</span>
                      </div>
                    )}
                    {/* Quoted parent message */}
                    {msg.reply_to_id && msg.reply_to_content && (
                      <QuotedMessage
                        senderName={msg.reply_to_sender_name || 'Unknown'}
                        content={msg.reply_to_content}
                        isOutbound={msg.is_own}
                        onClick={() => {
                          document.getElementById(`msg-${msg.reply_to_id}`)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                      />
                    )}
                    {/* File attachment */}
                    {(msg as ChatMessage).file_url && (
                      <div className="mb-1">
                        {isAudioFile((msg as ChatMessage).file_type || '') ? (
                          <VoiceMessagePlayer
                            audioUrl={(msg as ChatMessage).file_url!}
                            variant={msg.is_own ? 'outbound' : 'inbound'}
                          />
                        ) : isImageFile((msg as ChatMessage).file_type || '') ? (
                          <a href={(msg as ChatMessage).file_url!} target="_blank" rel="noopener noreferrer">
                            <img
                              src={(msg as ChatMessage).file_url!}
                              alt={(msg as ChatMessage).file_name || 'Image'}
                              className="max-w-[240px] max-h-[200px] rounded-lg object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={(msg as ChatMessage).file_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                              msg.is_own ? 'bg-blue-500/30 text-white hover:bg-blue-500/50' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            )}
                          >
                            <Paperclip className="w-4 h-4 shrink-0" />
                            <span className="truncate">{(msg as ChatMessage).file_name || 'Download file'}</span>
                            {(msg as ChatMessage).file_size && (
                              <span className="text-xs opacity-70 shrink-0">{formatFileSize((msg as ChatMessage).file_size!)}</span>
                            )}
                          </a>
                        )}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {isSearchMatch ? highlightText(msg.content, searchQuery) : msg.content}
                    </p>
                  </div>
                  {/* Reply button (right side for other messages) */}
                  {canQuoteReply && !msg.is_own && (
                    <button
                      type="button"
                      onClick={() => handleReplyToMessage(msg)}
                      className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                      title="Reply"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Reactions */}
                <ReactionDisplay
                  reactions={reactionsMap[msg.id] || []}
                  onToggle={(emoji) => toggleReaction({ messageId: msg.id, emoji })}
                  isOwnMessage={msg.is_own}
                />
                <span className="text-xs text-gray-400 mt-1 px-1 flex items-center gap-1">
                  {formatTime(msg.created_at)}
                  {msg.is_own && message.type === 'team_chat' && (
                    readStatusMap[msg.id] === 'read'
                      ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" aria-label="Read" />
                      : <Check className="w-3.5 h-3.5 text-gray-400" aria-label="Sent" />
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Composer */}
      {canReply && (
        <div className="bg-white border-t border-gray-200 sticky bottom-0 z-10">
          {/* Reply-to preview */}
          {replyTarget && (
            <ReplyPreview
              senderName={replyTarget.senderName}
              content={replyTarget.content}
              onClear={() => setReplyTarget(null)}
            />
          )}

          {/* Attachment preview */}
          {attachmentFile && (
            <div className="px-4 pt-2 flex items-center gap-2">
              {attachmentPreview ? (
                <img src={attachmentPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 truncate max-w-[200px]">{attachmentFile.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(attachmentFile.size)}</span>
                </div>
              )}
              <button
                onClick={clearAttachment}
                className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="p-4">
            {/* Voice recorder replaces text input when in voice mode or no text */}
            {isVoiceMode ? (
              <VoiceMessageRecorder
                onSend={handleVoiceSend}
                disabled={isSending}
                bucket="chat-files"
                autoStart
                onCancel={() => setIsVoiceMode(false)}
              />
            ) : (
              <div className="flex items-end gap-2">
                {/* Attachment button */}
                <button
                  type="button"
                  onClick={() => setShowAttachmentPicker(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <textarea
                  ref={textareaRef}
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

                {/* Show mic when text is empty, send when text has content (WhatsApp pattern) */}
                {!replyText.trim() && !attachmentFile ? (
                  <button
                    type="button"
                    onClick={() => setIsVoiceMode(true)}
                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    title="Record voice message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendReply}
                    disabled={(!replyText.trim() && !attachmentFile) || isSending || isUploading}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attachment Picker Modal */}
      <MessageAttachmentPicker
        isOpen={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onFileSelected={handleFileSelected}
      />
    </div>
  );
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-300 text-inherit rounded-sm px-0.5">{part}</mark>
      : part
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
