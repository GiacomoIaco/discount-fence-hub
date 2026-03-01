/**
 * Hook to dismiss (archive) and restore inbox items.
 * Uses inbox_dismissed_items table for unified dismiss tracking.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { UnifiedMessage } from '../types';

interface DismissParams {
  message: UnifiedMessage;
  userId: string;
}

interface RestoreParams {
  message: UnifiedMessage;
  userId: string;
}

async function dismissItem({ message, userId }: DismissParams): Promise<void> {
  const { error } = await supabase
    .from('inbox_dismissed_items')
    .upsert(
      {
        user_id: userId,
        item_type: message.type,
        item_id: message.actionId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,item_type,item_id' }
    );

  if (error) throw error;
}

async function restoreItem({ message, userId }: RestoreParams): Promise<void> {
  const { error } = await supabase
    .from('inbox_dismissed_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_type', message.type)
    .eq('item_id', message.actionId);

  if (error) throw error;
}

export function useDismissInboxItem() {
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: dismissItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
      queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
      queryClient.invalidateQueries({ queryKey: ['inbox_dismissed'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
      queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
      queryClient.invalidateQueries({ queryKey: ['inbox_dismissed'] });
    },
  });

  return {
    dismiss: dismissMutation,
    restore: restoreMutation,
  };
}
