# Message Center - Phase 4 Implementation
## System Notifications

**Estimated Time:** 2-3 hours  
**Prerequisites:** Phase 1, 2A, 3 complete  
**Outcome:** Automated notifications for quote viewed, invoice paid, job status changes

---

## Overview

System Notifications are automated alerts that appear in the Message Center when important events happen:

- 👁️ **Quote Viewed** - Client opened their quote
- ✍️ **Quote Signed** - Client signed the proposal
- 💰 **Invoice Paid** - Payment received
- ⏰ **Invoice Overdue** - Payment past due
- 🔄 **Job Status Changed** - Job moved to new stage
- 📅 **Booking Request** - New online booking
- 👤 **Client Created** - New client added

These appear in a dedicated "Notifications" section in the Message Center and can trigger follow-up actions.

---

## Step 1: Database Migration

Run in Supabase SQL Editor:

```sql
-- ============================================================================
-- MESSAGE CENTER PHASE 4 - SYSTEM NOTIFICATIONS
-- ============================================================================

-- Notification Type Enum
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'quote_viewed',
    'quote_signed',
    'quote_expired',
    'invoice_paid',
    'invoice_overdue',
    'invoice_partial',
    'job_status_change',
    'job_scheduled',
    'job_completed',
    'booking_request',
    'client_created',
    'message_received',
    'mention',
    'assignment',
    'reminder',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification Priority Enum
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- SYSTEM NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mc_system_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Type & Content
  notification_type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority notification_priority DEFAULT 'normal',
  
  -- Linked Entities
  contact_id UUID REFERENCES mc_contacts(id),
  conversation_id UUID REFERENCES mc_conversations(id),
  client_id UUID,  -- References clients table
  project_id UUID, -- References projects table
  quote_id UUID,   -- References quotes table
  invoice_id UUID, -- References invoices table
  job_id UUID,     -- References jobs table
  
  -- Targeting
  target_user_id UUID REFERENCES auth.users(id),  -- Specific user (null = all)
  target_role TEXT,  -- Or target by role
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id),
  is_actioned BOOLEAN DEFAULT FALSE,
  actioned_at TIMESTAMPTZ,
  
  -- Action
  action_url TEXT,  -- Deep link to relevant page
  action_label TEXT,  -- e.g., "View Quote", "Send Follow-up"
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Auto-dismiss after this time
);

CREATE INDEX IF NOT EXISTS idx_mc_notifications_type ON mc_system_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_user ON mc_system_notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_read ON mc_system_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_created ON mc_system_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_notifications_contact ON mc_system_notifications(contact_id);

-- RLS
ALTER TABLE mc_system_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notifications" ON mc_system_notifications FOR SELECT USING (
  target_user_id IS NULL OR target_user_id = auth.uid()
);
CREATE POLICY "System can insert notifications" ON mc_system_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their notifications" ON mc_system_notifications FOR UPDATE USING (
  target_user_id IS NULL OR target_user_id = auth.uid()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mc_system_notifications;

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mc_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Per-type settings
  quote_viewed BOOLEAN DEFAULT TRUE,
  quote_signed BOOLEAN DEFAULT TRUE,
  quote_expired BOOLEAN DEFAULT TRUE,
  invoice_paid BOOLEAN DEFAULT TRUE,
  invoice_overdue BOOLEAN DEFAULT TRUE,
  job_status_change BOOLEAN DEFAULT TRUE,
  booking_request BOOLEAN DEFAULT TRUE,
  client_created BOOLEAN DEFAULT FALSE,
  mention BOOLEAN DEFAULT TRUE,
  
  -- Delivery channels
  show_in_app BOOLEAN DEFAULT TRUE,
  send_email BOOLEAN DEFAULT FALSE,
  send_sms BOOLEAN DEFAULT FALSE,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

ALTER TABLE mc_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preferences" ON mc_notification_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own preferences" ON mc_notification_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own preferences" ON mc_notification_preferences FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTION: Create Notification
-- ============================================================================

CREATE OR REPLACE FUNCTION create_system_notification(
  p_type notification_type,
  p_title TEXT,
  p_body TEXT,
  p_contact_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_quote_id UUID DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_job_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_priority notification_priority DEFAULT 'normal',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_conversation_id UUID;
BEGIN
  -- Find or create conversation for this contact
  IF p_contact_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM mc_conversations
    WHERE contact_id = p_contact_id
    AND conversation_type = 'client'
    AND status = 'active'
    LIMIT 1;
  END IF;

  -- Insert notification
  INSERT INTO mc_system_notifications (
    notification_type,
    title,
    body,
    priority,
    contact_id,
    conversation_id,
    client_id,
    project_id,
    quote_id,
    invoice_id,
    job_id,
    target_user_id,
    action_url,
    action_label,
    metadata
  ) VALUES (
    p_type,
    p_title,
    p_body,
    p_priority,
    p_contact_id,
    v_conversation_id,
    p_client_id,
    p_project_id,
    p_quote_id,
    p_invoice_id,
    p_job_id,
    p_target_user_id,
    p_action_url,
    p_action_label,
    p_metadata
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Quote Viewed (if you have a quote_views table)
-- ============================================================================

-- Example trigger - adjust based on your actual schema
CREATE OR REPLACE FUNCTION notify_quote_viewed()
RETURNS TRIGGER AS $$
DECLARE
  v_quote RECORD;
  v_contact_id UUID;
BEGIN
  -- Get quote details (adjust table/column names to match your schema)
  SELECT q.*, c.id as contact_id, c.display_name as client_name
  INTO v_quote
  FROM quotes q
  LEFT JOIN mc_contacts c ON c.client_id = q.client_id
  WHERE q.id = NEW.quote_id;

  IF v_quote IS NOT NULL THEN
    PERFORM create_system_notification(
      'quote_viewed'::notification_type,
      'Quote Viewed',
      format('%s viewed quote #%s', COALESCE(v_quote.client_name, 'A client'), v_quote.quote_number),
      v_quote.contact_id,
      v_quote.client_id,
      v_quote.project_id,
      v_quote.id,
      NULL,
      NULL,
      v_quote.assigned_to,
      format('/quotes/%s', v_quote.id),
      'View Quote',
      'high'::notification_priority,
      jsonb_build_object('view_count', NEW.view_count, 'viewed_at', NEW.viewed_at)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment and adjust when you have the quote_views table:
-- DROP TRIGGER IF EXISTS trg_notify_quote_viewed ON quote_views;
-- CREATE TRIGGER trg_notify_quote_viewed
-- AFTER INSERT OR UPDATE ON quote_views
-- FOR EACH ROW
-- EXECUTE FUNCTION notify_quote_viewed();

-- ============================================================================
-- TRIGGER: Invoice Paid
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice RECORD;
  v_contact_id UUID;
BEGIN
  -- Only trigger when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Get invoice details (adjust to your schema)
    SELECT i.*, c.id as contact_id, c.display_name as client_name
    INTO v_invoice
    FROM invoices i
    LEFT JOIN mc_contacts c ON c.client_id = i.client_id
    WHERE i.id = NEW.id;

    IF v_invoice IS NOT NULL THEN
      PERFORM create_system_notification(
        'invoice_paid'::notification_type,
        'Payment Received! 💰',
        format('%s paid invoice #%s - $%s', 
          COALESCE(v_invoice.client_name, 'A client'), 
          v_invoice.invoice_number,
          v_invoice.total_amount
        ),
        v_invoice.contact_id,
        v_invoice.client_id,
        v_invoice.project_id,
        NULL,
        v_invoice.id,
        NULL,
        NULL,  -- Notify all users
        format('/invoices/%s', v_invoice.id),
        'View Invoice',
        'normal'::notification_priority,
        jsonb_build_object('amount', v_invoice.total_amount, 'paid_at', NOW())
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment when you have invoices table:
-- DROP TRIGGER IF EXISTS trg_notify_invoice_paid ON invoices;
-- CREATE TRIGGER trg_notify_invoice_paid
-- AFTER UPDATE ON invoices
-- FOR EACH ROW
-- EXECUTE FUNCTION notify_invoice_paid();

-- ============================================================================
-- TRIGGER: Job Status Change
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_job RECORD;
  v_contact_id UUID;
  v_title TEXT;
  v_body TEXT;
  v_priority notification_priority;
BEGIN
  -- Only trigger on status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Get job details (adjust to your schema)
    SELECT j.*, c.id as contact_id, c.display_name as client_name
    INTO v_job
    FROM jobs j
    LEFT JOIN mc_contacts c ON c.client_id = j.client_id
    WHERE j.id = NEW.id;

    -- Set notification content based on new status
    CASE NEW.status
      WHEN 'scheduled' THEN
        v_title := 'Job Scheduled';
        v_body := format('Job for %s scheduled for %s', v_job.client_name, NEW.scheduled_date);
        v_priority := 'normal';
      WHEN 'in_progress' THEN
        v_title := 'Job Started';
        v_body := format('Work has begun on job for %s', v_job.client_name);
        v_priority := 'normal';
      WHEN 'completed' THEN
        v_title := 'Job Completed ✓';
        v_body := format('Job for %s has been completed', v_job.client_name);
        v_priority := 'normal';
      WHEN 'cancelled' THEN
        v_title := 'Job Cancelled';
        v_body := format('Job for %s was cancelled', v_job.client_name);
        v_priority := 'high';
      ELSE
        v_title := 'Job Updated';
        v_body := format('Job for %s moved to %s', v_job.client_name, NEW.status);
        v_priority := 'low';
    END CASE;

    PERFORM create_system_notification(
      'job_status_change'::notification_type,
      v_title,
      v_body,
      v_job.contact_id,
      v_job.client_id,
      v_job.project_id,
      NULL,
      NULL,
      v_job.id,
      v_job.assigned_to,
      format('/jobs/%s', v_job.id),
      'View Job',
      v_priority,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uncomment when you have jobs table:
-- DROP TRIGGER IF EXISTS trg_notify_job_status_change ON jobs;
-- CREATE TRIGGER trg_notify_job_status_change
-- AFTER UPDATE ON jobs
-- FOR EACH ROW
-- EXECUTE FUNCTION notify_job_status_change();
```

