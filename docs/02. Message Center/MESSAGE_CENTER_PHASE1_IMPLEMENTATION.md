# Message Center - Phase 1 Implementation
## Core Infrastructure (Claude Code Ready)

**Estimated Time:** 2-3 hours  
**Prerequisites:** Supabase project connected, QUO account active  
**Outcome:** Working conversation list + message thread + send SMS

---

## Step 1: Database Migration

Run this SQL in Supabase SQL Editor:

```sql
-- ============================================================================
-- MESSAGE CENTER PHASE 1 - CORE TABLES
-- Run in Supabase SQL Editor
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Message Channel Enum
DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('sms', 'email', 'in_app', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Message Direction Enum
DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Message Status Enum
DO $$ BEGIN
  CREATE TYPE message_status AS ENUM (
    'sending', 'sent', 'delivered', 'read', 'failed', 'received'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Conversation Type Enum
DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM (
    'client', 'team_direct', 'team_group', 'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('client', 'employee', 'vendor')),
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  email_primary TEXT,
  email_secondary TEXT,
  client_id UUID REFERENCES clients(id),
  employee_id UUID REFERENCES auth.users(id),
  avatar_url TEXT,
  sms_opted_out BOOLEAN DEFAULT FALSE,
  sms_opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_contacts_phone ON mc_contacts(phone_primary);
CREATE INDEX IF NOT EXISTS idx_mc_contacts_client ON mc_contacts(client_id);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_type conversation_type NOT NULL DEFAULT 'client',
  title TEXT,
  quo_conversation_id TEXT UNIQUE,
  contact_id UUID REFERENCES mc_contacts(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'muted')),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction message_direction,
  unread_count INTEGER DEFAULT 0,
  linked_project_id UUID,
  has_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_mc_conversations_contact ON mc_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_status ON mc_conversations(status);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_last_message ON mc_conversations(last_message_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id) ON DELETE CASCADE,
  channel message_channel NOT NULL DEFAULT 'sms',
  direction message_direction NOT NULL,
  quo_message_id TEXT UNIQUE,
  body TEXT NOT NULL,
  body_html TEXT,
  subject TEXT,
  from_contact_id UUID REFERENCES mc_contacts(id),
  from_user_id UUID REFERENCES auth.users(id),
  from_phone TEXT,
  from_email TEXT,
  to_phone TEXT,
  to_email TEXT,
  status message_status DEFAULT 'sending',
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  ai_analysis JSONB,
  is_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  extracted_data JSONB,
  sentiment TEXT,
  forwarded_from_message_id UUID REFERENCES mc_messages(id),
  forwarded_by UUID REFERENCES auth.users(id),
  forwarded_at TIMESTAMPTZ,
  forward_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_mc_messages_conversation ON mc_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mc_messages_created ON mc_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_messages_quo ON mc_messages(quo_message_id);

-- ============================================================================
-- ATTACHMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS mc_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES mc_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  quo_media_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_attachments_message ON mc_attachments(message_id);

-- ============================================================================
-- TRIGGER: Update conversation on new message
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE mc_conversations 
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 100),
    last_message_direction = NEW.direction,
    unread_count = CASE 
      WHEN NEW.direction = 'inbound' THEN unread_count + 1 
      ELSE unread_count 
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON mc_messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON mc_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE mc_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mc_attachments ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
CREATE POLICY "Users can view all contacts" ON mc_contacts FOR SELECT USING (true);
CREATE POLICY "Users can insert contacts" ON mc_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update contacts" ON mc_contacts FOR UPDATE USING (true);

CREATE POLICY "Users can view all conversations" ON mc_conversations FOR SELECT USING (true);
CREATE POLICY "Users can insert conversations" ON mc_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update conversations" ON mc_conversations FOR UPDATE USING (true);

CREATE POLICY "Users can view all messages" ON mc_messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON mc_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update messages" ON mc_messages FOR UPDATE USING (true);

CREATE POLICY "Users can view all attachments" ON mc_attachments FOR SELECT USING (true);
CREATE POLICY "Users can insert attachments" ON mc_attachments FOR INSERT WITH CHECK (true);

-- ============================================================================
-- Enable Realtime
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE mc_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE mc_messages;
```

