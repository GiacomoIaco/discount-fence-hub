import { supabase } from '../../../lib/supabase';
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
// CREATE NOTIFICATION (Client-side)
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
    mention: '📣',
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
