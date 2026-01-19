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

async function fetchUnifiedMessages(
  options: UseUnifiedMessagesOptions
): Promise<{ messages: UnifiedMessage[]; counts: UnifiedMessagesResult['counts'] }> {
  const { userId, filter = 'all', limit = 50 } = options;

  if (!userId) {
    return { messages: [], counts: { all: 0, sms: 0, team: 0, alerts: 0 } };
  }

  const messages: UnifiedMessage[] = [];
  const counts = { all: 0, sms: 0, team: 0, alerts: 0 };

  try {
    // Fetch based on filter - optimize by only fetching what's needed
    const fetchSms = filter === 'all' || filter === 'sms';
    const fetchTeam = filter === 'all' || filter === 'team';
    const fetchAlerts = filter === 'all' || filter === 'alerts';

    // Parallel fetch all required data
    const [smsResult, teamResult, alertsResult] = await Promise.all([
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

    // Process announcements
    if (teamResult.data && !teamResult.error) {
      const teamMessages = teamResult.data.map((msg) => {
        const reads = msg.company_message_reads as Array<{ user_id: string }> | null;
        const isRead = reads?.some((r) => r.user_id === userId) ?? false;
        return announcementToUnified({ ...msg, isRead } as CompanyMessage & { isRead: boolean });
      });
      messages.push(...teamMessages);
      counts.team = teamMessages.filter((m) => m.isUnread).length;
    }

    // Process notifications
    if (alertsResult.data && !alertsResult.error) {
      const alertMessages = (alertsResult.data as SystemNotification[]).map(notificationToUnified);
      messages.push(...alertMessages);
      counts.alerts = alertMessages.filter((m) => m.isUnread).length;
    }

    // Calculate total unread
    counts.all = counts.sms + counts.team + counts.alerts;

    // Sort all messages by timestamp (newest first)
    messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { messages, counts };
  } catch (error) {
    console.debug('[useUnifiedMessages] Error fetching messages:', error);
    return { messages: [], counts: { all: 0, sms: 0, team: 0, alerts: 0 } };
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

    const typeMap: Record<UnifiedInboxFilter, UnifiedMessage['type'] | null> = {
      all: null,
      sms: 'sms',
      team: 'team_announcement',
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return {
    messages: filteredMessages,
    counts: data?.counts || { all: 0, sms: 0, team: 0, alerts: 0 },
    isLoading,
    isRefetching,
    refetch,
  };
}

export default useUnifiedMessages;
