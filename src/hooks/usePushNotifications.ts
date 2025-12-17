/**
 * Hook for managing push notification state
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPermissionState,
  getCurrentSubscription,
  enablePushNotifications,
  disablePushNotifications,
} from '../lib/pushNotifications';
import type { NotificationPermissionState } from '../lib/pushNotifications';

interface UsePushNotificationsReturn {
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Current permission state */
  permissionState: NotificationPermissionState;
  /** Whether currently subscribed */
  isSubscribed: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Enable push notifications */
  enable: () => Promise<boolean>;
  /** Disable push notifications */
  disable: () => Promise<boolean>;
  /** Refresh subscription state */
  refresh: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported());
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>(() =>
    getPermissionState()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check subscription status on mount
  useEffect(() => {
    checkSubscription();
  }, []);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    // Check periodically if permission state changed
    const interval = setInterval(() => {
      const newState = getPermissionState();
      if (newState !== permissionState) {
        setPermissionState(newState);
        checkSubscription();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isSupported, permissionState]);

  const checkSubscription = useCallback(async () => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const subscription = await getCurrentSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('[usePushNotifications] Error checking subscription:', error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      const success = await enablePushNotifications();
      if (success) {
        setPermissionState('granted');
        setIsSubscribed(true);
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Error enabling:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const disable = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      const success = await disablePushNotifications();
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (error) {
      console.error('[usePushNotifications] Error disabling:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    isSupported,
    permissionState,
    isSubscribed,
    isLoading,
    enable,
    disable,
    refresh: checkSubscription,
  };
}

export default usePushNotifications;