---

## Step 2: TypeScript Types

Add to `src/features/message-center/types/index.ts`:

```typescript
// Add these types

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
```

---

## Step 3: Notification Service

Create file: `src/features/message-center/services/notificationService.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { SystemNotification, NotificationPreferences, NotificationType } from '../types';

// ============================================================================
// FETCH NOTIFICATIONS
// ============================================================================

export async function getNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
  types?: NotificationType[];
}): Promise<SystemNotification[]> {
  let query = supabase
    .from('mc_system_notifications')
    .select(`
      *,
      contact:mc_contacts(*)
    `)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.types && options.types.length > 0) {
    query = query.in('notification_type', options.types);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('mc_system_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

// ============================================================================
// MARK AS READ
// ============================================================================

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('is_read', false);

  if (error) throw error;
}

export async function markAsActioned(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .update({
      is_actioned: true,
      actioned_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) throw error;
}

// ============================================================================
// DELETE / DISMISS
// ============================================================================

export async function dismissNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
}

export async function dismissAllRead(): Promise<void> {
  const { error } = await supabase
    .from('mc_system_notifications')
    .delete()
    .eq('is_read', true);

  if (error) throw error;
}

// ============================================================================
// CREATE NOTIFICATION (Client-side, for testing or manual creation)
// ============================================================================

export async function createNotification(notification: {
  type: NotificationType;
  title: string;
  body: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  contactId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}): Promise<SystemNotification> {
  const { data, error } = await supabase
    .from('mc_system_notifications')
    .insert({
      notification_type: notification.type,
      title: notification.title,
      body: notification.body,
      priority: notification.priority || 'normal',
      contact_id: notification.contactId,
      action_url: notification.actionUrl,
      action_label: notification.actionLabel,
      metadata: notification.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// PREFERENCES
// ============================================================================

export async function getPreferences(): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('mc_notification_preferences')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updatePreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data: existing } = await supabase
    .from('mc_notification_preferences')
    .select('id')
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('mc_notification_preferences')
      .update({
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('mc_notification_preferences')
      .insert(preferences)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// ============================================================================
// REALTIME SUBSCRIPTION
// ============================================================================

export function subscribeToNotifications(
  callback: (notification: SystemNotification) => void
) {
  return supabase
    .channel('mc_notifications_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mc_system_notifications',
      },
      (payload) => {
        callback(payload.new as SystemNotification);
      }
    )
    .subscribe();
}

// ============================================================================
// HELPERS
// ============================================================================

export function groupNotificationsByDate(
  notifications: SystemNotification[]
): { date: string; notifications: SystemNotification[] }[] {
  const groups: Record<string, SystemNotification[]> = {};

  notifications.forEach((notification) => {
    const date = new Date(notification.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
  });

  return Object.entries(groups).map(([date, notifications]) => ({
    date,
    notifications,
  }));
}

export function getNotificationIcon(type: NotificationType): string {
  const icons: Record<NotificationType, string> = {
    quote_viewed: '👁️',
    quote_signed: '✍️',
    quote_expired: '⏰',
    invoice_paid: '💰',
    invoice_overdue: '🚨',
    invoice_partial: '💵',
    job_status_change: '🔄',
    job_scheduled: '📅',
    job_completed: '✅',
    booking_request: '📋',
    client_created: '👤',
    message_received: '💬',
    mention: '@',
    assignment: '👉',
    reminder: '🔔',
    system: 'ℹ️',
  };
  return icons[type] || '📌';
}

export function getNotificationColor(type: NotificationType): string {
  const colors: Record<NotificationType, string> = {
    quote_viewed: 'blue',
    quote_signed: 'green',
    quote_expired: 'orange',
    invoice_paid: 'emerald',
    invoice_overdue: 'red',
    invoice_partial: 'yellow',
    job_status_change: 'purple',
    job_scheduled: 'blue',
    job_completed: 'green',
    booking_request: 'indigo',
    client_created: 'teal',
    message_received: 'blue',
    mention: 'orange',
    assignment: 'purple',
    reminder: 'yellow',
    system: 'gray',
  };
  return colors[type] || 'gray';
}
```

