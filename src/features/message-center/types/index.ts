// Message Center Types

export type MessageChannel = 'sms' | 'email' | 'in_app' | 'system';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';
export type ConversationType = 'client' | 'team_direct' | 'team_group' | 'system';
export type ConversationStatus = 'active' | 'archived' | 'muted';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'urgent';

export interface Contact {
  id: string;
  contact_type: 'client' | 'employee' | 'vendor';
  display_name: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  context_label?: string;  // Additional context (community name, property address, etc.)
  phone_primary?: string;
  phone_secondary?: string;
  email_primary?: string;
  email_secondary?: string;
  client_id?: string;
  employee_id?: string;
  avatar_url?: string;
  sms_opted_out: boolean;
  sms_opted_out_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  title?: string;
  quo_conversation_id?: string;
  contact_id?: string;
  contact?: Contact;
  // Group conversation fields
  is_group: boolean;
  group_avatar_url?: string;
  participant_count: number;
  participants?: ConversationParticipant[];
  // Status
  status: ConversationStatus;
  last_message_at?: string;
  last_message_preview?: string;
  last_message_direction?: MessageDirection;
  unread_count: number;
  linked_project_id?: string;
  has_project_signal: boolean;
  project_confidence?: number;
  sentiment?: Sentiment;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  contact_id: string;
  contact?: Contact;
  role: 'owner' | 'admin' | 'member';
  is_muted: boolean;
  muted_until?: string;
  joined_at: string;
  left_at?: string;
  added_by?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  quo_message_id?: string;
  body: string;
  body_html?: string;
  subject?: string;
  from_contact_id?: string;
  from_user_id?: string;
  from_phone?: string;
  from_email?: string;
  to_phone?: string;
  to_email?: string;
  status: MessageStatus;
  status_updated_at: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  ai_analysis?: AIAnalysis;
  is_project_signal: boolean;
  project_confidence?: number;
  extracted_data?: ExtractedData;
  sentiment?: Sentiment;
  attachments?: Attachment[];
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  quo_media_id?: string;
  created_at: string;
}

export interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
  category: string;
  is_global: boolean;
  created_by: string | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShortcodeContext {
  // Contact info
  client_name?: string;
  client_first_name?: string;
  client_phone?: string;
  client_email?: string;
  company_name?: string;

  // Property/Project info
  property_address?: string;
  community_name?: string;

  // User info
  user_name?: string;
  user_phone?: string;

  // Quote/Invoice
  quote_amount?: string;
  quote_link?: string;
  invoice_link?: string;

  // Scheduling
  scheduled_date?: string;
  scheduled_time?: string;
  eta_minutes?: string;
  delay_minutes?: string;

  // Company
  company_phone?: string;
  booking_link?: string;
}

export type QuickReplyCategory =
  | 'greeting'
  | 'field'
  | 'sales'
  | 'scheduling'
  | 'completion'
  | 'payment'
  | 'general';

export interface AIAnalysis {
  isProjectSignal: boolean;
  projectConfidence: number;
  extractedData?: ExtractedData;
  sentiment: Sentiment;
  sentimentConfidence: number;
  sentimentSignals: string[];
}

export interface ExtractedData {
  footage?: number;
  fenceHeight?: string;
  fenceType?: string;
  fenceStyle?: string;
  address?: string;
  targetDate?: string;
  targetDateContext?: string;
  gateCount?: number;
  gateTypes?: string[];
  specialRequests?: string;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ConversationWithContact extends Omit<Conversation, 'contact'> {
  contact: Contact | null;
}

export interface NewMessage {
  conversation_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  to_phone?: string;
  to_email?: string;
}

// Filter types for sidebar
export type ConversationFilter = 'all' | 'team' | 'clients' | 'requests' | 'archived';

// Advanced client filters
export interface ClientFilters {
  businessUnit?: 'residential' | 'commercial' | 'builders';
  city?: string;
  state?: string;
}

export interface ConversationCounts {
  all: number;
  team: number;
  clients: number;
  requests: number;
  archived: number;
}

// ============================================================================
// SYSTEM NOTIFICATIONS
// ============================================================================

export type NotificationType =
  | 'quote_viewed'
  | 'quote_signed'
  | 'quote_expired'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'invoice_partial'
  | 'job_status_change'
  | 'job_scheduled'
  | 'job_completed'
  | 'booking_request'
  | 'client_created'
  | 'message_received'
  | 'mention'
  | 'assignment'
  | 'reminder'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SystemNotification {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;

  // Linked entities
  contact_id?: string;
  conversation_id?: string;
  client_id?: string;
  project_id?: string;
  quote_id?: string;
  invoice_id?: string;
  job_id?: string;

  // Targeting
  target_user_id?: string;
  target_role?: string;

  // Status
  is_read: boolean;
  read_at?: string;
  read_by?: string;
  is_actioned: boolean;
  actioned_at?: string;

  // Action
  action_url?: string;
  action_label?: string;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at?: string;

  // Joined data
  contact?: Contact;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;

  // Per-type settings
  quote_viewed: boolean;
  quote_signed: boolean;
  quote_expired: boolean;
  invoice_paid: boolean;
  invoice_overdue: boolean;
  job_status_change: boolean;
  booking_request: boolean;
  client_created: boolean;
  mention: boolean;

  // Delivery channels
  show_in_app: boolean;
  send_email: boolean;
  send_sms: boolean;

  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export interface NotificationGroup {
  date: string;
  notifications: SystemNotification[];
}
