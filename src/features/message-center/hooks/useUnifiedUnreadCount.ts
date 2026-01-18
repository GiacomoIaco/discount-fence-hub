/**
 * Hook to get unified unread message count across all messaging sources
 * Aggregates: SMS conversations, Team announcements, System notifications
 * Used for the mobile bottom navigation badge
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface UnifiedUnreadOptions {
  userId?: string;
  userRole?: string;
}

interface UnreadCounts {
  sms: number;          // mc_conversations
  announcements: number; // company_messages (unread)
  notifications: number; // mc_system_notifications
  total: number;
}

async function getUnifiedUnreadCounts(options?: UnifiedUnreadOptions): Promise<UnreadCounts> {
  const counts: UnreadCounts = {
    sms: 0,
    announcements: 0,
    notifications: 0,
    total: 0,
  };

  if (!options?.userId) {
    return counts;
  }

  try {
    // 1. Get SMS conversation unread count (from mc_conversations)
    const { count: smsCount, error: smsError } = await supabase
      .from('mc_conversations')
      .select('*', { count: 'exact', head: true })
      .gt('unread_count', 0);

    if (!smsError && smsCount !== null) {
      counts.sms = smsCount;
    }

    // 2. Get unread announcements (company_messages not yet read by user)
    // Check company_message_reads table to see what user has read
    const { data: announcements, error: announcementError } = await supabase
      .from('company_messages')
      .select(`
        id,
        company_message_reads!left(user_id)
      `)
      .eq('status', 'published')
      .is('company_message_reads.user_id', null);

    if (!announcementError && announcements) {
      // Filter to count messages not read by current user
      counts.announcements = announcements.filter(msg => {
        // If company_message_reads is null or empty, user hasn't read it
        return !msg.company_message_reads ||
               (Array.isArray(msg.company_message_reads) &&
                !msg.company_message_reads.some((r: { user_id: string }) => r.user_id === options.userId));
      }).length;
    }

    // 3. Get unread notifications count
    const { count: notifCount, error: notifError } = await supabase
      .from('mc_system_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', options.userId)
      .eq('is_read', false)
      .eq('is_dismissed', false);

    if (!notifError && notifCount !== null) {
      counts.notifications = notifCount;
    }
  } catch (error) {
    // Silently fail - tables may not exist yet
    console.debug('[UnifiedUnread] Error fetching counts:', error);
  }

  counts.total = counts.sms + counts.announcements + counts.notifications;
  return counts;
}

export function useUnifiedUnreadCount(options?: UnifiedUnreadOptions) {
  const queryClient = useQueryClient();

  const { data: counts = { sms: 0, announcements: 0, notifications: 0, total: 0 } } = useQuery({
    queryKey: ['unified_unread_count', options?.userId],
    queryFn: () => getUnifiedUnreadCounts(options),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    enabled: !!options?.userId,
  });

  // Subscribe to realtime changes
  useEffect(() => {
    if (!options?.userId) return;

    const channel = supabase
      .channel('unified_unread_updates')
      // Listen for conversation updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mc_conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
        }
      )
      // Listen for new messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mc_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
        }
      )
      // Listen for company message changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
        }
      )
      // Listen for message read changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_message_reads',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
        }
      )
      // Listen for notification changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mc_system_notifications',
          filter: `user_id=eq.${options.userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, options?.userId]);

  return counts;
}

export default useUnifiedUnreadCount;