---

## Step 2: Create TypeScript Types

Create file: `src/features/message-center/types/index.ts`

```typescript
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

export interface ConversationWithContact extends Conversation {
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
```

---

## Step 3: Create Services

Create file: `src/features/message-center/services/messageService.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { 
  Conversation, 
  ConversationWithContact, 
  Message, 
  NewMessage,
  Contact 
} from '../types';

// ============================================================================
// CONVERSATIONS
// ============================================================================

export async function getConversations(): Promise<ConversationWithContact[]> {
  const { data, error } = await supabase
    .from('mc_conversations')
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data || [];
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
  // Insert message with 'sending' status
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

  // TODO: In Phase 2, call QUO API to actually send SMS
  // For now, immediately mark as 'sent'
  const { data: updatedMessage, error: updateError } = await supabase
    .from('mc_messages')
    .update({ status: 'sent' })
    .eq('id', data.id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updatedMessage;
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
```

---

## Step 4: Create Hooks

Create file: `src/features/message-center/hooks/useConversations.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as messageService from '../services/messageService';
import type { ConversationWithContact } from '../types';

export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mc_conversations'],
    queryFn: messageService.getConversations,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const subscription = messageService.subscribeToConversations((payload) => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['mc_conversation', id],
    queryFn: () => id ? messageService.getConversation(id) : null,
    enabled: !!id,
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: messageService.markConversationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: messageService.archiveConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    },
  });
}
```

Create file: `src/features/message-center/hooks/useMessages.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import * as messageService from '../services/messageService';
import type { NewMessage } from '../types';

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mc_messages', conversationId],
    queryFn: () => conversationId ? messageService.getMessages(conversationId) : [],
    enabled: !!conversationId,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!conversationId) return;

    const subscription = messageService.subscribeToMessages(conversationId, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['mc_messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: NewMessage) => messageService.sendMessage(message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['mc_messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['mc_conversations'] });
    },
  });
}
```

---

## Step 5: Create UI Components

Create file: `src/features/message-center/components/ConversationList.tsx`

```typescript
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, User, Building2, AlertCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationWithContact } from '../types';

interface ConversationListProps {
  conversations: ConversationWithContact[];
  selectedId: string | null;
  onSelect: (conversation: ConversationWithContact) => void;
  isLoading?: boolean;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <MessageSquare className="w-12 h-12 mb-2 text-gray-300" />
        <p className="text-sm">No conversations yet</p>
      </div>
    );
  }

  // Group conversations
  const projectSignals = conversations.filter(c => c.has_project_signal);
  const needsAttention = conversations.filter(c => c.sentiment === 'negative' || c.sentiment === 'urgent');
  const regular = conversations.filter(c => !c.has_project_signal && c.sentiment !== 'negative' && c.sentiment !== 'urgent');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Project Signals Section */}
      {projectSignals.length > 0 && (
        <div className="mb-2">
          <div className="px-4 py-2 text-xs font-semibold text-orange-600 bg-orange-50 flex items-center gap-1">
            <Target className="w-3 h-3" />
            PROJECT DETECTED ({projectSignals.length})
          </div>
          {projectSignals.map(conv => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}
        </div>
      )}

      {/* Needs Attention Section */}
      {needsAttention.length > 0 && (
        <div className="mb-2">
          <div className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            NEEDS ATTENTION ({needsAttention.length})
          </div>
          {needsAttention.map(conv => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}
        </div>
      )}

      {/* Regular Conversations */}
      {regular.length > 0 && (
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
            ALL MESSAGES ({regular.length})
          </div>
          {regular.map(conv => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ConversationCardProps {
  conversation: ConversationWithContact;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationCard({ conversation, isSelected, onClick }: ConversationCardProps) {
  const contact = conversation.contact;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50 border-l-4 border-l-blue-600'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Contact Name */}
          <div className="flex items-center gap-2">
            {contact?.avatar_url ? (
              <img src={contact.avatar_url} className="w-8 h-8 rounded-full" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {contact?.display_name || 'Unknown'}
              </p>
              {contact?.company_name && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {contact.company_name}
                </p>
              )}
            </div>
          </div>

          {/* Last Message Preview */}
          <p className="mt-1 text-sm text-gray-600 truncate">
            {conversation.last_message_direction === 'outbound' && (
              <span className="text-gray-400">You: </span>
            )}
            {conversation.last_message_preview || 'No messages yet'}
          </p>

          {/* Badges */}
          <div className="mt-1 flex items-center gap-2">
            {conversation.has_project_signal && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                📍 {Math.round((conversation.project_confidence || 0) * 100)}% match
              </span>
            )}
            {conversation.sentiment === 'negative' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                🚨 Negative
              </span>
            )}
            {conversation.sentiment === 'urgent' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                ⚡ Urgent
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Time & Unread */}
        <div className="flex flex-col items-end ml-2">
          {conversation.last_message_at && (
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })}
            </span>
          )}
          {conversation.unread_count > 0 && (
            <span className="mt-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
              {conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
```

