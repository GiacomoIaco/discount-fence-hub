/**
 * Hook for replying to unified messages from the inbox
 * Handles SMS replies, announcement acknowledgments, and other message types
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { UnifiedMessage, Conversation } from '../types';

interface ReplyParams {
  message: UnifiedMessage;
  replyBody: string;
  fromUserId: string;
}

interface AcknowledgeParams {
  message: UnifiedMessage;
  userId: string;
}

/**
 * Send an SMS reply to a conversation
 */
async function sendSmsReply(
  conversationId: string,
  replyBody: string,
  toPhone: string,
  fromUserId: string
): Promise<void> {
  // 1. Insert message with 'sending' status
  const { data: messageData, error: insertError } = await supabase
    .from('mc_messages')
    .insert({
      conversation_id: conversationId,
      channel: 'sms',
      direction: 'outbound',
      body: replyBody,
      to_phone: toPhone,
      from_user_id: fromUserId,
      status: 'sending',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // 2. Call Netlify function to send via Twilio
  const response = await fetch('/.netlify/functions/send-mc-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_id: messageData.id,
      to: toPhone,
      body: replyBody,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to send SMS');
  }
}

/**
 * Acknowledge (mark as read) an announcement
 */
async function acknowledgeAnnouncement(
  announcementId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('company_message_reads')
    .upsert({
      message_id: announcementId,
      user_id: userId,
      read_at: new Date().toISOString(),
    }, {
      onConflict: 'message_id,user_id',
    });

  if (error) throw error;
}

/**
 * Mark a system notification as read
 */
async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      read_by: userId,
    })
    .eq('id', notificationId);

  if (error) throw error;
}

/**
 * Hook for replying to a unified message
 */
export function useReplyToUnifiedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, replyBody, fromUserId }: ReplyParams) => {
      switch (message.type) {
        case 'sms': {
          const conversation = message.rawData as Conversation;
          const toPhone = conversation.contact?.phone_primary;

          if (!toPhone) {
            throw new Error('No phone number found for contact');
          }

          await sendSmsReply(conversation.id, replyBody, toPhone, fromUserId);
          break;
        }

        case 'team_announcement': {
          // For announcements, "reply" means acknowledge
          await acknowledgeAnnouncement(message.actionId, fromUserId);
          break;
        }

        case 'system_notification': {
          // For notifications, mark as read
          await markNotificationRead(message.actionId, fromUserId);
          break;
        }

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    },
    onSuccess: () => {
      // Invalidate unified messages to refresh the list
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

/**
 * Hook for acknowledging an announcement or notification
 */
export function useAcknowledgeUnifiedItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, userId }: AcknowledgeParams) => {
      switch (message.type) {
        case 'team_announcement':
          await acknowledgeAnnouncement(message.actionId, userId);
          break;

        case 'system_notification':
          await markNotificationRead(message.actionId, userId);
          break;

        case 'sms': {
          // For SMS, mark conversation as read
          const conversation = message.rawData as Conversation;
          const { error } = await supabase
            .from('mc_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversation.id);
          if (error) throw error;
          break;
        }

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified_messages'] });
    },
  });
}

export default useReplyToUnifiedMessage;
