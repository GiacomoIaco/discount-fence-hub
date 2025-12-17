import { supabase } from '../../../lib/supabase';
import type {
  Conversation,
  ConversationWithContact,
  ConversationParticipant,
  Message,
  NewMessage,
  Contact,
  ConversationFilter,
  ConversationCounts,
  ClientFilters
} from '../types';

// ============================================================================
// CONVERSATIONS
// ============================================================================

export async function getConversations(
  filter: ConversationFilter = 'all',
  clientFilters?: ClientFilters
): Promise<ConversationWithContact[]> {
  // If client filters are applied, we need to join to the clients table
  const needsClientJoin = clientFilters?.businessUnit || clientFilters?.city || clientFilters?.state;

  let query = supabase
    .from('mc_conversations')
    .select(`
      *,
      contact:mc_contacts(*, client:clients(id, business_unit, city, state))
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  // Apply filter
  switch (filter) {
    case 'team':
      query = query.in('conversation_type', ['team_direct', 'team_group']).eq('status', 'active');
      break;
    case 'clients':
      query = query.eq('conversation_type', 'client').eq('status', 'active');
      break;
    case 'requests':
      query = query.eq('has_project_signal', true).eq('status', 'active');
      break;
    case 'archived':
      query = query.eq('status', 'archived');
      break;
    default:
      // 'all' shows active conversations only
      query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) throw error;

  // Apply client-level filters in memory since Supabase doesn't support
  // filtering on nested joins easily
  let results = data || [];

  if (needsClientJoin && results.length > 0) {
    results = results.filter(conv => {
      // Only filter client conversations
      if (conv.conversation_type !== 'client') return true;

      const client = (conv.contact as any)?.client;
      if (!client) return true; // Keep if no client linked

      if (clientFilters?.businessUnit && client.business_unit !== clientFilters.businessUnit) {
        return false;
      }
      if (clientFilters?.city && client.city !== clientFilters.city) {
        return false;
      }
      if (clientFilters?.state && client.state !== clientFilters.state) {
        return false;
      }
      return true;
    });
  }

  return results;
}

export async function getConversationCounts(): Promise<ConversationCounts> {
  // Get all counts in parallel
  const [allResult, teamResult, clientsResult, requestsResult, archivedResult] = await Promise.all([
    supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').in('conversation_type', ['team_direct', 'team_group']),
    supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('conversation_type', 'client'),
    supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('has_project_signal', true),
    supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
  ]);

  return {
    all: allResult.count || 0,
    team: teamResult.count || 0,
    clients: clientsResult.count || 0,
    requests: requestsResult.count || 0,
    archived: archivedResult.count || 0,
  };
}

export async function getConversation(id: string): Promise<ConversationWithContact | null> {
  const { data, error } = await supabase
    .from('mc_conversations')
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createConversation(
  contactId: string,
  type: 'client' | 'team_direct' = 'client'
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('mc_conversations')
    .insert({
      conversation_type: type,
      contact_id: contactId,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function archiveConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_conversations')
    .update({ status: 'archived' })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function unarchiveConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_conversations')
    .update({ status: 'active' })
    .eq('id', conversationId);

  if (error) throw error;
}

// ============================================================================
// GROUP CONVERSATIONS
// ============================================================================

export async function createGroupConversation(
  contactIds: string[],
  title?: string,
  type: 'client' | 'team_group' = 'team_group'
): Promise<Conversation> {
  // Create the conversation
  const { data: conversation, error: convError } = await supabase
    .from('mc_conversations')
    .insert({
      conversation_type: type,
      title: title || null,
      is_group: true,
      participant_count: contactIds.length,
      status: 'active'
    })
    .select()
    .single();

  if (convError) throw convError;

  // Add all participants
  const participants = contactIds.map(contactId => ({
    conversation_id: conversation.id,
    contact_id: contactId,
    role: 'member'
  }));

  const { error: partError } = await supabase
    .from('mc_conversation_participants')
    .insert(participants);

  if (partError) throw partError;

  return conversation;
}

export async function addParticipantToConversation(
  conversationId: string,
  contactId: string,
  addedBy?: string
): Promise<ConversationParticipant> {
  // First, mark conversation as group if not already
  await supabase
    .from('mc_conversations')
    .update({ is_group: true })
    .eq('id', conversationId);

  const { data, error } = await supabase
    .from('mc_conversation_participants')
    .insert({
      conversation_id: conversationId,
      contact_id: contactId,
      role: 'member',
      added_by: addedBy
    })
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function removeParticipantFromConversation(
  conversationId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('mc_conversation_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('contact_id', contactId);

  if (error) throw error;
}

export async function getConversationParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const { data, error } = await supabase
    .from('mc_conversation_participants')
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .eq('conversation_id', conversationId)
    .is('left_at', null)
    .order('joined_at');

  if (error) throw error;
  return data || [];
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('mc_messages')
    .select(`
      *,
      attachments:mc_attachments(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function sendMessage(message: NewMessage): Promise<Message> {
  console.log('[MC sendMessage] Called with:', {
    conversation_id: message.conversation_id,
    channel: message.channel,
    to_phone: message.to_phone,
    bodyLength: message.body?.length
  });

  // 1. Insert message with 'sending' status
  const { data, error } = await supabase
    .from('mc_messages')
    .insert({
      conversation_id: message.conversation_id,
      channel: message.channel,
      direction: 'outbound',
      body: message.body,
      to_phone: message.to_phone,
      to_email: message.to_email,
      status: 'sending',
      sent_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Call Netlify function to send via Twilio (for SMS)
  if (message.channel === 'sms' && message.to_phone) {
    console.log('[MC SMS] Sending to:', message.to_phone, 'message_id:', data.id);
    try {
      const response = await fetch('/.netlify/functions/send-mc-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: data.id,
          to: message.to_phone,
          body: message.body,
        }),
      });

      const responseData = await response.json();
      console.log('[MC SMS] Response:', response.status, responseData);

      if (!response.ok) {
        console.error('[MC SMS] Failed:', responseData);
        // Update the message in the UI to show failure
        throw new Error(responseData.error || 'Failed to send SMS');
      }
    } catch (err) {
      console.error('[MC SMS] Error:', err);
      // Re-throw so user sees the error
      throw err;
    }
  }

  // 3. Return the message (status will update via realtime subscription)
  return data;
}

// ============================================================================
// CONTACTS
// ============================================================================

export async function getContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('mc_contacts')
    .select('*')
    .order('display_name');

  if (error) throw error;
  return data || [];
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('mc_contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function findContactByPhone(phone: string): Promise<Contact | null> {
  // Normalize phone (remove non-digits)
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  const { data, error } = await supabase
    .from('mc_contacts')
    .select('*')
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

export async function createContact(contact: Partial<Contact>): Promise<Contact> {
  const { data, error } = await supabase
    .from('mc_contacts')
    .insert({
      contact_type: contact.contact_type || 'client',
      display_name: contact.display_name || 'Unknown',
      first_name: contact.first_name,
      last_name: contact.last_name,
      company_name: contact.company_name,
      phone_primary: contact.phone_primary,
      email_primary: contact.email_primary,
      client_id: contact.client_id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

export function subscribeToConversations(
  callback: (payload: any) => void
) {
  return supabase
    .channel('mc_conversations_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mc_conversations'
      },
      callback
    )
    .subscribe();
}

export function subscribeToMessages(
  conversationId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`mc_messages_${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mc_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      callback
    )
    .subscribe();
}
