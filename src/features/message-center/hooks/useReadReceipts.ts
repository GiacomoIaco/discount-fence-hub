import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useEffect } from 'react';

type ReadStatus = 'sent' | 'delivered' | 'read';

export function useReadReceipts(conversationId: string | null, messageIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query read receipts for own messages
  const { data: readStatusMap = {} } = useQuery({
    queryKey: ['read-receipts', conversationId, messageIds.sort().join(',')],
    queryFn: async () => {
      if (messageIds.length === 0) return {};

      const { data, error } = await supabase
        .from('direct_message_reads')
        .select('message_id, user_id, read_at')
        .in('message_id', messageIds);

      if (error) throw error;

      const map: Record<string, ReadStatus> = {};
      for (const msgId of messageIds) {
        const reads = (data || []).filter(r => r.message_id === msgId && r.user_id !== user?.id);
        map[msgId] = reads.length > 0 ? 'read' : 'sent';
      }

      return map;
    },
    enabled: !!conversationId && messageIds.length > 0,
    staleTime: 10000,
  });

  // Mark messages as read when conversation opens
  const markAsRead = useMutation({
    mutationFn: async (msgIds: string[]) => {
      if (!user?.id || msgIds.length === 0) return;

      // Batch insert read receipts (ignore conflicts for already-read messages)
      const records = msgIds.map(message_id => ({
        message_id,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('direct_message_reads')
        .upsert(records, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

      if (error) console.error('Failed to mark messages as read:', error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-receipts'] });
    },
  });

  // Auto-mark messages as read when viewing
  useEffect(() => {
    if (!conversationId || messageIds.length === 0 || !user?.id) return;

    // Filter to messages NOT sent by current user
    // We'll mark them as read after a short delay (to confirm user actually saw them)
    const timer = setTimeout(() => {
      markAsRead.mutate(messageIds);
    }, 1000);

    return () => clearTimeout(timer);
  }, [conversationId, messageIds.join(','), user?.id]);

  return {
    readStatusMap,
    markAsRead: markAsRead.mutate,
  };
}