---

## Step 4: Notification Hook

Create file: `src/features/message-center/hooks/useNotifications.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import * as notificationService from '../services/notificationService';
import type { SystemNotification, NotificationType } from '../types';

export function useNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
  types?: NotificationType[];
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mc_notifications', options],
    queryFn: () => notificationService.getNotifications(options),
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const subscription = notificationService.subscribeToNotifications((notification) => {
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
      
      // Optional: Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/favicon.ico',
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['mc_notification_count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['mc_notification_preferences'],
    queryFn: notificationService.getPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mc_notification_preferences'] });
    },
  });
}

// Request browser notification permission
export function useRequestNotificationPermission() {
  return useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);
}
```

---

## Step 5: Notification List Component

Create file: `src/features/message-center/components/NotificationList.tsx`

```typescript
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead, useDismissNotification } from '../hooks/useNotifications';
import * as notificationService from '../services/notificationService';
import type { SystemNotification } from '../types';

interface NotificationListProps {
  maxHeight?: string;
  onNotificationClick?: (notification: SystemNotification) => void;
}

export function NotificationList({ maxHeight = '400px', onNotificationClick }: NotificationListProps) {
  const { data: notifications = [], isLoading } = useNotifications({ limit: 50 });
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const dismiss = useDismissNotification();

  const groupedNotifications = notificationService.groupNotificationsByDate(notifications);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleClick = (notification: SystemNotification) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    onNotificationClick?.(notification);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead.mutate()}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight }}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Bell className="w-8 h-8 mb-2 text-gray-300" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          groupedNotifications.map((group) => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 sticky top-0">
                {group.date}
              </div>

              {/* Notifications */}
              {group.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleClick(notification)}
                  onDismiss={() => dismiss.mutate(notification.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: SystemNotification;
  onClick: () => void;
  onDismiss: () => void;
}

function NotificationItem({ notification, onClick, onDismiss }: NotificationItemProps) {
  const icon = notificationService.getNotificationIcon(notification.notification_type);
  const color = notificationService.getNotificationColor(notification.notification_type);

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b hover:bg-gray-50 transition-colors cursor-pointer group',
        !notification.is_read && 'bg-blue-50 hover:bg-blue-100'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg',
        `bg-${color}-100`
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn(
              'text-sm',
              !notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'
            )}>
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {notification.body}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </span>

          {notification.action_url && notification.action_label && (
            <a
              href={notification.action_url}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {notification.action_label}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {!notification.is_read && (
            <span className="w-2 h-2 bg-blue-600 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: Notification Bell Component (Header)

Create file: `src/features/message-center/components/NotificationBell.tsx`

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationList } from './NotificationList';
import { useUnreadNotificationCount } from '../hooks/useNotifications';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          isOpen ? 'bg-gray-100' : 'hover:bg-gray-100'
        )}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold text-white bg-red-500 rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50">
          <NotificationList
            maxHeight="400px"
            onNotificationClick={(notification) => {
              if (notification.action_url) {
                window.location.href = notification.action_url;
              }
              setIsOpen(false);
            }}
          />
          
          {/* Footer */}
          <div className="px-4 py-2 border-t bg-gray-50">
            <a
              href="/notifications"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 7: Add Notification Section to Message Center

Update `src/features/message-center/components/ConversationList.tsx` to include a notifications section:

```typescript
// Add this import at the top
import { useUnreadNotificationCount } from '../hooks/useNotifications';

