/**
 * Hook to mark all visible inbox items as read in one action.
 * Batches mark-read calls for each message type.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import * as messageService from '../services/messageService';
import * as notificationService from '../services/notificationService';
import type { UnifiedMessage, Conversation } from '../types';

interface MarkAllReadParams {
  messages: UnifiedMessage[];
  userId: string;
}

async function markAllAsRead({ messages, userId }: MarkAllReadParams): Promise<void> {
  const unreadMessages = messages.filter((m) => m.isUnread);
  if (unreadMessages.length === 0) return;

  // Group by type for batched operations
  const smsIds: string[] = [];
  const announcementIds: string[] = [];
  const notificationIds: string[] = [];
  const ticketIds: string[] = [];

  for (const msg of unreadMessages) {
    switch (msg.type) {
      case 'sms':
        smsIds.push(msg.actionId);
        break;
      case 'team_announcement':
        announcementIds.push(msg.actionId);
        break;
      case 'system_notification':
        notificationIds.push(msg.actionId);
        break;
      case 'ticket_chat':
        ticketIds.push(msg.actionId);
        break;
      // team_chat read tracking is handled by the conversations system
    }
  }

  const operations: Promise<void>[] = [];

  // SMS: mark each conversation as read
  if (smsIds.length > 0) {
    operations.push(
      ...smsIds.map((id) => messageService.markConversationRead(id))
    );
  }

  // Announcements: batch upsert to company_message_reads
  if (announcementIds.length > 0) {
    operations.push(
      supabase
        .from('company_message_reads')
        .upsert(
          announcementIds.map((id) => ({
            message_id: id,
            user_id: userId,
            read_at: new Date().toISOString(),
          })),
          { onConflict: 'message_id,user_id' }
        )
        .then(() => undefined)
    );
  }

  // Notifications: batch update is_read = true
  if (notificationIds.length > 0) {
    operations.push(
      supabase
        .from('mc_system_notifications')
        .update({ is_read: true, read_at: new Date().toISOString(), read_by: userId })
        .in('id', notificationIds)
        .then(() => undefined)
    );
  }

  // Tickets: batch upsert to request_note_reads
  if (ticketIds.length > 0) {
    operations.push(
      supabase
        .from('request_note_reads')
        .upsert(
          ticketIds.map((id) => ({
            user_id: userId,
            request_id: id,
            last_read_at: new Date().toISOString(),
          })),
          { onConflict: 'user_id,request_id' }
        )
        .then(() => undefined)
    );
  }

  await Promise.all(operations);
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
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
