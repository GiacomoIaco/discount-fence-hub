# Message Center - Workiz-Style Implementation Specification

**Version:** 1.0  
**Created:** December 2024  
**For:** Claude Code Implementation  
**Status:** Ready for Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Feature Analysis: Workiz Message Center](#2-feature-analysis-workiz-message-center)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [UI Specifications](#5-ui-specifications)
6. [Core Features](#6-core-features)
7. [Integration Points](#7-integration-points)
8. [API Endpoints](#8-api-endpoints)
9. [Implementation Phases](#9-implementation-phases)
10. [Component Specifications](#10-component-specifications)

---

## 1. Executive Summary

### What We're Building

A unified Message Center that consolidates ALL business communications into a single, actionable interface—identical to Workiz's approach but tailored for Discount Fence USA's fence installation workflow.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Omni-Channel Inbox** | SMS, Email, In-App, System notifications in one view |
| **Client Conversations** | External SMS/Email via QUO integration |
| **Team Chat** | Internal 1:1 and group messaging (free, in-app) |
| **Quick Replies** | Template messages with shortcode placeholders |
| **Right-Pane Messaging** | Message anyone without leaving current page |
| **Job/Lead Creation** | Convert conversations to projects with one click |
| **Smart Messaging** | AI-powered suggestions and autocomplete |
| **System Notifications** | Quote viewed, invoice paid, job status changes |
| **Message Status Tracking** | Sent, Delivered, Read, Failed indicators |

### Business Value

- **Never miss a message** - All channels in one place
- **Faster response times** - Quick replies and AI suggestions
- **Seamless workflow** - Create jobs directly from conversations
- **Team coordination** - Free in-app messaging for crews
- **Client visibility** - Know when quotes are viewed
- **Management oversight** - See all rep communications

---

## 2. Feature Analysis: Workiz Message Center

### 2.1 Core Features from Workiz

Based on comprehensive research, Workiz Message Center includes:

#### Communication Channels
- **SMS** - Text messages to/from clients via Workiz Phone
- **Email** - Send/receive emails within the platform
- **In-App Messages** - Free team messaging (up to 200 users per group)
- **Voicemail Transcription** - Missed calls transcribed to text

#### Workflow Integration
- **Book Jobs from Messages** - Detect contact info, create jobs with one click
- **Edit Jobs from Messages** - Reschedule, reassign without leaving conversation
- **Right-Pane Messaging** - Message from any page via slide-out panel
- **Contact Auto-Linking** - Messages linked to client records automatically

#### Productivity Features
- **Quick Replies** - Template messages with shortcodes like `{{client_name}}`, `{{booking_link}}`
- **AI Smart Messaging** - Auto-complete, professional rewrites, suggested replies
- **File/Image Attachments** - Send documents, photos, PDFs
- **Message Status** - Sent, Delivered, Read, Failed indicators

#### System Notifications
- Quote/Estimate viewed
- Invoice paid
- Document signed
- Booking request received
- Job status changes

#### Message Organization
- **Conversation List** - Sortable, searchable, filterable
- **Unread Count Badges** - Per conversation and global
- **Message Forwarding** - Forward to other team members
- **Conversation Search** - Find past messages quickly

---

## 3. System Architecture

### 3.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MESSAGE CENTER ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        EXTERNAL CHANNELS                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │    QUO      │  │   Email     │  │  Voicemail  │  │   Future:   │   │  │
│  │  │   (SMS)     │  │   (SMTP)    │  │   (QUO)     │  │   Twilio    │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘   │  │
│  │         │                │                │                            │  │
│  └─────────┼────────────────┼────────────────┼────────────────────────────┘  │
│            │                │                │                               │
│            ▼                ▼                ▼                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     SUPABASE EDGE FUNCTIONS                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │ │
│  │  │ quo-webhook     │  │ email-webhook   │  │ analyze-message │          │ │
│  │  │ Receives SMS    │  │ Receives Email  │  │ AI Analysis     │          │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │ │
│  │           │                    │                    │                    │ │
│  └───────────┼────────────────────┼────────────────────┼────────────────────┘ │
│              │                    │                    │                      │
│              ▼                    ▼                    ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      SUPABASE DATABASE                                  │ │
│  │                                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │ conversations│  │   messages   │  │quick_replies │  │system_notifs │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  │                                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  contacts    │  │ team_chats   │  │ attachments  │  │ message_status│ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      │ Realtime Subscriptions                │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        REACT APPLICATION                                │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    MESSAGE CENTER HUB                               │ │ │
│  │  │                                                                      │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │ │ │
│  │  │  │Conversation │  │  Message    │  │  Context    │                  │ │ │
│  │  │  │   List      │  │   Thread    │  │   Panel     │                  │ │ │
│  │  │  │  (Left)     │  │  (Center)   │  │  (Right)    │                  │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                  │ │ │
│  │  │                                                                      │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                   RIGHT-PANE MESSAGING                              │ │ │
│  │  │  (Slide-out panel accessible from any page in the app)             │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Message Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MESSAGE FLOW DIAGRAM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INBOUND (Client → DFU)                                                      │
│  ──────────────────────                                                      │
│                                                                              │
│  1. Client texts rep's QUO number                                            │
│  2. QUO sends webhook to Supabase Edge Function                             │
│  3. Edge Function:                                                           │
│     a. Stores message in `messages` table                                   │
│     b. Updates `conversations` table                                        │
│     c. Triggers AI analysis (async)                                         │
│     d. Matches to client record if possible                                 │
│  4. Realtime subscription pushes to UI                                       │
│  5. Rep sees message with notification                                       │
│                                                                              │
│  OUTBOUND (DFU → Client)                                                     │
│  ───────────────────────                                                     │
│                                                                              │
│  1. Rep composes message in Message Center                                   │
│  2. Message saved to `messages` table (status: 'sending')                   │
│  3. API call to QUO to send SMS                                             │
│  4. QUO webhook confirms delivery                                            │
│  5. Status updated to 'delivered'                                            │
│  6. UI reflects delivery status                                              │
│                                                                              │
│  INTERNAL (Team ↔ Team)                                                      │
│  ──────────────────────                                                      │
│                                                                              │
│  1. User sends message in team chat                                          │
│  2. Message saved to `team_messages` table                                  │
│  3. Realtime pushes to all participants                                      │
│  4. No external API needed (free, in-app)                                   │
│                                                                              │
│  SYSTEM NOTIFICATIONS                                                        │
│  ────────────────────                                                        │
│                                                                              │
│  1. Event occurs (quote viewed, invoice paid, etc.)                         │
│  2. Database trigger creates `system_notification`                          │
│  3. Realtime pushes to Message Center                                        │
│  4. User sees notification in unified inbox                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- ============================================================================
-- MESSAGE CENTER DATABASE SCHEMA
-- ============================================================================

-- Message Channels Enum
CREATE TYPE message_channel AS ENUM ('sms', 'email', 'in_app', 'system');

-- Message Direction Enum
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

-- Message Status Enum
CREATE TYPE message_status AS ENUM (
  'sending',      -- Being sent
  'sent',         -- Sent to provider
  'delivered',    -- Confirmed delivered
  'read',         -- Read by recipient
  'failed',       -- Failed to send
  'received'      -- Inbound message received
);

-- Conversation Type Enum
CREATE TYPE conversation_type AS ENUM (
  'client',       -- External client conversation
  'team_direct',  -- 1:1 internal chat
  'team_group',   -- Group internal chat
  'system'        -- System notifications channel
);

-- ============================================================================
-- CONTACTS (unified contact registry)
-- ============================================================================
CREATE TABLE mc_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Contact Type
  contact_type TEXT NOT NULL CHECK (contact_type IN ('client', 'employee', 'vendor')),
  
  -- Core Info
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  
  -- Contact Methods
  phone_primary TEXT,
  phone_secondary TEXT,
  email_primary TEXT,
  email_secondary TEXT,
  
  -- External Linkage
  client_id UUID REFERENCES clients(id),          -- Link to Client Hub
  employee_id UUID REFERENCES auth.users(id),     -- Link to User
  
  -- Avatar
  avatar_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_contacts_phone ON mc_contacts(phone_primary);
CREATE INDEX idx_mc_contacts_email ON mc_contacts(email_primary);
CREATE INDEX idx_mc_contacts_client ON mc_contacts(client_id);
CREATE INDEX idx_mc_contacts_employee ON mc_contacts(employee_id);

-- ============================================================================
-- CONVERSATIONS (unified thread container)
-- ============================================================================
CREATE TABLE mc_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Conversation Identity
  conversation_type conversation_type NOT NULL,
  title TEXT,                                     -- For groups: "ATX Crew Chat"
  
  -- External IDs
  quo_conversation_id TEXT UNIQUE,                -- QUO's conversation ID
  external_thread_id TEXT,                        -- Email thread ID
  
  -- For client conversations: primary contact
  contact_id UUID REFERENCES mc_contacts(id),
  
  -- For group chats: name and settings
  group_name TEXT,
  max_participants INTEGER DEFAULT 200,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'muted')),
  
  -- Last Activity
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction message_direction,
  unread_count INTEGER DEFAULT 0,
  
  -- Linked Entities (for client conversations)
  linked_project_id UUID REFERENCES bom_projects(id),
  linked_quote_id UUID,
  linked_job_id UUID,
  
  -- AI Analysis Summary (from Project Radar)
  has_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_mc_conversations_type ON mc_conversations(conversation_type);
CREATE INDEX idx_mc_conversations_contact ON mc_conversations(contact_id);
CREATE INDEX idx_mc_conversations_status ON mc_conversations(status);
CREATE INDEX idx_mc_conversations_last_message ON mc_conversations(last_message_at DESC);
CREATE INDEX idx_mc_conversations_project_signal ON mc_conversations(has_project_signal) WHERE has_project_signal = TRUE;

-- ============================================================================
-- CONVERSATION PARTICIPANTS (for group chats and multi-party)
-- ============================================================================
CREATE TABLE mc_conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Participant Role
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- Individual Settings
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  
  -- Status
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  -- Notifications
  notification_preference TEXT DEFAULT 'all' CHECK (
    notification_preference IN ('all', 'mentions', 'none')
  ),
  
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_mc_participants_conversation ON mc_conversation_participants(conversation_id);
CREATE INDEX idx_mc_participants_user ON mc_conversation_participants(user_id);

-- ============================================================================
-- MESSAGES (all message types)
-- ============================================================================
CREATE TABLE mc_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id) ON DELETE CASCADE,
  
  -- Message Identity
  channel message_channel NOT NULL,
  direction message_direction NOT NULL,
  
  -- External IDs
  quo_message_id TEXT UNIQUE,
  external_message_id TEXT,                       -- Email Message-ID
  
  -- Content
  body TEXT NOT NULL,
  body_html TEXT,                                 -- For emails
  subject TEXT,                                   -- For emails
  
  -- Sender/Recipient
  from_contact_id UUID REFERENCES mc_contacts(id),
  from_user_id UUID REFERENCES auth.users(id),
  from_phone TEXT,
  from_email TEXT,
  to_phone TEXT,
  to_email TEXT,
  
  -- Status
  status message_status DEFAULT 'sending',
  status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  
  -- Delivery Tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- AI Analysis (from Project Radar)
  ai_analysis JSONB,                              -- Full analysis result
  is_project_signal BOOLEAN DEFAULT FALSE,
  project_confidence DECIMAL(3,2),
  extracted_data JSONB,                           -- Footage, address, etc.
  sentiment TEXT,
  
  -- Quick Reply Used
  quick_reply_id UUID REFERENCES mc_quick_replies(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB                                  -- Additional data
);

CREATE INDEX idx_mc_messages_conversation ON mc_messages(conversation_id);
CREATE INDEX idx_mc_messages_status ON mc_messages(status);
CREATE INDEX idx_mc_messages_created ON mc_messages(created_at DESC);
CREATE INDEX idx_mc_messages_project_signal ON mc_messages(is_project_signal) WHERE is_project_signal = TRUE;
CREATE INDEX idx_mc_messages_quo ON mc_messages(quo_message_id);

-- ============================================================================
-- MESSAGE ATTACHMENTS
-- ============================================================================
CREATE TABLE mc_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES mc_messages(id) ON DELETE CASCADE,
  
  -- File Info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,                        -- MIME type
  file_size INTEGER NOT NULL,                     -- Bytes
  file_url TEXT NOT NULL,                         -- Storage URL
  
  -- Thumbnail (for images)
  thumbnail_url TEXT,
  
  -- MMS specific
  quo_media_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_attachments_message ON mc_attachments(message_id);

-- ============================================================================
-- QUICK REPLIES (message templates)
-- ============================================================================
CREATE TABLE mc_quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Template Info
  name TEXT NOT NULL,                             -- "Booking Confirmation"
  shortcut TEXT,                                  -- "/book" to trigger
  category TEXT,                                  -- "Scheduling", "Follow-up"
  
  -- Content
  body TEXT NOT NULL,                             -- Template with shortcodes
  channel message_channel[],                      -- Which channels can use this
  
  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  is_global BOOLEAN DEFAULT FALSE,                -- Available to all users
  business_unit_id UUID,                          -- BU-specific templates
  
  -- Usage Stats
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_quick_replies_category ON mc_quick_replies(category);
CREATE INDEX idx_mc_quick_replies_global ON mc_quick_replies(is_global) WHERE is_global = TRUE;
CREATE INDEX idx_mc_quick_replies_shortcut ON mc_quick_replies(shortcut);

-- ============================================================================
-- SYSTEM NOTIFICATIONS
-- ============================================================================
CREATE TABLE mc_system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Target
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Notification Type
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'quote_viewed',
    'quote_signed',
    'invoice_paid',
    'invoice_overdue',
    'job_status_change',
    'booking_request',
    'mention',
    'assignment',
    'reminder',
    'system_alert'
  )),
  
  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT,                                      -- Icon name
  
  -- Related Entity
  entity_type TEXT,                               -- 'quote', 'invoice', 'job'
  entity_id UUID,
  entity_url TEXT,                                -- Deep link
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_mc_notifications_user ON mc_system_notifications(user_id);
CREATE INDEX idx_mc_notifications_unread ON mc_system_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_mc_notifications_created ON mc_system_notifications(created_at DESC);

-- ============================================================================
-- MESSAGE REACTIONS (for team chats)
-- ============================================================================
CREATE TABLE mc_message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES mc_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji TEXT NOT NULL,                            -- "👍", "❤️", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_mc_reactions_message ON mc_message_reactions(message_id);

-- ============================================================================
-- SCHEDULED MESSAGES
-- ============================================================================
CREATE TABLE mc_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES mc_conversations(id),
  
  -- Content
  channel message_channel NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,                              -- Pending attachments
  
  -- Schedule
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/Chicago',
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  sent_message_id UUID REFERENCES mc_messages(id),
  error_message TEXT,
  
  -- Creator
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mc_scheduled_pending ON mc_scheduled_messages(scheduled_for) WHERE status = 'pending';

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Unified Inbox View
CREATE OR REPLACE VIEW v_mc_inbox AS
SELECT 
  c.id,
  c.conversation_type,
  c.title,
  c.status,
  c.last_message_at,
  c.last_message_preview,
  c.last_message_direction,
  c.unread_count,
  c.has_project_signal,
  c.sentiment,
  c.linked_project_id,
  
  -- Contact Info
  ct.display_name AS contact_name,
  ct.company_name AS contact_company,
  ct.phone_primary AS contact_phone,
  ct.email_primary AS contact_email,
  ct.avatar_url AS contact_avatar,
  ct.client_id,
  
  -- Client Hub Link
  cl.company_name AS client_company_name,
  
  c.created_at,
  c.updated_at

FROM mc_conversations c
LEFT JOIN mc_contacts ct ON c.contact_id = ct.id
LEFT JOIN clients cl ON ct.client_id = cl.id
WHERE c.status != 'archived'
ORDER BY c.last_message_at DESC NULLS LAST;

-- User's Conversations View (with unread counts per user)
CREATE OR REPLACE VIEW v_mc_user_conversations AS
SELECT 
  c.*,
  p.user_id,
  p.is_muted,
  p.last_read_at,
  p.notification_preference,
  (
    SELECT COUNT(*) 
    FROM mc_messages m 
    WHERE m.conversation_id = c.id 
    AND m.created_at > COALESCE(p.last_read_at, '1970-01-01')
    AND m.from_user_id != p.user_id
  ) AS personal_unread_count
FROM mc_conversations c
JOIN mc_conversation_participants p ON c.id = p.conversation_id
WHERE p.left_at IS NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update conversation on new message
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

CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON mc_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- Create system notification on quote viewed
CREATE OR REPLACE FUNCTION create_quote_viewed_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.viewed_at IS NOT NULL AND OLD.viewed_at IS NULL THEN
    INSERT INTO mc_system_notifications (
      user_id,
      notification_type,
      title,
      body,
      entity_type,
      entity_id
    ) VALUES (
      NEW.created_by,
      'quote_viewed',
      'Quote Viewed',
      format('Your quote for %s was just viewed', NEW.project_name),
      'quote',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (Create similar triggers for invoice_paid, job_status_change, etc.)
```

---

## 5. UI Specifications

### 5.1 Message Center Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DFU Op Hub                                          [🔔 12] [🔍] [👤 Admin ▼]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [Dashboard] [BOM] [Client Hub] [Scheduling] [Message Center*] [Settings]       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────┬────────────────────────────────┬─────────────────────┐ │
│  │                     │                                │                      │ │
│  │  CONVERSATION LIST  │     MESSAGE THREAD             │   CONTEXT PANEL     │ │
│  │       (300px)       │        (Flex)                  │      (320px)        │ │
│  │                     │                                │                      │ │
│  │ ┌─────────────────┐ │ ┌────────────────────────────┐ │ ┌──────────────────┐ │ │
│  │ │ 🔍 Search...    │ │ │                            │ │ │  CONTACT INFO    │ │ │
│  │ └─────────────────┘ │ │  John Smith                │ │ │                  │ │ │
│  │                     │ │  DR Horton - Lakewood      │ │ │  John Smith      │ │ │
│  │ ┌─────────────────┐ │ │  +1 (512) 555-1234        │ │ │  Superintendent  │ │ │
│  │ │ Filter:         │ │ │                            │ │ │  DR Horton       │ │ │
│  │ │ [All ▼] [SMS ▼] │ │ ├────────────────────────────┤ │ │                  │ │ │
│  │ └─────────────────┘ │ │                            │ │ │  📱 (512) 555-   │ │ │
│  │                     │ │  ┌──────────────────────┐  │ │ │     1234         │ │ │
│  │ ─────────────────── │ │  │ 10:32 AM             │  │ │ │  📧 john@dr...   │ │ │
│  │ 📍 PROJECT SIGNALS  │ │  │ Hey Marcus, we need  │  │ │ │                  │ │ │
│  │ ─────────────────── │ │  │ 450ft of 6ft cedar   │  │ │ │  [📞 Call]       │ │ │
│  │                     │ │  │ at 2847 Lakewood Dr. │  │ │ │  [📧 Email]      │ │ │
│  │ ┌─────────────────┐ │ │  │ Can you get us a...  │  │ │ ├──────────────────┤ │ │
│  │ │ 🟢 John Smith   │ │ │  └──────────────────────┘  │ │ │                  │ │ │
│  │ │ DR Horton       │ │ │                            │ │ │  LINKED ENTITIES │ │ │
│  │ │ "Hey Marcus..." │ │ │  ┌──────────────────────┐  │ │ │                  │ │ │
│  │ │ 📍 95% match    │ │ │  │ You            10:45 │  │ │ │  📋 Projects (2) │ │ │
│  │ │         10:32 AM│ │ │  │ "I'll get that quote │  │ │ │  ├─ PRJ-2024-089 │ │ │
│  │ └─────────────────┘ │ │  │  over to you by end  │  │ │ │  └─ PRJ-2024-102 │ │ │
│  │                     │ │  │  of day today."      │  │ │ │                  │ │ │
│  │ ─────────────────── │ │  └──────────────────────┘  │ │ │  💰 Quotes (1)   │ │ │
│  │ ⚠️ NEEDS ATTENTION  │ │                            │ │ │  ├─ QUO-2024-456 │ │ │
│  │ ─────────────────── │ │                            │ │ │     $12,450      │ │ │
│  │                     │ │  ┌──────────────────────┐  │ │ │                  │ │ │
│  │ ┌─────────────────┐ │ │  │ 🤖 AI DETECTION      │  │ │ │  🔧 Jobs (1)     │ │ │
│  │ │ 🔴 Maria Lopez  │ │ │  │ ─────────────────── │  │ │ │  ├─ JOB-2024-789 │ │ │
│  │ │ Lennar          │ │ │  │ 450 LF | 6ft Cedar  │  │ │ │     Scheduled    │ │ │
│  │ │ "I've texted 3x"│ │ │  │ 2847 Lakewood Dr    │  │ │ ├──────────────────┤ │ │
│  │ │ 🚨 Negative     │ │ │  │ Target: Tue 12/17   │  │ │ │                  │ │ │
│  │ │          9:15 AM│ │ │  │                      │  │ │ │  QUICK ACTIONS   │ │ │
│  │ └─────────────────┘ │ │  │ [✅ Convert to Proj] │  │ │ │                  │ │ │
│  │                     │ │  └──────────────────────┘  │ │ │  [+ New Project] │ │ │
│  │ ─────────────────── │ │                            │ │ │  [+ New Quote]   │ │ │
│  │ 📬 ALL MESSAGES     │ ├────────────────────────────┤ │ │  [+ New Job]     │ │ │
│  │ ─────────────────── │ │                            │ │ │  [📅 Schedule]   │ │ │
│  │                     │ │ ┌────────────────────────┐ │ │ │                  │ │ │
│  │ ┌─────────────────┐ │ │ │ 📎 | 📷 | Type msg... │ │ │ ├──────────────────┤ │ │
│  │ │ 🟢 Sarah Chen   │ │ │ │              [Send ➤] │ │ │ │                  │ │ │
│  │ │ Taylor Morrison │ │ │ └────────────────────────┘ │ │ │  CONVERSATION    │ │ │
│  │ │ "Thanks for..." │ │ │                            │ │ │  HISTORY         │ │ │
│  │ │ ✓ Replied       │ │ │ Quick: [👋 Greeting]      │ │ │                  │ │ │
│  │ │       Yesterday │ │ │ [📅 Confirm] [📍 OMW]     │ │ │  32 messages     │ │ │
│  │ └─────────────────┘ │ │                            │ │ │  Started: 10/15  │ │ │
│  │                     │ │                            │ │ │                  │ │ │
│  │ [+ New Conversation]│ │                            │ │ │  [View All →]    │ │ │
│  │                     │ │                            │ │ │                  │ │ │
│  └─────────────────────┴────────────────────────────────┴─────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Message Center Layout (Mobile)

```
┌─────────────────────────────────────┐
│  ≡  Message Center           🔔 12  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔍 Search conversations...     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [All] [Clients] [Team] [Notifs]││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│  📍 PROJECT DETECTED                │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🟢 John Smith          10:32 AM ││
│  │    DR Horton - Lakewood         ││
│  │    "Hey Marcus, we need 450ft..." ││
│  │    📍 95% | ⚡ New              ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│  ⚠️ NEEDS ATTENTION                 │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔴 Maria Lopez          9:15 AM ││
│  │    Lennar - Stone Oak           ││
│  │    "I've texted you 3 times..." ││
│  │    🚨 Negative Sentiment        ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│  📬 RECENT                          │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Sarah Chen           Yesterday  ││
│  │ Taylor Morrison                 ││
│  │ "Thanks for the estimate!"      ││
│  │ ✓ Replied                       ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔵 Crew Alpha Chat    Yesterday ││
│  │ 4 members                       ││
│  │ Mike: "Loaded and ready to..."  ││
│  └─────────────────────────────────┘│
│                                     │
│                                     │
├─────────────────────────────────────┤
│      [+]  New Message               │
└─────────────────────────────────────┘
```

### 5.3 Right-Pane Messaging (Slide-Out)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ANY PAGE IN THE APP (e.g., Project Detail)                          [💬 ▼]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────┬──────────────────┐ │
│  │                                                          │                  │ │
│  │                                                          │  RIGHT-PANE      │ │
│  │                                                          │  MESSAGING       │ │
│  │                                                          │     (400px)      │ │
│  │              MAIN PAGE CONTENT                           │                  │ │
│  │                                                          │ ┌──────────────┐ │ │
│  │              (e.g., Project Details)                     │ │ 💬 Messages  │ │ │
│  │                                                          │ │              │ │ │
│  │                                                          │ │ John Smith   │ │ │
│  │                                                          │ │ DR Horton    │ │ │
│  │                                                          │ ├──────────────┤ │ │
│  │                                                          │ │              │ │ │
│  │                                                          │ │ [Message     │ │ │
│  │                                                          │ │  Thread]     │ │ │
│  │                                                          │ │              │ │ │
│  │                                                          │ │              │ │ │
│  │                                                          │ │              │ │ │
│  │                                                          │ ├──────────────┤ │ │
│  │                                                          │ │ Type msg...  │ │ │
│  │                                                          │ │    [Send ➤]  │ │ │
│  │                                                          │ └──────────────┘ │ │
│  │                                                          │                  │ │
│  └─────────────────────────────────────────────────────────┴──────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Core Features

### 6.1 Quick Replies System

Quick Replies allow users to send pre-written template messages with dynamic placeholders.

#### Shortcode Reference

| Shortcode | Description | Example Output |
|-----------|-------------|----------------|
| `{{client_name}}` | Client's full name | "John Smith" |
| `{{client_first}}` | Client's first name | "John" |
| `{{company_name}}` | Client's company | "DR Horton" |
| `{{project_address}}` | Project address | "2847 Lakewood Dr" |
| `{{rep_name}}` | Current user's name | "Marcus Rodriguez" |
| `{{rep_phone}}` | Rep's phone number | "(512) 555-0100" |
| `{{booking_link}}` | Online booking URL | "https://dfu.com/book/abc123" |
| `{{quote_amount}}` | Quote total | "$12,450.00" |
| `{{scheduled_date}}` | Job date | "Tuesday, Dec 17" |
| `{{scheduled_time}}` | Job time window | "8:00 AM - 12:00 PM" |
| `{{eta_minutes}}` | Minutes until arrival | "15" |
| `{{job_type}}` | Type of work | "6ft Cedar Fence" |

#### Default Quick Reply Templates

```typescript
const defaultQuickReplies = [
  {
    name: "Greeting",
    shortcut: "/hi",
    category: "General",
    body: "Hi {{client_first}}, this is {{rep_name}} from Discount Fence USA. How can I help you today?"
  },
  {
    name: "Quote Follow-Up",
    shortcut: "/follow",
    category: "Sales",
    body: "Hi {{client_first}}, just following up on the estimate I sent over for {{project_address}}. Do you have any questions I can answer?"
  },
  {
    name: "On My Way",
    shortcut: "/omw",
    category: "Field",
    body: "Hi {{client_first}}, this is {{rep_name}} from Discount Fence USA. I'm on my way and should arrive in about {{eta_minutes}} minutes."
  },
  {
    name: "Running Late",
    shortcut: "/late",
    category: "Field",
    body: "Hi {{client_first}}, I apologize but I'm running about {{eta_minutes}} minutes behind schedule. I'll be there as soon as possible."
  },
  {
    name: "Booking Confirmation",
    shortcut: "/confirm",
    category: "Scheduling",
    body: "Hi {{client_first}}, this confirms your appointment for {{scheduled_date}} between {{scheduled_time}}. We'll text you when we're on the way. Reply CONFIRM to confirm or call us to reschedule."
  },
  {
    name: "Job Complete",
    shortcut: "/done",
    category: "Field",
    body: "Hi {{client_first}}, we've completed the {{job_type}} installation at {{project_address}}. Please take a look and let us know if you have any questions. Thank you for choosing Discount Fence USA!"
  },
  {
    name: "Payment Reminder",
    shortcut: "/pay",
    category: "Billing",
    body: "Hi {{client_first}}, this is a friendly reminder that your invoice for {{quote_amount}} is due. You can pay online at {{booking_link}} or reply with any questions."
  }
];
```

### 6.2 AI Smart Messaging (Claude-Powered)

#### Features

1. **Auto-Complete** - Suggests message completions as you type
2. **Professional Rewrite** - Polish informal messages
3. **Suggested Replies** - Context-aware reply suggestions based on conversation history
4. **Sentiment Analysis** - Warn before sending potentially problematic messages

#### Implementation

```typescript
// Edge Function: smart-messaging
interface SmartMessagingRequest {
  action: 'autocomplete' | 'rewrite' | 'suggest_replies' | 'analyze';
  draft?: string;
  conversation_history?: Message[];
  client_context?: {
    name: string;
    company: string;
    open_jobs: Job[];
    last_interaction: Date;
  };
}

interface SmartMessagingResponse {
  // For autocomplete
  completion?: string;
  
  // For rewrite
  rewritten?: string;
  
  // For suggest_replies
  suggestions?: Array<{
    text: string;
    topic: string;  // "Schedule Appointment", "Answer Question", etc.
  }>;
  
  // For analyze
  sentiment?: 'positive' | 'neutral' | 'negative';
  warnings?: string[];  // "Message may come across as curt"
}
```

### 6.3 System Notifications

System notifications keep users informed about important events without requiring them to check each module.

#### Notification Types

| Type | Trigger | Icon | Priority |
|------|---------|------|----------|
| `quote_viewed` | Client opens quote link | 👁️ | Medium |
| `quote_signed` | Client signs proposal | ✍️ | High |
| `invoice_paid` | Payment received | 💰 | High |
| `invoice_overdue` | Invoice past due | ⚠️ | High |
| `job_status_change` | Job status updated | 🔄 | Medium |
| `booking_request` | New booking from website | 📅 | High |
| `mention` | Tagged in message/comment | 👤 | Medium |
| `assignment` | Assigned to job/project | 📋 | Medium |
| `reminder` | Scheduled reminder | ⏰ | Medium |
| `system_alert` | System-wide announcement | 📢 | Varies |

### 6.4 Conversation-to-Project Conversion

When AI detects a project signal, users can convert the conversation to a project with one click.

#### Conversion Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONVERT TO PROJECT MODAL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Create Project from Conversation                               [X Close]   │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  🤖 AI DETECTED INFORMATION                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Footage: 450 LF          │ Height: 6ft        │ Type: Cedar           │ │
│  │ Address: 2847 Lakewood Dr                     │ Target: Tue 12/17     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  CLIENT INFORMATION                                                         │
│                                                                              │
│  Client:     [DR Horton - Lakewood Phase 3    ▼] ← Auto-matched            │
│  Contact:    [John Smith                      ▼]                            │
│  Community:  [Lakewood Phase 3                ▼]                            │
│  Property:   [+ Create New Property             ]                           │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  PROJECT DETAILS                                                            │
│                                                                              │
│  Project Name:    [Lakewood Dr - 450LF Cedar           ]                    │
│  Address:         [2847 Lakewood Dr, Austin TX 78745   ]                    │
│  Business Unit:   [ATX - Home Builder                ▼]                     │
│  Assigned Rep:    [Marcus Rodriguez                  ▼]                     │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  FENCE CONFIGURATION (Pre-populated from AI)                                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Type: Wood Vertical  │ Height: 6ft  │ Style: Side-by-Side           │   │
│  │ Wood: Cedar         │ Footage: 450  │ Posts: Steel (M03)            │   │
│  │ Gates: [ ] Add later                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  [Cancel]                                    [Create Project & Quote →]     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Message Forwarding

Users can forward any message to another team member for escalation, handoff, or collaboration.

#### Forward Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MESSAGE FORWARD MODAL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Forward Message                                                [X Close]   │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  ORIGINAL MESSAGE                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ From: John Smith (DR Horton)                          10:32 AM        │ │
│  │ "Hey Marcus, we need 450ft of 6ft cedar at 2847 Lakewood Dr.         │ │
│  │  Can you get us a quote? Hoping to start next Tuesday."              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                                              │
│  Forward To:    [Select team member...                        ▼]            │
│                                                                              │
│                 ┌─────────────────────────────────────────────┐             │
│                 │ 🔍 Search team members...                   │             │
│                 ├─────────────────────────────────────────────┤             │
│                 │ 👤 Carlos Martinez (SA Rep)                 │             │
│                 │ 👤 Diana Chen (Operations)                  │             │
│                 │ 👤 Mike Johnson (Manager)                   │             │
│                 └─────────────────────────────────────────────┘             │
│                                                                              │
│  Add Note:      ┌─────────────────────────────────────────────────────────┐ │
│  (Optional)     │ "Can you handle this one? I'm slammed with the         │ │
│                 │  Stone Oak projects this week."                         │ │
│                 └─────────────────────────────────────────────────────────┘ │
│                                                                              │
│  [Cancel]                                              [Forward Message →]  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Database Addition

```sql
-- Add to mc_messages table
ALTER TABLE mc_messages ADD COLUMN forwarded_from_message_id UUID REFERENCES mc_messages(id);
ALTER TABLE mc_messages ADD COLUMN forwarded_by UUID REFERENCES auth.users(id);
ALTER TABLE mc_messages ADD COLUMN forwarded_at TIMESTAMPTZ;
ALTER TABLE mc_messages ADD COLUMN forward_note TEXT;
```

#### UI Indicators

- Forwarded messages show "↪ Forwarded from [Original Sender]" header
- Forward note appears below the forwarded message
- Original timestamp preserved, forward timestamp shown separately

---

### 6.6 SMS Opt-Out Handling (Compliance)

To comply with TCPA and carrier requirements, the system must handle opt-out requests.

#### Opt-Out Keywords

| Keyword | Action |
|---------|--------|
| `STOP` | Opt out of all SMS |
| `UNSUBSCRIBE` | Opt out of all SMS |
| `CANCEL` | Opt out of all SMS |
| `QUIT` | Opt out of all SMS |
| `START` | Re-subscribe to SMS |
| `YES` | Re-subscribe to SMS |

#### Database Addition

```sql
-- Add to mc_contacts table
ALTER TABLE mc_contacts ADD COLUMN sms_opted_out BOOLEAN DEFAULT FALSE;
ALTER TABLE mc_contacts ADD COLUMN sms_opted_out_at TIMESTAMPTZ;
ALTER TABLE mc_contacts ADD COLUMN sms_opted_out_keyword TEXT;
```

#### System Behavior

1. **Inbound STOP:** When client texts STOP:
   - Auto-reply: "You have been unsubscribed from SMS messages from Discount Fence USA. Reply START to re-subscribe."
   - Mark contact as `sms_opted_out = true`
   - Log timestamp and keyword

2. **Outbound Block:** When attempting to message opted-out contact:
   - Show warning: "⚠️ This contact has opted out of SMS messages"
   - Block SMS send (allow email if available)
   - Provide option to send email instead

3. **Re-subscription:** When client texts START:
   - Auto-reply: "Welcome back! You are now subscribed to SMS messages from Discount Fence USA."
   - Mark contact as `sms_opted_out = false`

---

## 7. Integration Points

### 7.1 QUO (SMS/Voice) Integration

```typescript
// QUO Webhook Handler
// Location: supabase/functions/quo-webhook/index.ts

interface QUOWebhookEvent {
  type: 'message.received' | 'message.delivered' | 'message.failed' | 'call.completed';
  data: {
    object: {
      id: string;
      conversationId: string;
      from: string;
      to: string;
      body?: string;
      media?: Array<{ url: string; contentType: string }>;
      status: string;
      createdAt: string;
      // For calls
      duration?: number;
      voicemailUrl?: string;
      transcription?: string;
    };
  };
}

// Sending SMS via QUO
interface QUOSendRequest {
  to: string;
  from: string;  // DFU's QUO number
  body: string;
  mediaUrls?: string[];
}

const sendSMS = async (req: QUOSendRequest) => {
  const response = await fetch('https://api.openphone.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${QUO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: req.from,
      to: req.to,
      content: req.body,
      ...(req.mediaUrls && { media: req.mediaUrls })
    })
  });
  
  return response.json();
};
```

### 7.2 Client Hub Integration

```typescript
// Auto-match phone to client
const matchPhoneToClient = async (phone: string) => {
  // Normalize phone number
  const normalized = normalizePhone(phone);
  
  // Search contacts table
  const { data: contact } = await supabase
    .from('client_contacts')
    .select('*, client:clients(*)')
    .or(`phone.eq.${normalized},mobile.eq.${normalized},phone.ilike.%${phone.slice(-10)}%`)
    .single();
  
  if (contact) {
    return {
      contact_id: contact.id,
      client_id: contact.client_id,
      client_name: contact.client.company_name,
      contact_name: `${contact.first_name} ${contact.last_name}`,
      pricebook_id: contact.client.pricebook_id
    };
  }
  
  return null;
};
```

### 7.3 BOM Calculator Integration

When converting a conversation to a project, pre-populate BOM Calculator fields:

```typescript
interface ConversionData {
  // From AI extraction
  footage?: number;
  fence_height?: string;
  fence_type?: string;
  fence_style?: string;
  gate_count?: number;
  