// Inside the ConversationList component, add before the conversation sections:

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  onShowNotifications  // Add this prop
}: ConversationListProps & { onShowNotifications?: () => void }) {
  const { data: unreadNotificationCount = 0 } = useUnreadNotificationCount();

  // ... existing code ...

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Notifications Section */}
      {unreadNotificationCount > 0 && onShowNotifications && (
        <button
          onClick={onShowNotifications}
          className="mx-2 mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:from-blue-100 hover:to-indigo-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="font-medium text-blue-900">Notifications</span>
            </div>
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadNotificationCount}
            </span>
          </div>
          <p className="text-xs text-blue-700 mt-1 text-left">
            Quote viewed, payments, status changes...
          </p>
        </button>
      )}

      {/* Rest of existing conversation list... */}
      {/* Project Signals Section */}
      {projectSignals.length > 0 && (
        // ... existing code
      )}
    </div>
  );
}
```

---

## Step 8: API Endpoint for Manual Notification Creation

Create file: `netlify/functions/create-notification.ts` (or add to existing API):

```typescript
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const {
      type,
      title,
      body,
      priority = 'normal',
      contact_id,
      client_id,
      project_id,
      quote_id,
      invoice_id,
      job_id,
      target_user_id,
      action_url,
      action_label,
      metadata = {}
    } = JSON.parse(event.body || '{}');

    if (!type || !title || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: type, title, body' })
      };
    }

    // Use the helper function
    const { data, error } = await supabase.rpc('create_system_notification', {
      p_type: type,
      p_title: title,
      p_body: body,
      p_contact_id: contact_id,
      p_client_id: client_id,
      p_project_id: project_id,
      p_quote_id: quote_id,
      p_invoice_id: invoice_id,
      p_job_id: job_id,
      p_target_user_id: target_user_id,
      p_action_url: action_url,
      p_action_label: action_label,
      p_priority: priority,
      p_metadata: metadata
    });

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, notification_id: data })
    };
  } catch (error: any) {
    console.error('Create notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

## Step 9: Test Data

Run this SQL to create test notifications:

```sql
-- Test notifications
INSERT INTO mc_system_notifications (notification_type, title, body, priority, action_url, action_label)
VALUES 
  ('quote_viewed', 'Quote Viewed', 'John Smith viewed quote #1234 for Lakewood Estates', 'high', '/quotes/1234', 'View Quote'),
  ('invoice_paid', 'Payment Received! 💰', 'DR Horton paid invoice #5678 - $4,500', 'normal', '/invoices/5678', 'View Invoice'),
  ('job_status_change', 'Job Completed ✓', 'Job for Smith residence has been completed', 'normal', '/jobs/9012', 'View Job'),
  ('booking_request', 'New Booking Request', 'Sarah Johnson requested a quote for 200ft cedar fence', 'high', '/leads/3456', 'View Lead'),
  ('quote_signed', 'Quote Signed! ✍️', 'Mike Williams signed quote #7890 - Ready to schedule', 'high', '/quotes/7890', 'Schedule Job');
```

---

## Verification Checklist

- [ ] Database tables created (`mc_system_notifications`, `mc_notification_preferences`)
- [ ] Test notifications appear in list
- [ ] Unread count shows in bell badge
- [ ] Clicking notification marks as read
- [ ] "Mark all read" works
- [ ] Dismiss (X) removes notification
- [ ] Realtime: new notifications appear instantly
- [ ] Grouped by date
- [ ] Action buttons link to correct pages
- [ ] Priority styling (urgent = red border)

---

## Notification Types Reference

| Type | Icon | When Triggered | Priority |
|------|------|----------------|----------|
| `quote_viewed` | 👁️ | Client opens quote in portal | High |
| `quote_signed` | ✍️ | Client signs proposal | High |
| `quote_expired` | ⏰ | Quote past expiration date | Normal |
| `invoice_paid` | 💰 | Payment received | Normal |
| `invoice_overdue` | 🚨 | Invoice past due date | High |
| `job_status_change` | 🔄 | Job moves to new stage | Normal |
| `job_scheduled` | 📅 | Job gets scheduled | Normal |
| `job_completed` | ✅ | Job marked complete | Normal |
| `booking_request` | 📋 | New online booking | High |
| `client_created` | 👤 | New client added | Low |
| `mention` | @ | Someone mentions you | High |
| `assignment` | 👉 | Job assigned to you | High |

---

## Next Phase: Connect to Your Existing Tables

The database triggers I provided are **templates**. You'll need to:

1. Adjust table/column names to match your actual schema
2. Uncomment the triggers after verifying they work
3. Add triggers for any other events you want to track

Example: If your quotes table is called `project_quotes`:

```sql
-- Adjust the trigger to your schema
DROP TRIGGER IF EXISTS trg_notify_quote_viewed ON quote_view_logs;
CREATE TRIGGER trg_notify_quote_viewed
AFTER INSERT ON quote_view_logs  -- Your actual table name
FOR EACH ROW
EXECUTE FUNCTION notify_quote_viewed();
```

---

**End of Phase 4 Implementation Spec**
