import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as messageService from '../services/messageService';
import { showError } from '../../../lib/toast';
import type { NewMessage } from '../types';

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mc_messages', conversationId],
    queryFn: () => conversationId ? messageService.getMessages(conversationId) : [],
    enabled: !!conversationId,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const subscription = messageService.subscribeToMessages(conversationId, () => {
      queryClient.invalidateQueries({ queryKey: ['mc_messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: NewMessage) => messageService.sendMessage(message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mc_messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to send message');
    },
  });
}
