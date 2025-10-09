import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  is_deleted: boolean;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_archived: boolean;
}

export interface Mention {
  id: string;
  message_id?: string;
  request_note_id?: string;
  mentioned_user_id: string;
  mentioner_id: string;
  created_at: string;
  is_read: boolean;
}

export interface ConversationWithDetails extends Conversation {
  participants: ConversationParticipant[];
  lastMessage?: DirectMessage;
  unreadCount: number;
  otherUser?: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================
// CONVERSATIONS
// ============================================

/**
 * Get or create a direct conversation with another user
 */
export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    other_user_id: otherUserId
  });

  if (error) {
    console.error('Failed to get/create conversation:', error);
    throw error;
  }

  return data as string;
}

/**
 * Get all conversations for current user
 */
export async function getConversations(): Promise<ConversationWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get conversations where user is a participant
  const { data: participants, error: participantsError } = await supabase
    .from('conversation_participants')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', false);

  if (participantsError) throw participantsError;
  if (!participants || participants.length === 0) return [];

  const conversationIds = participants.map(p => p.conversation_id);

  // Get conversation details
  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('last_message_at', { ascending: false });

  if (conversationsError) throw conversationsError;

  // Get all participants for these conversations
  const { data: allParticipants, error: allParticipantsError } = await supabase
    .from('conversation_participants')
    .select('*')
    .in('conversation_id', conversationIds);

  if (allParticipantsError) throw allParticipantsError;

  // Get last message for each conversation
  const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
    (conversations || []).map(async (conv) => {
      const convParticipants = allParticipants?.filter(p => p.conversation_id === conv.id) || [];
      const currentUserParticipant = convParticipants.find(p => p.user_id === user.id);
      const otherUserParticipant = convParticipants.find(p => p.user_id !== user.id);

      // Get last message
      const { data: lastMessage } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get unread count
      const { data: unreadMessages } = await supabase
        .from('direct_messages')
        .select('id')
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .gt('created_at', currentUserParticipant?.last_read_at || '1970-01-01')
        .eq('is_deleted', false);

      // Get other user's profile
      let otherUser;
      if (otherUserParticipant) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('id', otherUserParticipant.user_id)
          .single();

        if (profile) {
          otherUser = {
            id: profile.id,
            name: profile.full_name || profile.email,
            email: profile.email
          };
        }
      }

      return {
        ...conv,
        participants: convParticipants,
        lastMessage: lastMessage || undefined,
        unreadCount: unreadMessages?.length || 0,
        otherUser
      };
    })
  );

  return conversationsWithDetails;
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to get messages:', error);
    throw error;
  }

  return data as DirectMessage[];
}

/**
 * Send a message to a conversation
 */
export async function sendMessage(conversationId: string, content: string): Promise<DirectMessage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to send message:', error);
    throw error;
  }

  // Extract @mentions and create mention records
  await processMentions(data.id, content);

  return data as DirectMessage;
}

/**
 * Mark a conversation as read
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    conv_id: conversationId
  });

  if (error) {
    console.error('Failed to mark conversation as read:', error);
  }
}

/**
 * Get unread direct messages count
 */
export async function getUnreadMessagesCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_direct_messages_count');

  if (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }

  return data || 0;
}

// ============================================
// MENTIONS
// ============================================

/**
 * Extract mentions from text and create mention records
 */
async function processMentions(messageId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Extract @mentions using regex
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex);

  if (!mentions || mentions.length === 0) return;

  // Remove @ symbol and get unique usernames
  const usernames = [...new Set(mentions.map(m => m.substring(1)))];

  // Get user IDs from usernames (assuming username = email prefix or full_name)
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .or(usernames.map(u => `email.ilike.${u}%,full_name.ilike.%${u}%`).join(','));

  if (!users || users.length === 0) return;

  // Create mention records
  const mentionRecords = users.map(mentionedUser => ({
    message_id: messageId,
    mentioned_user_id: mentionedUser.id,
    mentioner_id: user.id
  }));

  await supabase
    .from('mentions')
    .insert(mentionRecords);
}

/**
 * Process mentions in request notes
 */
export async function processRequestNoteMentions(requestNoteId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Extract @mentions using regex
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex);

  if (!mentions || mentions.length === 0) return;

  // Remove @ symbol and get unique usernames
  const usernames = [...new Set(mentions.map(m => m.substring(1)))];

  // Get user IDs from usernames
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .or(usernames.map(u => `email.ilike.${u}%,full_name.ilike.%${u}%`).join(','));

  if (!users || users.length === 0) return;

  // Create mention records
  const mentionRecords = users.map(mentionedUser => ({
    request_note_id: requestNoteId,
    mentioned_user_id: mentionedUser.id,
    mentioner_id: user.id
  }));

  await supabase
    .from('mentions')
    .insert(mentionRecords);
}

/**
 * Get mentions for current user
 */
export async function getMentions(): Promise<Mention[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('mentions')
    .select('*')
    .eq('mentioned_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get mentions:', error);
    throw error;
  }

  return data as Mention[];
}

/**
 * Get unread mentions count
 */
export async function getUnreadMentionsCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_mentions_count');

  if (error) {
    console.error('Failed to get unread mentions count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Mark mention as read
 */
export async function markMentionRead(mentionId: string): Promise<void> {
  const { error } = await supabase
    .from('mentions')
    .update({ is_read: true })
    .eq('id', mentionId);

  if (error) {
    console.error('Failed to mark mention as read:', error);
  }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToConversation(
  conversationId: string,
  callback: (message: DirectMessage) => void
) {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        callback(payload.new as DirectMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to new mentions for current user
 */
export function subscribeToMentions(callback: (mention: Mention) => void) {
  const channel = supabase
    .channel('user_mentions')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mentions'
      },
      (payload) => {
        callback(payload.new as Mention);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
