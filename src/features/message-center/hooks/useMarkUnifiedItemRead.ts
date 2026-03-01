/**
 * Hook to mark unified inbox items as read
 * Dispatches to the correct mark-read function based on message type
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { UnifiedMessage } from '../types';
import * as messageService from '../services/messageService';
import * as notificationService from '../services/notificationService';

interface MarkReadParams {
  message: UnifiedMessage;
  userId: string;
}

async function markUnifiedItemAsRead({ message, userId }: MarkReadParams): Promise<void> {
  // Extract the real ID from the prefixed ID
  const realId = message.actionId;

  switch (message.type) {
    case 'sms':
      // Mark SMS conversation as read
      await messageService.markConversationRead(realId);
      break;

    case 'team_announcement':
      // Mark announcement as read by inserting into company_message_reads
      await supabase
        .from('company_message_reads')
        .upsert(
          {
            message_id: realId,
            user_id: userId,
            read_at: new Date().toISOString(),
          },
          {
            onConflict: 'message_id,user_id',
          }
        );
      break;

    case 'system_notification':
      // Mark notification as read
      await notificationService.markAsRead(realId);
      break;

    case 'ticket_chat':
      // Upsert read tracking for this ticket
      await supabase
        .from('request_note_reads')
        .upsert(
          {
            user_id: userId,
            request_id: realId,
            last_read_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,request_id',
          }
        );
      break;

    case 'team_chat':
      // Team chat read tracking is handled by the conversations system
      break;

    default:
      console.warn('[useMarkUnifiedItemRead] Unknown message type:', message.type);
  }
}

export function useMarkUnifiedItemRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markUnifiedItemAsRead,
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
      queryClient.invalidateQueries({ queryKey: ['unified_unread_count'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversation_counts'] });
      queryClient.invalidateQueries({ queryKey: ['company_announcements'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
    },
  });
}

export default useMarkUnifiedItemRead;
