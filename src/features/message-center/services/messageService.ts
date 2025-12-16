import { supabase } from '../../../lib/supabase';
import type {
  Conversation,
  ConversationWithContact,
  Message,
  NewMessage,
  Contact,
  ConversationFilter,
  ConversationCounts
} from '../types';

// ============================================================================
// CONVERSATIONS
// ============================================================================

export async function getConversations(filter: ConversationFilter = 'all'): Promise<ConversationWithContact[]> {
  let query = supabase
    .from('mc_conversations')
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  // Apply filter
  switch (filter) {
    case 'team':
      query = query.in('conversation_type', ['team_direct', 'team_group']);
      break;
    case 'clients':
      query = query.eq('conversation_type', 'client');
      break;
    case 'requests':
      query = query.eq('has_project_signal', true);
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
  return data || [];
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

  // 2. Call Edge Function to send via Twilio (for SMS)
  if (message.channel === 'sms' && message.to_phone) {
    try {
      const response = await supabase.functions.invoke('send-sms', {
        body: {
          message_id: data.id,
          to: message.to_phone,
          body: message.body,
        }
      });

      if (response.error) {
        console.error('Failed to send SMS:', response.error);
        // Message status will be updated by the edge function
      }
    } catch (err) {
      console.error('Error invoking send-sms:', err);
      // Don't throw - the message was created, status will show as 'sending'
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
