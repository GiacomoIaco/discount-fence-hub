/**
 * Hook to get total unread message count for Message Center
 * Used for sidebar badge
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getTotalUnreadCount, type UserContext } from '../services/messageService';
import { supabase } from '../../../lib/supabase';

export function useMessageCenterUnread(userContext?: UserContext) {
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['mc_total_unread', userContext?.userId],
    queryFn: () => getTotalUnreadCount(userContext),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Subscribe to realtime changes on conversations
  useEffect(() => {
    const channel = supabase
      .channel('mc_unread_badge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mc_conversations',
        },
        () => {
          // Invalidate query to refetch unread count
          queryClient.invalidateQueries({ queryKey: ['mc_total_unread'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mc_messages',
        },
        () => {
          // New message - refetch unread count
          queryClient.invalidateQueries({ queryKey: ['mc_total_unread'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return unreadCount;
}

export default useMessageCenterUnread;
