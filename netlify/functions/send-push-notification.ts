/**
 * Send Push Notification
 *
 * Sends web push notifications to users' subscribed devices
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@discountfence.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// ============================================================================
// TYPES
// ============================================================================

interface SendPushRequest {
  /** Target user ID */
  user_id: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Icon URL */
  icon?: string;
  /** Badge URL */
  badge?: string;
  /** URL to open when clicked */
  url?: string;
  /** Tag for grouping/replacing notifications */
  tag?: string;
  /** Source type for logging */
  source_type?: 'message' | 'notification' | 'system';
  /** Source ID for logging */
  source_id?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ============================================================================
// HANDLER
// ============================================================================

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  // Verify VAPID keys are configured
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('[Push] VAPID keys not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Push notifications not configured' }),
    };
  }

  try {
    const request: SendPushRequest = JSON.parse(event.body || '{}');
    const { user_id, title, body, icon, badge, url, tag, source_type, source_id, data } = request;

    // Validate required fields
    if (!user_id || !title) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: user_id, title' }),
      };
    }

    console.log(`[Push] Sending notification to user ${user_id}: "${title}"`);

    // Get active push subscriptions for user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .lt('error_count', 3);

    if (subError) {
      console.error('[Push] Error fetching subscriptions:', subError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions' }),
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Push] No active subscriptions for user');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, sent: 0, message: 'No subscriptions' }),
      };
    }

    console.log(`[Push] Found ${subscriptions.length} subscription(s)`);

    // Build notification payload
    const payload = JSON.stringify({
      title,
      body: body || '',
      icon: icon || '/Logo-DF-Transparent.png',
      badge: badge || '/favicon-96x96.png',
      url: url || '/',
      tag: tag || `notification-${Date.now()}`,
      data: data || {},
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: PushSubscription) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        // Log the notification attempt
        const { data: logEntry } = await supabase
          .from('push_notification_log')
          .insert({
            user_id,
            subscription_id: sub.id,
            title,
            body,
            icon,
            url,
            tag,
            source_type,
            source_id,
            status: 'pending',
          })
          .select('id')
          .single();

        try {
          await webpush.sendNotification(pushSubscription, payload);

          // Update log as sent
          if (logEntry?.id) {
            await supabase
              .from('push_notification_log')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', logEntry.id);
          }

          // Update last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);

          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          console.error(`[Push] Failed to send to ${sub.endpoint.slice(-20)}:`, error.message);

          // Update log as failed
          if (logEntry?.id) {
            await supabase
              .from('push_notification_log')
              .update({ status: 'failed', error_message: error.message })
              .eq('id', logEntry.id);
          }

          // Handle expired/invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription no longer valid - deactivate it
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false, last_error: 'Subscription expired' })
              .eq('id', sub.id);
          } else {
            // Increment error count
            await supabase
              .from('push_subscriptions')
              .update({
                error_count: supabase.rpc('increment_error_count', { row_id: sub.id }),
                last_error: error.message,
              })
              .eq('id', sub.id);

            // Fallback: direct increment if RPC doesn't exist
            const { data: current } = await supabase
              .from('push_subscriptions')
              .select('error_count')
              .eq('id', sub.id)
              .single();

            if (current) {
              await supabase
                .from('push_subscriptions')
                .update({
                  error_count: (current.error_count || 0) + 1,
                  last_error: error.message,
                })
                .eq('id', sub.id);
            }
          }

          return { success: false, endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    // Count successes
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;

    console.log(`[Push] Sent: ${successful}, Failed: ${failed}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: successful,
        failed,
        total: subscriptions.length,
      }),
    };
  } catch (error) {
    console.error('[Push] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send push notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
