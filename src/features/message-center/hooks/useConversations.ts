import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as messageService from '../services/messageService';
import type { UserContext } from '../services/messageService';
import type { ConversationFilter, ClientFilters } from '../types';

export function useConversations(
  filter: ConversationFilter = 'all',
  clientFilters?: ClientFilters,
  userContext?: UserContext
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mc_conversations', filter, clientFilters, userContext?.userId],
    queryFn: () => messageService.getConversations(filter, clientFilters, userContext),
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const subscription = messageService.subscribeToConversations(() => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversation_counts'] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

export function useConversationCounts(userContext?: UserContext) {
  return useQuery({
    queryKey: ['mc_conversation_counts', userContext?.userId],
    queryFn: () => messageService.getConversationCounts(userContext),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['mc_conversation', id],
    queryFn: () => id ? messageService.getConversation(id) : null,
    enabled: !!id,
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: messageService.markConversationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversation_counts'] });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: messageService.archiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversation_counts'] });
    },
  });
}

export function useUnarchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: messageService.unarchiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversation_counts'] });
    },
  });
}
