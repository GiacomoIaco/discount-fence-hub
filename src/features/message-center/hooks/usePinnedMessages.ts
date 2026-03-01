import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface PinnedMessage {
  id: string;
  user_id: string;
  message_type: string;
  message_id: string;
  conversation_ref: string;
  pinned_at: string;
}

export function usePinnedMessages(conversationRef: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['pinned-messages', conversationRef];

  const { data: pinnedMessages = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!conversationRef) return [];

      const { data, error } = await supabase
        .from('pinned_messages')
        .select('*')
        .eq('conversation_ref', conversationRef)
        .order('pinned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PinnedMessage[];
    },
    enabled: !!conversationRef,
    staleTime: 30000,
  });

  const togglePin = useMutation({
    mutationFn: async ({ messageId, messageType }: { messageId: string; messageType: string }) => {
      if (!user?.id || !conversationRef) throw new Error('Missing data');

      // Check if already pinned
      const existing = pinnedMessages.find(p => p.message_id === messageId);

      if (existing) {
        // Unpin
        await supabase.from('pinned_messages').delete().eq('id', existing.id);
      } else {
        // Pin
        await supabase.from('pinned_messages').insert({
          user_id: user.id,
          message_type: messageType,
          message_id: messageId,
          conversation_ref: conversationRef,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const pinnedMessageIds = new Set(pinnedMessages.map(p => p.message_id));

  return {
    pinnedMessages,
    pinnedMessageIds,
    togglePin: togglePin.mutate,
    isToggling: togglePin.isPending,
  };
}
