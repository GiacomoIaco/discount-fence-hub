/**
 * Hook to get unified unread message count across all messaging sources
 * Aggregates: SMS, Team chats, Announcements, Ticket chats, System notifications
 * Used for sidebar badges, mobile bottom nav badge, floating inbox button
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface UnifiedUnreadOptions {
  userId?: string;
  userRole?: string;
}

interface UnreadCounts {
  sms: number;           // mc_conversations (participant-only)
  teamChats: number;     // conversations / direct_messages
  announcements: number; // company_messages (unread)
  tickets: number;       // request_notes (unread comments)
  notifications: number; // mc_system_notifications
  total: number;
}

async function getUnifiedUnreadCounts(options?: UnifiedUnreadOptions): Promise<UnreadCounts> {
  const counts: UnreadCounts = {
    sms: 0,
    teamChats: 0,
    announcements: 0,
    tickets: 0,
    notifications: 0,
    total: 0,
  };

  if (!options?.userId) {
    return counts;
  }

  try {
    // Fetch all counts in parallel for speed
    const [smsCount, teamChatCount, announcementCount, ticketCount, notifCount] = await Promise.all([
      // 1. SMS conversation unread count (participant-only)
      (async () => {
        const { data: userContact } = await supabase
          .from('mc_contacts')
          .select('id')
          .eq('employee_id', options.userId)
          .single();

        if (!userContact) return 0;

        const { data: participations } = await supabase
          .from('mc_conversation_participants')
          .select('conversation_id')
          .eq('contact_id', userContact.id)
          .is('left_at', null);

        const ids = new Set((participations || []).map(p => p.conversation_id));

        const { data: directConversations } = await supabase
          .from('mc_conversations')
          .select('id')
          .eq('contact_id', userContact.id);

        directConversations?.forEach(c => ids.add(c.id));

        const allowedIds = Array.from(ids);
        if (allowedIds.length === 0) return 0;

        const { count, error } = await supabase
          .from('mc_conversations')
          .select('*', { count: 'exact', head: true })
          .gt('unread_count', 0)
          .in('id', allowedIds);

        return (!error && count !== null) ? count : 0;
      })(),

      // 2. Team chat unread count (from get_user_conversations RPC)
      (async () => {
        const { data, error } = await supabase.rpc('get_user_conversations');
        if (error || !data) return 0;
        return (data as Array<{ unread_count: number }>)
          .reduce((sum, chat) => sum + (Number(chat.unread_count) || 0), 0);
      })(),

      // 3. Announcement unread count
      // Left join filtered to current user's reads — empty array means unread
      (async () => {
        const { data, error } = await supabase
          .from('company_messages')
          .select(`
            id,
            company_message_reads!left(user_id)
          `)
          .eq('status', 'published')
          .eq('company_message_reads.user_id', options.userId!);

        if (error || !data) return 0;
        // Messages where the user has no read record have empty array
        return data.filter(msg =>
          !msg.company_message_reads ||
          (Array.isArray(msg.company_message_reads) && msg.company_message_reads.length === 0)
        ).length;
      })(),

      // 4. Ticket chat unread count (request_notes comments)
      (async () => {
        // Get requests where user is submitter, assignee, or watcher
        const [directResult, watchedResult] = await Promise.all([
          supabase
            .from('requests')
            .select('id')
            .or(`submitter_id.eq.${options.userId},assigned_to.eq.${options.userId}`)
            .in('stage', ['new', 'in_progress', 'pending', 'waiting_on_client']),
          supabase
            .from('request_watchers')
            .select('request_id')
            .eq('user_id', options.userId!),
        ]);

        const requestIds = new Set<string>();
        directResult.data?.forEach(r => requestIds.add(r.id));
        watchedResult.data?.forEach(w => requestIds.add(w.request_id));

        if (requestIds.size === 0) return 0;

        const requestIdArray = Array.from(requestIds);

        // Get latest comment per request and read tracking
        const [notesResult, readsResult] = await Promise.all([
          supabase
            .from('request_notes')
            .select('request_id, created_at, user_id')
            .in('request_id', requestIdArray)
            .eq('note_type', 'comment')
            .order('created_at', { ascending: false }),
          supabase
            .from('request_note_reads')
            .select('request_id, last_read_at')
            .eq('user_id', options.userId!)
            .in('request_id', requestIdArray),
        ]);

        // Build latest note per request
        const latestByRequest = new Map<string, { created_at: string; user_id: string }>();
        notesResult.data?.forEach(note => {
          if (!latestByRequest.has(note.request_id)) {
            latestByRequest.set(note.request_id, note);
          }
        });

        const readMap = new Map<string, string>();
        readsResult.data?.forEach(r => readMap.set(r.request_id, r.last_read_at));

        let unread = 0;
        latestByRequest.forEach((note, requestId) => {
          const lastReadAt = readMap.get(requestId);
          const isUnread = lastReadAt
            ? new Date(note.created_at) > new Date(lastReadAt)
            : note.user_id !== options.userId; // Unread if not from current user
          if (isUnread) unread++;
        });

        return unread;
      })(),

      // 5. System notifications unread count
      (async () => {
        const { count, error } = await supabase
          .from('mc_system_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('target_user_id', options.userId!)
          .eq('is_read', false);
        return (!error && count !== null) ? count : 0;
      })(),
    ]);

    counts.sms = smsCount;
    counts.teamChats = teamChatCount;
    counts.announcements = announcementCount;
    counts.tickets = ticketCount;
    counts.notifications = notifCount;
  } catch (error) {
    console.debug('[UnifiedUnread] Error fetching counts:', error);
  }

  counts.total = counts.sms + counts.teamChats + counts.announcements + counts.tickets + counts.notifications;
  return counts;
}

const defaultCounts: UnreadCounts = { sms: 0, teamChats: 0, announcements: 0, tickets: 0, notifications: 0, total: 0 };

export function useUnifiedUnreadCount(options?: UnifiedUnreadOptions) {
  const queryClient = useQueryClient();

  const { data: counts = defaultCounts } = useQuery({
    queryKey: ['unified_unread_count', options?.userId, options?.userRole ?? 'loading'],
    queryFn: () => getUnifiedUnreadCounts(options),
    refetchInterval: 30000,
    staleTime: 10000,
    enabled: !!options?.userId,
  });

  // Subscribe to realtime changes for all message sources
  useEffect(() => {
    if (!options?.userId) return;

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });

    const channel = supabase
      .channel('unified_unread_updates')
      // SMS conversations
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mc_conversations' }, invalidate)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mc_messages' }, invalidate)
      // Team chats
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, invalidate)
      // Announcements
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_messages' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_message_reads' }, invalidate)
      // Ticket comments
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_notes' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_note_reads' }, invalidate)
      // System notifications
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mc_system_notifications', filter: `target_user_id=eq.${options.userId}` }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, options?.userId]);

  return counts;
}

export default useUnifiedUnreadCount;
