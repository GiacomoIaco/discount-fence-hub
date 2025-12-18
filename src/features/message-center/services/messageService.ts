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

// Roles that have full access to all conversations (Front Desk)
const FULL_ACCESS_ROLES = ['admin', 'operations'];

export interface UserContext {
  userId: string;
  userRole: string;
}

export async function getConversations(
  filter: ConversationFilter = 'all',
  clientFilters?: ClientFilters,
  userContext?: UserContext
): Promise<ConversationWithContact[]> {
  // If client filters are applied, we need to join to the clients table
  const needsClientJoin = clientFilters?.businessUnit || clientFilters?.city || clientFilters?.state;

  // Check if user needs filtered view (sales reps only see conversations they're invited to)
  const needsParticipantFilter = userContext && !FULL_ACCESS_ROLES.includes(userContext.userRole);

  // If user needs filtered view, get their conversation IDs first
  let allowedConversationIds: string[] | null = null;

  if (needsParticipantFilter && userContext) {
    // Find mc_contact for this user
    const { data: userContact } = await supabase
      .from('mc_contacts')
      .select('id')
      .eq('employee_id', userContext.userId)
      .single();

    if (userContact) {
      // Get conversation IDs they're participating in
      const { data: participations } = await supabase
        .from('mc_conversation_participants')
        .select('conversation_id')
        .eq('contact_id', userContact.id)
        .is('left_at', null);

      allowedConversationIds = (participations || []).map(p => p.conversation_id);

      // Also include conversations where they are the primary contact
      const { data: directConversations } = await supabase
        .from('mc_conversations')
        .select('id')
        .eq('contact_id', userContact.id);

      if (directConversations) {
        allowedConversationIds = [...new Set([
          ...allowedConversationIds,
          ...directConversations.map(c => c.id)
        ])];
      }
    }
  }

  let query = supabase
    .from('mc_conversations')
    .select(`
      *,
      contact:mc_contacts(*, client:clients(id, business_unit, city, state))
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  // Apply participant filter if needed
  if (allowedConversationIds !== null) {
    if (allowedConversationIds.length === 0) {
      // User has no conversations - return empty array
      return [];
    }
    query = query.in('id', allowedConversationIds);
  }

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

export async function getConversationCounts(userContext?: UserContext): Promise<ConversationCounts> {
  // Check if user needs filtered view
  const needsParticipantFilter = userContext && !FULL_ACCESS_ROLES.includes(userContext.userRole);

  // For filtered users, get their allowed conversation IDs first
  let allowedIds: string[] | null = null;

  if (needsParticipantFilter && userContext) {
    const { data: userContact } = await supabase
      .from('mc_contacts')
      .select('id')
      .eq('employee_id', userContext.userId)
      .single();

    if (userContact) {
      const { data: participations } = await supabase
        .from('mc_conversation_participants')
        .select('conversation_id')
        .eq('contact_id', userContact.id)
        .is('left_at', null);

      allowedIds = (participations || []).map(p => p.conversation_id);

      const { data: directConversations } = await supabase
        .from('mc_conversations')
        .select('id')
        .eq('contact_id', userContact.id);

      if (directConversations) {
        allowedIds = [...new Set([...allowedIds, ...directConversations.map(c => c.id)])];
      }
    } else {
      // User has no mc_contact - no conversations
      return { all: 0, team: 0, clients: 0, requests: 0, archived: 0 };
    }

    if (allowedIds.length === 0) {
      return { all: 0, team: 0, clients: 0, requests: 0, archived: 0 };
    }
  }

  // Get all counts in parallel - with ID filtering if needed
  let allQuery = supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active');
  let teamQuery = supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').in('conversation_type', ['team_direct', 'team_group']);
  let clientsQuery = supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('conversation_type', 'client');
  let requestsQuery = supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('has_project_signal', true);
  let archivedQuery = supabase.from('mc_conversations').select('id', { count: 'exact', head: true }).eq('status', 'archived');

  // Add ID filter if needed
  if (allowedIds) {
    allQuery = allQuery.in('id', allowedIds);
    teamQuery = teamQuery.in('id', allowedIds);
    clientsQuery = clientsQuery.in('id', allowedIds);
    requestsQuery = requestsQuery.in('id', allowedIds);
    archivedQuery = archivedQuery.in('id', allowedIds);
  }

  const [allResult, teamResult, clientsResult, requestsResult, archivedResult] = await Promise.all([
    allQuery,
    teamQuery,
    clientsQuery,
    requestsQuery,
    archivedQuery,
  ]);

  return {
    all: allResult.count || 0,
    team: teamResult.count || 0,
    clients: clientsResult.count || 0,
    requests: requestsResult.count || 0,
    archived: archivedResult.count || 0,
  };
}

/**
 * Get total unread message count across all conversations
 * Used for sidebar badge
 */
export async function getTotalUnreadCount(userContext?: UserContext): Promise<number> {
  // Check if user needs filtered view
  const needsParticipantFilter = userContext && !FULL_ACCESS_ROLES.includes(userContext.userRole);

  let query = supabase
    .from('mc_conversations')
    .select('unread_count')
    .eq('status', 'active')
    .gt('unread_count', 0);

  // For filtered users, only count their allowed conversations
  if (needsParticipantFilter && userContext) {
    const { data: userContact } = await supabase
      .from('mc_contacts')
      .select('id')
      .eq('employee_id', userContext.userId)
      .single();

    if (!userContact) return 0;

    const { data: participations } = await supabase
      .from('mc_conversation_participants')
      .select('conversation_id')
      .eq('contact_id', userContact.id)
      .is('left_at', null);

    const allowedIds = (participations || []).map(p => p.conversation_id);

    // Also include conversations where they are the primary contact
    const { data: directConversations } = await supabase
      .from('mc_conversations')
      .select('id')
      .eq('contact_id', userContact.id);

    if (directConversations) {
      allowedIds.push(...directConversations.map(c => c.id));
    }

    if (allowedIds.length === 0) return 0;

    query = query.in('id', [...new Set(allowedIds)]);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[MC] Error getting unread count:', error);
    return 0;
  }

  // Sum up all unread counts
  return (data || []).reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
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
      attachments:mc_attachments(*),
      sender:user_profiles!from_user_id(id, full_name, avatar_url)
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
    is_group: message.is_group,
    group_recipients_count: message.group_recipients?.length,
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
      from_user_id: message.from_user_id,
      status: 'sending',
      sent_at: new Date().toISOString(),
      metadata: message.is_group ? {
        is_group_message: true,
        recipient_count: message.group_recipients?.length
      } : undefined
    })
    .select()
    .single();

  if (error) throw error;

  // 2. Call Netlify function to send via Twilio (for SMS/MMS)
  if (message.channel === 'sms') {
    // MMS Group messaging
    if (message.is_group && message.group_recipients && message.group_recipients.length > 0) {
      console.log('[MC MMS Group] Sending to:', message.group_recipients.length, 'recipients, message_id:', data.id);
      try {
        const response = await fetch('/.netlify/functions/send-mc-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message_id: data.id,
            conversation_id: message.conversation_id,
            is_group: true,
            recipients: message.group_recipients,
            body: message.body,
          }),
        });

        const responseData = await response.json();
        console.log('[MC MMS Group] Response:', response.status, responseData);

        if (!response.ok) {
          console.error('[MC MMS Group] Failed:', responseData);
          throw new Error(responseData.error || 'Failed to send group MMS');
        }
      } catch (err) {
        console.error('[MC MMS Group] Error:', err);
        throw err;
      }
    }
    // Single SMS
    else if (message.to_phone) {
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
          throw new Error(responseData.error || 'Failed to send SMS');
        }
      } catch (err) {
        console.error('[MC SMS] Error:', err);
        throw err;
      }
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