  // From client matching
  client_id?: string;
  community_id?: string;
  pricebook_id?: string;
  
  // From conversation
  conversation_id: string;
  address?: string;
  target_date?: string;
}

const createProjectFromConversation = async (data: ConversionData) => {
  // Create project
  const { data: project } = await supabase
    .from('bom_projects')
    .insert({
      client_id: data.client_id,
      community_id: data.community_id,
      site_address: data.address,
      source: 'project_radar',
      source_conversation_id: data.conversation_id,
      status: 'draft'
    })
    .select()
    .single();
  
  // Pre-populate fence configuration
  if (data.fence_type === 'cedar' && data.fence_style === 'vertical') {
    await supabase
      .from('wood_vertical_products')
      .insert({
        project_id: project.id,
        fence_height: data.fence_height || '6ft',
        wood_type: 'cedar',
        footage: data.footage || 0,
        // ... other defaults
      });
  }
  
  // Link conversation
  await supabase
    .from('mc_conversations')
    .update({ linked_project_id: project.id })
    .eq('id', data.conversation_id);
  
  return project;
};
```

---

## 8. API Endpoints

### 8.1 REST API

```typescript
// Conversations
GET    /api/messages/conversations
GET    /api/messages/conversations/:id
POST   /api/messages/conversations
PATCH  /api/messages/conversations/:id
DELETE /api/messages/conversations/:id

