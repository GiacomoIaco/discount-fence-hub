/**
 * Hook to get unified messages across all sources:
 * - SMS conversations (mc_conversations)
 * - Team announcements (company_messages)
 * - System notifications (mc_system_notifications)
 *
 * Returns a single sorted array of UnifiedMessage items for the mobile inbox.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  UnifiedMessage,
  UnifiedInboxFilter,
  Conversation,
  CompanyMessage,
  SystemNotification,
  NotificationType,
  TeamChatConversation,
  TicketChatData,
} from '../types';

interface UseUnifiedMessagesOptions {
  userId?: string;
  filter?: UnifiedInboxFilter;
  limit?: number;
}

interface UnifiedMessagesResult {
  messages: UnifiedMessage[];
  counts: {
    all: number;
    sms: number;
    team: number;
    tickets: number;
    alerts: number;
  };
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => void;
}

// Maps notification types to action types for deep linking
function getNotificationActionType(notifType: NotificationType): UnifiedMessage['actionType'] {
  switch (notifType) {
    case 'quote_viewed':
    case 'quote_signed':
    case 'quote_expired':
      return 'quote';
    case 'invoice_paid':
    case 'invoice_overdue':
    case 'invoice_partial':
      return 'invoice';
    case 'job_status_change':
    case 'job_scheduled':
    case 'job_completed':
      return 'job';
    case 'booking_request':
      return 'request';
    case 'message_received':
      return 'conversation';
    default:
      return 'generic';
  }
}

// Get the action ID for navigation from notification
function getNotificationActionId(notif: SystemNotification): string {
  if (notif.quote_id) return notif.quote_id;
  if (notif.invoice_id) return notif.invoice_id;
  if (notif.job_id) return notif.job_id;
  if (notif.project_id) return notif.project_id;
  if (notif.conversation_id) return notif.conversation_id;
  return notif.id;
}

// Transform SMS conversation to UnifiedMessage
function conversationToUnified(conv: Conversation): UnifiedMessage {
  const contactName = conv.contact?.display_name || conv.title || 'Unknown';
  const preview = conv.last_message_preview || 'No messages yet';

  return {
    id: `sms-${conv.id}`,
    type: 'sms',
    title: contactName,
    preview: preview.length > 80 ? preview.substring(0, 80) + '...' : preview,
    timestamp: new Date(conv.last_message_at || conv.updated_at),
    isUnread: conv.unread_count > 0,
    icon: 'MessageSquare',
    iconColor: 'text-blue-600',
    iconBgColor: 'bg-blue-100',
    actionType: 'conversation',
    actionId: conv.id,
    rawData: conv,
  };
}

// Transform announcement to UnifiedMessage
function announcementToUnified(
  msg: CompanyMessage & { isRead?: boolean }
): UnifiedMessage {
  const preview = msg.body?.length > 80 ? msg.body.substring(0, 80) + '...' : msg.body;

  return {
    id: `announcement-${msg.id}`,
    type: 'team_announcement',
    title: msg.title || 'Company Update',
    preview,
    timestamp: new Date(msg.published_at || msg.created_at),
    isUnread: !msg.isRead,
    icon: 'Megaphone',
    iconColor: 'text-purple-600',
    iconBgColor: 'bg-purple-100',
    actionType: 'announcement',
    actionId: msg.id,
    rawData: msg,
  };
}

// Transform notification to UnifiedMessage
function notificationToUnified(notif: SystemNotification): UnifiedMessage {
  const preview = notif.body?.length > 80 ? notif.body.substring(0, 80) + '...' : notif.body;

  return {
    id: `notif-${notif.id}`,
    type: 'system_notification',
    title: notif.title,
    preview,
    timestamp: new Date(notif.created_at),
    isUnread: !notif.is_read,
    icon: 'Bell',
    iconColor: 'text-amber-600',
    iconBgColor: 'bg-amber-100',
    actionType: getNotificationActionType(notif.notification_type),
    actionId: getNotificationActionId(notif),
    rawData: notif,
  };
}

// Transform team chat conversation to UnifiedMessage
function teamChatToUnified(chat: TeamChatConversation): UnifiedMessage {
  // For group chats, use group name; for 1:1 use other user's name
  const title = chat.is_group
    ? (chat.conversation_name || 'Group Chat')
    : (chat.other_user_name || 'Unknown');

  const preview = chat.last_message
    ? (chat.last_message.length > 80 ? chat.last_message.substring(0, 80) + '...' : chat.last_message)
    : 'No messages yet';

  return {
    id: `team-chat-${chat.conversation_id}`,
    type: 'team_chat',
    title,
    preview,
    timestamp: chat.last_message_at ? new Date(chat.last_message_at) : new Date(),
    isUnread: chat.unread_count > 0,
    icon: chat.is_group ? 'Users' : 'User',
    iconColor: 'text-green-600',
    iconBgColor: 'bg-green-100',
    actionType: 'team_chat',
    actionId: chat.conversation_id,
    rawData: chat,
  };
}

// Transform ticket chat to UnifiedMessage
function ticketChatToUnified(ticket: TicketChatData): UnifiedMessage {
  const preview = ticket.last_note_content
    ? (ticket.last_note_content.length > 80 ? ticket.last_note_content.substring(0, 80) + '...' : ticket.last_note_content)
    : 'No messages yet';

  // Format title with ticket type prefix
  const typeLabel = ticket.request_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const title = `${typeLabel}: ${ticket.request_title}`;

  return {
    id: `ticket-${ticket.request_id}`,
    type: 'ticket_chat',
    title,
    preview: ticket.last_note_by_name ? `${ticket.last_note_by_name}: ${preview}` : preview,
    timestamp: new Date(ticket.last_note_at),
    isUnread: ticket.unread_count > 0,
    icon: 'Ticket',
    iconColor: 'text-orange-600',
    iconBgColor: 'bg-orange-100',
    actionType: 'ticket',
    actionId: ticket.request_id,
    rawData: ticket,
  };
}

// Fetch tickets with recent chat activity for a user
async function fetchUserTickets(userId: string, limit: number): Promise<TicketChatData[]> {
  // Step 1: Get requests where user is submitter or assignee
  const { data: directRequests } = await supabase
    .from('requests')
    .select('id, title, request_type, submitter_id, assigned_to')
    .or(`submitter_id.eq.${userId},assigned_to.eq.${userId}`)
    .in('stage', ['new', 'in_progress', 'pending', 'waiting_on_client']) // Open tickets only
    .order('updated_at', { ascending: false })
    .limit(limit);

  // Step 2: Get watched request IDs
  const { data: watchedRequests } = await supabase
    .from('request_watchers')
    .select('request_id')
    .eq('user_id', userId);

  // Combine all request IDs
  const requestIds = new Set<string>();
  const requestMap = new Map<string, { title: string; type: string; role: 'submitter' | 'assignee' | 'watcher' }>();

  directRequests?.forEach((req) => {
    requestIds.add(req.id);
    const role = req.submitter_id === userId ? 'submitter' : 'assignee';
    requestMap.set(req.id, { title: req.title, type: req.request_type, role });
  });

  watchedRequests?.forEach((w) => {
    if (!requestIds.has(w.request_id)) {
      requestIds.add(w.request_id);
    }
    // Update role to watcher if not already submitter/assignee
    if (!requestMap.has(w.request_id)) {
      requestMap.set(w.request_id, { title: '', type: '', role: 'watcher' });
    }
  });

  if (requestIds.size === 0) return [];

  // Step 3: Fetch request details for watched tickets that we don't have yet
  const watchedIds = watchedRequests?.map(w => w.request_id).filter(id => !directRequests?.find(r => r.id === id)) || [];
  if (watchedIds.length > 0) {
    const { data: watchedDetails } = await supabase
      .from('requests')
      .select('id, title, request_type')
      .in('id', watchedIds);

    watchedDetails?.forEach((req) => {
      const existing = requestMap.get(req.id);
      requestMap.set(req.id, {
        title: req.title,
        type: req.request_type,
        role: existing?.role || 'watcher'
      });
    });
  }

  // Step 4: Get latest comment note for each request
  const requestIdArray = Array.from(requestIds);
  const { data: latestNotes } = await supabase
    .from('request_notes')
    .select('request_id, content, created_at, user_id')
    .in('request_id', requestIdArray)
    .eq('note_type', 'comment')
    .order('created_at', { ascending: false });

  // Group by request_id and get only the latest
  const latestNoteByRequest = new Map<string, { content: string; created_at: string; user_id: string }>();
  latestNotes?.forEach((note) => {
    if (!latestNoteByRequest.has(note.request_id)) {
      latestNoteByRequest.set(note.request_id, note);
    }
  });

  // Step 5: Get user names for note authors
  const authorIds = new Set<string>();
  latestNoteByRequest.forEach((note) => {
    if (note.user_id) authorIds.add(note.user_id);
  });

  const { data: userProfiles } = authorIds.size > 0
    ? await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', Array.from(authorIds))
    : { data: [] };

  const userNameMap = new Map<string, string>();
  userProfiles?.forEach((p) => {
    userNameMap.set(p.id, p.full_name || 'Unknown');
  });

  // Step 6: Get unread counts (notes created after user's last view)
  // For simplicity, mark as unread if latest note is not by the current user
  // TODO: Implement proper read tracking with request_note_reads table

  // Step 7: Build TicketChatData array
  const tickets: TicketChatData[] = [];
  requestIdArray.forEach((requestId) => {
    const reqInfo = requestMap.get(requestId);
    const latestNote = latestNoteByRequest.get(requestId);

    if (reqInfo && latestNote) {
      tickets.push({
        request_id: requestId,
        request_title: reqInfo.title,
        request_type: reqInfo.type,
        last_note_content: latestNote.content,
        last_note_at: latestNote.created_at,
        last_note_by: latestNote.user_id,
        last_note_by_name: latestNote.user_id ? userNameMap.get(latestNote.user_id) || null : null,
        unread_count: latestNote.user_id !== userId ? 1 : 0, // Simple: unread if not from current user
        user_role: reqInfo.role,
      });
    }
  });

  // Sort by last note timestamp
  tickets.sort((a, b) => new Date(b.last_note_at).getTime() - new Date(a.last_note_at).getTime());

  return tickets.slice(0, limit);
}

async function fetchUnifiedMessages(
  options: UseUnifiedMessagesOptions
): Promise<{ messages: UnifiedMessage[]; counts: UnifiedMessagesResult['counts'] }> {
  const { userId, filter = 'all', limit = 50 } = options;

  if (!userId) {
    return { messages: [], counts: { all: 0, sms: 0, team: 0, tickets: 0, alerts: 0 } };
  }

  const messages: UnifiedMessage[] = [];
  const counts = { all: 0, sms: 0, team: 0, tickets: 0, alerts: 0 };

  try {
    // Fetch based on filter - optimize by only fetching what's needed
    const fetchSms = filter === 'all' || filter === 'sms';
    const fetchTeam = filter === 'all' || filter === 'team';
    const fetchTickets = filter === 'all' || filter === 'tickets';
    const fetchAlerts = filter === 'all' || filter === 'alerts';

    // Parallel fetch all required data
    const [smsResult, announcementsResult, teamChatsResult, ticketsResult, alertsResult] = await Promise.all([
      fetchSms
        ? supabase
            .from('mc_conversations')
            .select(`
              id,
              conversation_type,
              title,
              contact_id,
              contact:mc_contacts!mc_conversations_contact_id_fkey(
                id, display_name, first_name, last_name, company_name
              ),
              status,
              last_message_at,
              last_message_preview,
              last_message_direction,
              unread_count,
              created_at,
              updated_at
            `)
            .eq('status', 'active')
            .in('conversation_type', ['client', 'team_direct'])
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),

      // Team announcements from company_messages
      fetchTeam
        ? supabase
            .from('company_messages')
            .select(`
              id,
              title,
              body,
              message_type,
              status,
              created_by,
              created_at,
              updated_at,
              published_at,
              metadata,
              company_message_reads!left(user_id, read_at)
            `)
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),

      // Team chats (1:1 and group DMs) from get_user_conversations RPC
      fetchTeam
        ? supabase.rpc('get_user_conversations')
        : Promise.resolve({ data: [], error: null }),

      // Tickets with chat activity
      fetchTickets
        ? fetchUserTickets(userId, limit)
        : Promise.resolve([]),

      fetchAlerts
        ? supabase
            .from('mc_system_notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('is_dismissed', false)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Process SMS conversations
    if (smsResult.data && !smsResult.error) {
      const smsMessages = (smsResult.data as Conversation[]).map(conversationToUnified);
      messages.push(...smsMessages);
      counts.sms = smsMessages.filter((m) => m.isUnread).length;
    }

    // Process team announcements
    if (announcementsResult.data && !announcementsResult.error) {
      const announcementMessages = announcementsResult.data.map((msg) => {
        const reads = msg.company_message_reads as Array<{ user_id: string }> | null;
        const isRead = reads?.some((r) => r.user_id === userId) ?? false;
        return announcementToUnified({ ...msg, isRead } as CompanyMessage & { isRead: boolean });
      });
      messages.push(...announcementMessages);
      counts.team += announcementMessages.filter((m) => m.isUnread).length;
    }

    // Process team chats (1:1 and group DMs)
    if (teamChatsResult.data && !teamChatsResult.error) {
      const teamChatMessages = (teamChatsResult.data as TeamChatConversation[]).map(teamChatToUnified);
      messages.push(...teamChatMessages);
      counts.team += teamChatMessages.filter((m) => m.isUnread).length;
    }

    // Process tickets
    if (ticketsResult && Array.isArray(ticketsResult)) {
      const ticketMessages = ticketsResult.map(ticketChatToUnified);
      messages.push(...ticketMessages);
      counts.tickets = ticketMessages.filter((m) => m.isUnread).length;
    }

    // Process notifications
    if (alertsResult.data && !alertsResult.error) {
      const alertMessages = (alertsResult.data as SystemNotification[]).map(notificationToUnified);
      messages.push(...alertMessages);
      counts.alerts = alertMessages.filter((m) => m.isUnread).length;
    }

    // Calculate total unread
    counts.all = counts.sms + counts.team + counts.tickets + counts.alerts;

    // Sort all messages by timestamp (newest first)
    messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { messages, counts };
  } catch (error) {
    console.debug('[useUnifiedMessages] Error fetching messages:', error);
    return { messages: [], counts: { all: 0, sms: 0, team: 0, tickets: 0, alerts: 0 } };
  }
}

export function useUnifiedMessages(options: UseUnifiedMessagesOptions): UnifiedMessagesResult {
  const queryClient = useQueryClient();
  const { userId, filter = 'all' } = options;

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['unified_messages', userId, filter],
    queryFn: () => fetchUnifiedMessages(options),
    enabled: !!userId,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Filter messages based on current filter (for quick filter switching with cached data)
  const filteredMessages = useMemo(() => {
    if (!data?.messages) return [];
    if (filter === 'all') return data.messages;

    // Team filter includes both team_chat and team_announcement
    if (filter === 'team') {
      return data.messages.filter((m) => m.type === 'team_chat' || m.type === 'team_announcement');
    }

    const typeMap: Record<UnifiedInboxFilter, UnifiedMessage['type'] | null> = {
      all: null,
      sms: 'sms',
      team: 'team_chat', // fallback, handled above
      tickets: 'ticket_chat',
      alerts: 'system_notification',
    };

    const targetType = typeMap[filter];
    if (!targetType) return data.messages;

    return data.messages.filter((m) => m.type === targetType);
  }, [data?.messages, filter]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('unified_messages_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mc_conversations' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mc_messages' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_messages' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_message_reads' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mc_system_notifications', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      // Team chats - direct_messages table
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_messages' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      // Ticket chats - request_notes table
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'request_notes' },
        () => queryClient.invalidateQueries({ queryKey: ['unified_messages'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    messages: filteredMessages,
    counts: data?.counts || { all: 0, sms: 0, team: 0, tickets: 0, alerts: 0 },
    isLoading,
    isRefetching,
    refetch,
  };
}

export default useUnifiedMessages;