Create file: `src/features/message-center/components/MessageThread.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '../types';

interface MessageThreadProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p className="text-sm">No messages in this conversation</p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {Object.entries(groupedMessages).map(([date, msgs]) => (
        <div key={date}>
          {/* Date Divider */}
          <div className="flex items-center justify-center my-4">
            <span className="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
              {date}
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {msgs.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={cn(
      'flex',
      isOutbound ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'max-w-[70%] rounded-lg px-4 py-2',
        isOutbound 
          ? 'bg-blue-600 text-white rounded-br-none' 
          : 'bg-gray-100 text-gray-900 rounded-bl-none'
      )}>
        {/* Message Body */}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>

        {/* Footer: Time + Status */}
        <div className={cn(
          'flex items-center justify-end gap-1 mt-1',
          isOutbound ? 'text-blue-200' : 'text-gray-400'
        )}>
          <span className="text-xs">
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>

        {/* AI Detection Banner */}
        {message.is_project_signal && (
          <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
            🤖 Project signal detected ({Math.round((message.project_confidence || 0) * 100)}% confidence)
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3" />;
    case 'sent':
      return <Check className="w-3 h-3" />;
    case 'delivered':
    case 'read':
      return <CheckCheck className="w-3 h-3" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return null;
  }
}

function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};
  
  messages.forEach((message) => {
    const date = format(new Date(message.created_at), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });

  return groups;
}
```

Create file: `src/features/message-center/components/MessageComposer.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MessageComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageComposer({ 
  onSend, 
  disabled = false,
  placeholder = 'Type a message...'
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    
    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
        {/* Attachment Buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Attach image"
          >
            <Image className="w-5 h-5" />
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          />
          {/* Character count for SMS */}
          {message.length > 0 && (
            <span className={cn(
              'absolute bottom-2 right-2 text-xs',
              message.length > 160 ? 'text-orange-500' : 'text-gray-400'
            )}>
              {message.length}/160
            </span>
          )}
        </div>

        {/* Send Button */}
        <Button
          type="submit"
          disabled={!message.trim() || disabled}
          className="px-4 py-2"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-400">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}

// Helper
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
```

---

## Step 6: Create Main Page