// Messages
GET    /api/messages/conversations/:id/messages
POST   /api/messages/conversations/:id/messages
PATCH  /api/messages/:id
DELETE /api/messages/:id

// Quick Replies
GET    /api/messages/quick-replies
POST   /api/messages/quick-replies
PATCH  /api/messages/quick-replies/:id
DELETE /api/messages/quick-replies/:id

// Notifications
GET    /api/messages/notifications
PATCH  /api/messages/notifications/:id/read
POST   /api/messages/notifications/mark-all-read

// Smart Messaging
POST   /api/messages/smart/autocomplete
POST   /api/messages/smart/rewrite
POST   /api/messages/smart/suggest
POST   /api/messages/smart/analyze

// Attachments
POST   /api/messages/attachments/upload
```

### 8.2 Realtime Subscriptions

```typescript
// Subscribe to new messages in a conversation
const subscribeToConversation = (conversationId: string) => {
  return supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mc_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => handleNewMessage(payload.new)
    )
    .subscribe();
};

// Subscribe to conversation list updates
const subscribeToInbox = (userId: string) => {
  return supabase
    .channel(`inbox:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mc_conversations'
      },
      (payload) => handleConversationUpdate(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mc_system_notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => handleNewNotification(payload.new)
    )
    .subscribe();
};
```

---

## 9. Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Deliverables:**
- Database schema deployed
- Basic conversation list UI
- Message thread view
- QUO webhook handler (receive SMS)
- Send SMS functionality

**Files to Create:**
```
src/features/message-center/
├── pages/
│   └── MessageCenterPage.tsx
├── components/
│   ├── ConversationList.tsx
│   ├── ConversationCard.tsx
│   ├── MessageThread.tsx
│   ├── MessageBubble.tsx
│   ├── MessageComposer.tsx
│   └── ContextPanel.tsx
├── hooks/
│   ├── useConversations.ts
│   ├── useMessages.ts
│   └── useRealtimeMessages.ts
├── services/
│   ├── messageService.ts
│   └── quoService.ts
└── types/
    └── index.ts

supabase/functions/
├── quo-webhook/
│   └── index.ts
└── send-sms/
    └── index.ts
```

### Phase 2: Team Messaging (Week 3)

**Deliverables:**
- Team direct messages
- Group chat creation
- In-app message delivery (no SMS cost)
- @mentions

**Additional Components:**
```
├── components/
│   ├── NewConversationModal.tsx
│   ├── GroupChatSettings.tsx
│   ├── ParticipantList.tsx
│   └── MentionInput.tsx
```

### Phase 3: Quick Replies & Templates (Week 4)

**Deliverables:**
- Quick reply management UI
- Shortcode replacement engine
- Template categories
- Keyboard shortcuts (/command)

**Additional Components:**
```
├── components/
│   ├── QuickReplyPicker.tsx
│   ├── QuickReplyManager.tsx
│   └── ShortcodeInput.tsx
├── utils/
│   └── shortcodeParser.ts
```

### Phase 4: AI Features (Week 5)

**Deliverables:**
- Smart autocomplete
- Professional rewrite
- Suggested replies
- Sentiment warnings

**Edge Functions:**
```
supabase/functions/
├── smart-autocomplete/
│   └── index.ts
├── smart-rewrite/
│   └── index.ts
└── smart-suggest/
    └── index.ts
```

### Phase 5: System Notifications (Week 6)

**Deliverables:**
- Notification triggers (database triggers)
- Notification display in inbox
- Mark as read functionality
- Notification preferences

**Additional Components:**
```
├── components/
│   ├── NotificationList.tsx
│   ├── NotificationItem.tsx
│   └── NotificationPreferences.tsx
```

### Phase 6: Right-Pane Messaging (Week 7)

**Deliverables:**
- Global messaging button
- Slide-out panel
- Context-aware recipient selection
- Integration with all pages

**Additional Components:**
```
├── components/
│   ├── RightPaneMessaging.tsx
│   ├── MessagingButton.tsx
│   └── RecipientSelector.tsx
├── context/
│   └── MessagingContext.tsx
```

### Phase 7: Project Conversion (Week 8)

**Deliverables:**
- AI detection display in thread
- Convert to Project modal
- Pre-populated BOM fields
- Conversation-project linking

**Additional Components:**
```
├── components/
│   ├── AIDetectionBanner.tsx
│   ├── ConvertToProjectModal.tsx
│   └── ProjectLinkBadge.tsx
```

---

## 10. Component Specifications

### 10.1 ConversationList Component

```typescript
// src/features/message-center/components/ConversationList.tsx

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  filter?: ConversationFilter;
}

interface ConversationFilter {
  type?: 'all' | 'client' | 'team' | 'system';
  channel?: 'sms' | 'email' | 'in_app';
  status?: 'active' | 'archived' | 'unread';
  search?: string;
  hasProjectSignal?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'urgent';
}

// Features:
// - Virtual scrolling for performance
// - Real-time updates via subscription
// - Grouped sections (Project Signals, Needs Attention, Recent)
// - Search with debounce
// - Swipe actions on mobile (archive, mute)
// - Unread count badges
// - Last message preview with truncation
// - Relative timestamps (2m ago, Yesterday, etc.)
```

### 10.2 MessageThread Component

```typescript
// src/features/message-center/components/MessageThread.tsx

interface MessageThreadProps {
  conversationId: string;
  onBack?: () => void;  // Mobile navigation
}

// Features:
// - Infinite scroll (load older messages)
// - Auto-scroll to bottom on new message
// - Message grouping by date
// - Delivery status indicators
// - Attachment preview
// - AI detection banner (if project signal)
// - Quick reply picker
// - File/image upload
// - Typing indicator (for team chats)
// - Read receipts (for team chats)
```

### 10.3 MessageComposer Component

```typescript
// src/features/message-center/components/MessageComposer.tsx

interface MessageComposerProps {
  conversationId: string;
  channel: 'sms' | 'email' | 'in_app';
  onSend: (message: NewMessage) => Promise<void>;
  placeholder?: string;
  quickReplies?: QuickReply[];
}

// Features:
// - Auto-resize textarea
// - Character count (for SMS: 160 chars)
// - Quick reply shortcut detection (/command)
// - @mention autocomplete
// - Emoji picker
// - File attachment button
// - Smart suggestion chips
// - Send on Enter (Shift+Enter for newline)
// - Draft auto-save
// - Schedule send option
```

### 10.4 ContextPanel Component

```typescript
// src/features/message-center/components/ContextPanel.tsx

interface ContextPanelProps {
  conversation: Conversation;
  contact?: Contact;
}

// Sections:
// - Contact Info (name, company, phone, email, avatar)
// - Quick Actions (Call, Email, New Project, New Quote)
// - Linked Entities (Projects, Quotes, Jobs)
// - Conversation Stats (message count, started date)
// - Notes (internal notes about client)
// - Tags (custom labels)
```

### 10.5 RightPaneMessaging Component

```typescript
// src/features/message-center/components/RightPaneMessaging.tsx

interface RightPaneMessagingProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipient?: Contact;  // Pre-selected from context
  contextEntity?: {            // What page we're on
    type: 'project' | 'quote' | 'job' | 'client';
    id: string;
  };
}

// Features:
// - Slide-in animation from right
// - Recipient search/selection
// - Recent conversations list
// - Quick new message to anyone
// - Context-aware (shows related contact if on Project page)
// - Minimizable to floating button
// - Keyboard shortcut to open (Ctrl/Cmd + M)
```

---

## Appendix A: File Structure

```
src/features/message-center/
├── pages/
│   └── MessageCenterPage.tsx
├── components/
│   ├── layout/
│   │   ├── MessageCenterLayout.tsx
│   │   └── MobileNavigation.tsx
│   ├── conversations/
│   │   ├── ConversationList.tsx
│   │   ├── ConversationCard.tsx
│   │   ├── ConversationFilters.tsx
│   │   └── ConversationSearch.tsx
│   ├── messages/
│   │   ├── MessageThread.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageComposer.tsx
│   │   ├── MessageStatus.tsx
│   │   └── AttachmentPreview.tsx
│   ├── context/
│   │   ├── ContextPanel.tsx
│   │   ├── ContactInfo.tsx
│   │   ├── LinkedEntities.tsx
│   │   └── QuickActions.tsx
│   ├── quick-replies/
│   │   ├── QuickReplyPicker.tsx
│   │   ├── QuickReplyManager.tsx
│   │   └── ShortcodeInput.tsx
│   ├── notifications/
│   │   ├── NotificationList.tsx
│   │   ├── NotificationItem.tsx
│   │   └── NotificationBadge.tsx
│   ├── ai/
│   │   ├── AIDetectionBanner.tsx
│   │   ├── SmartSuggestions.tsx
│   │   └── SentimentWarning.tsx
│   ├── modals/
│   │   ├── NewConversationModal.tsx
│   │   ├── ConvertToProjectModal.tsx
│   │   └── GroupSettingsModal.tsx
│   └── right-pane/
│       ├── RightPaneMessaging.tsx
│       ├── MessagingButton.tsx
│       └── RecipientSelector.tsx
├── hooks/
│   ├── useConversations.ts
│   ├── useMessages.ts
│   ├── useRealtimeMessages.ts
│   ├── useQuickReplies.ts
│   ├── useNotifications.ts
│   └── useSmartMessaging.ts
├── services/
│   ├── messageService.ts
│   ├── conversationService.ts
│   ├── quoService.ts
│   ├── notificationService.ts
│   └── smartMessagingService.ts
├── context/
│   └── MessagingContext.tsx
├── utils/
│   ├── shortcodeParser.ts
│   ├── phoneFormatter.ts
│   └── messageGrouping.ts
└── types/
    └── index.ts

supabase/functions/
├── quo-webhook/
│   └── index.ts
├── send-sms/
│   └── index.ts
├── analyze-message/
│   └── index.ts
├── smart-autocomplete/
│   └── index.ts
├── smart-rewrite/
│   └── index.ts
└── smart-suggest/
    └── index.ts
```

---

## Appendix B: Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | React + TypeScript | Existing stack |
| UI Components | shadcn/ui | Existing stack |
| State Management | TanStack Query | For server state |
| Real-time | Supabase Realtime | WebSocket subscriptions |
| Database | Supabase PostgreSQL | Existing |
| File Storage | Supabase Storage | For attachments |
| SMS Provider | QUO (OpenPhone) | Existing license |
| AI Analysis | Claude API | claude-sonnet-4-20250514 |
| Edge Functions | Supabase Edge Functions | Deno runtime |

---

## Appendix C: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Message Response Time | <15 min avg | Time from inbound to first reply |
| Conversion Rate | 40%+ | Conversations → Projects |
| Quick Reply Usage | 60%+ | Messages using templates |
| AI Detection Accuracy | 90%+ | True positive rate for project signals |
| User Adoption | 100% | All reps using Message Center daily |
| Missed Messages | 0 | No unanswered messages >24h |

---

**Document Status:** Ready for Claude Code Implementation  
**Next Step:** Begin Phase 1 - Core Infrastructure
