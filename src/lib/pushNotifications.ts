/**
 * Push Notification Service
 * Handles subscribing to web push notifications and managing permissions
 */

import { supabase } from './supabase';

// Get VAPID public key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// ============================================================================
// TYPES
// ============================================================================

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  deviceName?: string;
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

// ============================================================================
// CHECK SUPPORT
// ============================================================================

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission state
 */
export function getPermissionState(): NotificationPermissionState {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

// ============================================================================
// PERMISSION REQUEST
// ============================================================================

/**
 * Request notification permission from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[Push] Notifications blocked by user');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 * Returns the subscription data or null if failed
 */
export async function subscribeToPush(): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) {
    console.error('[Push] Push notifications not supported');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID public key not configured');
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe to push
      const vapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey.buffer as ArrayBuffer,
      });
    }

    // Extract keys
    const json = subscription.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) {
      console.error('[Push] Missing keys in subscription');
      return null;
    }

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
      deviceName: getDeviceName(),
    };

    console.log('[Push] Subscribed successfully:', subscriptionData.endpoint.slice(-20));
    return subscriptionData;
  } catch (error) {
    console.error('[Push] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed successfully');
    }
    return true;
  } catch (error) {
    console.error('[Push] Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save push subscription to database
 */
export async function saveSubscription(subscription: PushSubscriptionData): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[Push] No user logged in');
      return false;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          user_agent: subscription.userAgent,
          device_name: subscription.deviceName,
          is_active: true,
          error_count: 0,
          last_error: null,
        },
        {
          onConflict: 'user_id,endpoint',
        }
      );

    if (error) {
      console.error('[Push] Failed to save subscription:', error);
      return false;
    }

    console.log('[Push] Subscription saved to database');
    return true;
  } catch (error) {
    console.error('[Push] Error saving subscription:', error);
    return false;
  }
}

/**
 * Remove push subscription from database
 */
export async function removeSubscription(): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) {
      return true;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint);

    if (error) {
      console.error('[Push] Failed to remove subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Push] Error removing subscription:', error);
    return false;
  }
}

/**
 * Deactivate all subscriptions for current user on this device
 */
export async function deactivateCurrentSubscription(): Promise<boolean> {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) {
      return true;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('endpoint', subscription.endpoint);

    if (error) {
      console.error('[Push] Failed to deactivate subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Push] Error deactivating subscription:', error);
    return false;
  }
}

// ============================================================================
// FULL FLOW
// ============================================================================

/**
 * Complete flow: Request permission, subscribe, and save to database
 * Returns true if successful
 */
export async function enablePushNotifications(): Promise<boolean> {
  // Check support
  if (!isPushSupported()) {
    console.error('[Push] Push notifications not supported on this device');
    return false;
  }

  // Request permission
  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    console.warn('[Push] Permission not granted');
    return false;
  }

  // Subscribe
  const subscriptionData = await subscribeToPush();
  if (!subscriptionData) {
    console.error('[Push] Failed to subscribe');
    return false;
  }

  // Save to database
  const saved = await saveSubscription(subscriptionData);
  if (!saved) {
    console.error('[Push] Failed to save subscription');
    return false;
  }

  console.log('[Push] Push notifications enabled successfully');
  return true;
}

/**
 * Disable push notifications
 */
export async function disablePushNotifications(): Promise<boolean> {
  // Remove from database first
  await removeSubscription();

  // Then unsubscribe from push manager
  return unsubscribeFromPush();
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get a friendly device name
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;

  // iOS
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';

  // Android
  if (/Android/.test(ua)) {
    const match = ua.match(/Android.*?;\s*([^)]+)/);
    if (match) return match[1].split(' Build')[0].trim();
    return 'Android Device';
  }

  // Desktop browsers
  if (/Chrome/.test(ua)) {
    if (/Windows/.test(ua)) return 'Chrome on Windows';
    if (/Mac/.test(ua)) return 'Chrome on Mac';
    if (/Linux/.test(ua)) return 'Chrome on Linux';
    return 'Chrome';
  }
  if (/Firefox/.test(ua)) return 'Firefox';
  if (/Safari/.test(ua)) return 'Safari';
  if (/Edge/.test(ua)) return 'Edge';

  return 'Unknown Device';
}

/**
 * Show a local test notification (for debugging)
 */
export async function showTestNotification(): Promise<void> {
  if (Notification.permission !== 'granted') {
    console.warn('[Push] Notification permission not granted');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Test Notification', {
    body: 'Push notifications are working!',
    icon: '/Logo-DF-Transparent.png',
    badge: '/favicon-96x96.png',
    tag: 'test',
  } as NotificationOptions);
}
