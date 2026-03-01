import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface ReactionRecord {
  id: string;
  user_id: string;
  message_type: string;
  message_id: string;
  reaction: string;
  created_at: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export function useMessageReactions(messageType: string, messageIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['message-reactions', messageType, messageIds.sort().join(',')];

  const { data: reactionsMap = {} } = useQuery({
    queryKey,
    queryFn: async () => {
      if (messageIds.length === 0) return {};

      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_type', messageType)
        .in('message_id', messageIds);

      if (error) throw error;

      // Group by message_id, then by emoji
      const map: Record<string, GroupedReaction[]> = {};
      for (const msgId of messageIds) {
        const msgReactions = (data || []).filter(r => r.message_id === msgId);
        const emojiMap = new Map<string, { count: number; hasReacted: boolean }>();

        for (const r of msgReactions) {
          const existing = emojiMap.get(r.reaction) || { count: 0, hasReacted: false };
          existing.count++;
          if (r.user_id === user?.id) existing.hasReacted = true;
          emojiMap.set(r.reaction, existing);
        }

        map[msgId] = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
          emoji,
          ...data,
        }));
      }

      return map;
    },
    enabled: messageIds.length > 0,
    staleTime: 30000,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check if reaction exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('message_type', messageType)
        .eq('message_id', messageId)
        .eq('reaction', emoji)
        .maybeSingle();

      if (existing) {
        // Remove reaction
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        // Add reaction
        await supabase.from('message_reactions').insert({
          user_id: user.id,
          message_type: messageType,
          message_id: messageId,
          reaction: emoji,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions', messageType] });
    },
  });

  return {
    reactionsMap,
    toggleReaction: toggleReaction.mutate,
  };
}
