/**
 * Hook for fetching and managing company announcements
 * Used by the unified inbox to display team announcements
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CompanyMessage } from '../types';

interface UseAnnouncementsOptions {
  userId?: string;
  includeRead?: boolean;
  limit?: number;
}

interface AnnouncementWithReadStatus extends CompanyMessage {
  isRead: boolean;
}

async function getAnnouncements(
  options?: UseAnnouncementsOptions
): Promise<AnnouncementWithReadStatus[]> {
  if (!options?.userId) {
    return [];
  }

  try {
    // Fetch published announcements with read status
    const { data, error } = await supabase
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
      .limit(options?.limit || 50);

    if (error) throw error;

    // Transform to include read status
    return (data || []).map((msg) => {
      const reads = msg.company_message_reads as Array<{ user_id: string; read_at: string }> | null;
      const isRead = reads?.some((r) => r.user_id === options.userId) ?? false;

      return {
        id: msg.id,
        title: msg.title,
        body: msg.body,
        message_type: msg.message_type as CompanyMessage['message_type'],
        status: msg.status as CompanyMessage['status'],
        created_by: msg.created_by,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        published_at: msg.published_at,
        metadata: msg.metadata as Record<string, unknown> | undefined,
        isRead,
      };
    });
  } catch (error) {
    console.debug('[useAnnouncements] Error fetching announcements:', error);
    return [];
  }
}

export function useAnnouncements(options?: UseAnnouncementsOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['company_announcements', options?.userId, options?.includeRead],
    queryFn: () => getAnnouncements(options),
    enabled: !!options?.userId,
    staleTime: 30000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!options?.userId) return;

    const channel = supabase
      .channel('announcements_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['company_announcements'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_message_reads',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['company_announcements'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, options?.userId]);

  return query;
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, userId }: { messageId: string; userId: string }) => {
      const { error } = await supabase
        .from('company_message_reads')
        .upsert(
          {
            message_id: messageId,
            user_id: userId,
            read_at: new Date().toISOString(),
          },
          {
            onConflict: 'message_id,user_id',
          }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_announcements'] });
      queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    },
  });
}

export function useUnreadAnnouncementCount(userId?: string) {
  return useQuery({
    queryKey: ['unread_announcement_count', userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          id,
          company_message_reads!left(user_id)
        `)
        .eq('status', 'published');

      if (error) return 0;

      // Count messages not read by user
      return (data || []).filter((msg) => {
        const reads = msg.company_message_reads as Array<{ user_id: string }> | null;
        return !reads?.some((r) => r.user_id === userId);
      }).length;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });
}
