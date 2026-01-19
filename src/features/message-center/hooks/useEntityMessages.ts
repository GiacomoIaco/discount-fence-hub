/**
 * Hook for fetching and managing messages linked to FSM entities
 * (Requests, Quotes, Jobs, Invoices)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Message, MessageChannel, Conversation, Contact } from '../types';

export type EntityType = 'request' | 'quote' | 'job' | 'invoice' | 'ticket';

interface EntityMessage extends Message {
  conversation?: Conversation & { contact?: Contact };
}

interface UseEntityMessagesOptions {
  entityType: EntityType;
  entityId: string;
  enabled?: boolean;
}

interface SendEntityMessageParams {
  entityType: EntityType;
  entityId: string;
  conversationId?: string;
  body: string;
  channel?: MessageChannel;
  toPhone?: string;
  fromUserId: string;
}

/**
 * Maps entity type to the corresponding column in mc_messages
 */
function getEntityColumn(entityType: EntityType): string {
  const columnMap: Record<EntityType, string> = {
    request: 'linked_request_id',
    quote: 'linked_quote_id',
    job: 'linked_job_id',
    invoice: 'linked_invoice_id',
    ticket: 'linked_ticket_id',
  };
  return columnMap[entityType];
}

/**
 * Fetches all messages linked to an entity
 */
async function fetchEntityMessages(
  entityType: EntityType,
  entityId: string
): Promise<EntityMessage[]> {
  const column = getEntityColumn(entityType);

  const { data, error } = await supabase
    .from('mc_messages')
    .select(`
      *,
      attachments:mc_attachments(*),
      conversation:mc_conversations(
        id,
        conversation_type,
        title,
        status,
        contact:mc_contacts(*)
      ),
      sender:user_profiles!from_user_id(id, full_name, avatar_url)
    `)
    .eq(column, entityId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as EntityMessage[];
}

/**
 * Sends a message linked to an entity
 */
async function sendEntityMessage(params: SendEntityMessageParams): Promise<Message> {
  const {
    entityType,
    entityId,
    conversationId,
    body,
    channel = 'in_app',
    toPhone,
    fromUserId,
  } = params;

  const column = getEntityColumn(entityType);

  // Build the insert payload
  const insertPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    channel,
    direction: 'outbound',
    body,
    from_user_id: fromUserId,
    status: channel === 'sms' ? 'sending' : 'sent',
    sent_at: new Date().toISOString(),
    [column]: entityId,
  };

  if (toPhone) {
    insertPayload.to_phone = toPhone;
  }

  // Insert the message
  const { data: messageData, error: insertError } = await supabase
    .from('mc_messages')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) throw insertError;

  // If SMS, send via Twilio
  if (channel === 'sms' && toPhone) {
    const response = await fetch('/.netlify/functions/send-mc-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageData.id,
        to: toPhone,
        body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send SMS');
    }
  }

  return messageData as Message;
}

/**
 * Hook to fetch messages linked to an entity
 */
export function useEntityMessages(options: UseEntityMessagesOptions) {
  const { entityType, entityId, enabled = true } = options;

  return useQuery({
    queryKey: ['entity-messages', entityType, entityId],
    queryFn: () => fetchEntityMessages(entityType, entityId),
    enabled: enabled && !!entityId,
    staleTime: 30000,
  });
}

/**
 * Hook to send a message linked to an entity
 */
export function useSendEntityMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendEntityMessage,
    onSuccess: (_, variables) => {
      // Invalidate entity messages query
      queryClient.invalidateQueries({
        queryKey: ['entity-messages', variables.entityType, variables.entityId],
      });
      // Also invalidate unified messages
      queryClient.invalidateQueries({
        queryKey: ['unified_messages'],
      });
    },
  });
}

/**
 * Hook to get the count of messages for an entity (for tab badges)
 */
export function useEntityMessageCount(entityType: EntityType, entityId: string, enabled = true) {
  const column = getEntityColumn(entityType);

  return useQuery({
    queryKey: ['entity-message-count', entityType, entityId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('mc_messages')
        .select('*', { count: 'exact', head: true })
        .eq(column, entityId);

      if (error) throw error;
      return count || 0;
    },
    enabled: enabled && !!entityId,
    staleTime: 60000,
  });
}

export default useEntityMessages;