Create file: `src/features/message-center/pages/MessageCenterPage.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowLeft, Phone, Mail, MoreVertical } from 'lucide-react';
import { ConversationList } from '../components/ConversationList';
import { MessageThread } from '../components/MessageThread';
import { MessageComposer } from '../components/MessageComposer';
import { useConversations, useMarkConversationRead } from '../hooks/useConversations';
import { useMessages, useSendMessage } from '../hooks/useMessages';
import type { ConversationWithContact } from '../types';

export function MessageCenterPage() {
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithContact | null>(null);
  const [isMobileThreadView, setIsMobileThreadView] = useState(false);

  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversation?.id || null);
  const markRead = useMarkConversationRead();
  const sendMessage = useSendMessage();

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const handleSelectConversation = (conv: ConversationWithContact) => {
    setSelectedConversation(conv);
    setIsMobileThreadView(true);
  };

  const handleSendMessage = (body: string) => {
    if (!selectedConversation) return;
    
    sendMessage.mutate({
      conversation_id: selectedConversation.id,
      channel: 'sms',
      direction: 'outbound',
      body,
      to_phone: selectedConversation.contact?.phone_primary
    });
  };

  const handleBack = () => {
    setIsMobileThreadView(false);
    setSelectedConversation(null);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Message Center</h1>
        </div>
        <div className="text-sm text-gray-500">
          {conversations.length} conversations
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List (hidden on mobile when thread is open) */}
        <div className={`
          w-full md:w-80 lg:w-96 border-r bg-white flex-shrink-0
          ${isMobileThreadView ? 'hidden md:block' : 'block'}
        `}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id || null}
            onSelect={handleSelectConversation}
            isLoading={conversationsLoading}
          />
        </div>

        {/* Message Thread */}
        <div className={`
          flex-1 flex flex-col bg-white
          ${!isMobileThreadView ? 'hidden md:flex' : 'flex'}
        `}>
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <div className="border-b px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back button (mobile only) */}
                  <button
                    onClick={handleBack}
                    className="md:hidden p-1 hover:bg-gray-100 rounded"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Contact Info */}
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.contact?.display_name || 'Unknown'}
                    </h2>
                    {selectedConversation.contact?.company_name && (
                      <p className="text-sm text-gray-500">
                        {selectedConversation.contact.company_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {selectedConversation.contact?.phone_primary && (
                    <a
                      href={`tel:${selectedConversation.contact.phone_primary}`}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                  {selectedConversation.contact?.email_primary && (
                    <a
                      href={`mailto:${selectedConversation.contact.email_primary}`}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                  <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <MessageThread messages={messages} isLoading={messagesLoading} />

              {/* Composer */}
              <MessageComposer
                onSend={handleSendMessage}
                disabled={sendMessage.isPending}
                placeholder={`Message ${selectedConversation.contact?.display_name || 'contact'}...`}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the list to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 7: Add Route

Add to your router (e.g., `src/App.tsx` or routes file):

```typescript
import { MessageCenterPage } from '@/features/message-center/pages/MessageCenterPage';

// Add route
<Route path="/messages" element={<MessageCenterPage />} />
```

---

## Step 8: Test Data (Optional)

Run this SQL to create test data:

```sql
-- Create test contact
INSERT INTO mc_contacts (contact_type, display_name, first_name, last_name, company_name, phone_primary)
VALUES ('client', 'John Smith', 'John', 'Smith', 'DR Horton - Lakewood', '+15125551234');

-- Create test conversation
INSERT INTO mc_conversations (conversation_type, contact_id, status)
SELECT 'client', id, 'active'
FROM mc_contacts
WHERE display_name = 'John Smith';

-- Create test messages
INSERT INTO mc_messages (conversation_id, channel, direction, body, status, from_phone, to_phone, created_at)
SELECT 
  c.id,
  'sms',
  'inbound',
  'Hey Marcus, we need 450ft of 6ft cedar at 2847 Lakewood Dr. Can you get us a quote? Hoping to start next Tuesday.',
  'received',
  '+15125551234',
  '+15125550100',
  NOW() - INTERVAL '1 hour'
FROM mc_conversations c
JOIN mc_contacts ct ON c.contact_id = ct.id
WHERE ct.display_name = 'John Smith';

INSERT INTO mc_messages (conversation_id, channel, direction, body, status, from_phone, to_phone, created_at)
SELECT 
  c.id,
  'sms',
  'outbound',
  'Hi John! I''ll get that quote over to you by end of day today. Thanks for reaching out!',
  'delivered',
  '+15125550100',
  '+15125551234',
  NOW() - INTERVAL '30 minutes'
FROM mc_conversations c
JOIN mc_contacts ct ON c.contact_id = ct.id
WHERE ct.display_name = 'John Smith';
```

---

## Verification Checklist

After implementation, verify:

- [ ] Database tables created successfully
- [ ] Conversation list loads and displays
- [ ] Clicking conversation shows messages
- [ ] Sending a message works (adds to thread)
- [ ] Real-time updates work (open in two tabs)
- [ ] Mobile layout works (responsive)
- [ ] Unread badges show correctly
- [ ] Message status icons display

---

## Next Phase Preview

**Phase 2: QUO Integration**
- Webhook handler for incoming SMS
- QUO API for sending SMS
- Message delivery status updates
- Phone number management

---

**End of Phase 1 Implementation Spec**
