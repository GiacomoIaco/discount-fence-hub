// Chat TypeScript Types for Direct Messaging

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  is_deleted: boolean;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  name: string | null;
  is_group: boolean;
  created_by: string | null;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_archived: boolean;
}

export interface UserPresence {
  user_id: string;
  last_seen_at: string;
  status: 'online' | 'away' | 'offline';
  updated_at: string;
}

export interface Mention {
  id: string;
  message_id: string | null;
  request_note_id: string | null;
  mentioned_user_id: string;
  mentioner_id: string;
  created_at: string;
  is_read: boolean;
}

// Enhanced conversation with user details (from get_user_conversations function)
export interface ConversationWithDetails {
  conversation_id: string;
  conversation_name: string | null;
  is_group: boolean;
  other_user_id: string | null;
  other_user_name: string | null;
  other_user_email: string | null;
  other_user_status: 'online' | 'away' | 'offline';
  participant_count: number;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  last_read_at: string;
}

// Participant with user info
export interface ParticipantWithDetails {
  user_id: string;
  full_name: string;
  email: string;
  status: 'online' | 'away' | 'offline';
}

// For message display with sender info
export interface MessageWithSender extends DirectMessage {
  sender_name: string;
  sender_email: string;
  is_own_message: boolean;
}

// Typing indicator
export interface TypingIndicator {
  user_id: string;
  user_name: string;
  conversation_id: string;
}

// File attachment data
export interface FileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}
