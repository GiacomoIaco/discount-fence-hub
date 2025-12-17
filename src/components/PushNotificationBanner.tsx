/**
 * Push Notification Banner
 * Shows a prompt to enable push notifications
 */

import { useState, useEffect } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import {
  isPushSupported,
  getPermissionState,
  enablePushNotifications,
  showTestNotification,
} from '../lib/pushNotifications';
import { showSuccess, showError } from '../lib/toast';

interface PushNotificationBannerProps {
  /** Delay before showing banner (ms) */
  delay?: number;
  /** Pages where the banner should NOT appear */
  excludePaths?: string[];
}

const STORAGE_KEY = 'push_notification_dismissed';
const DISMISS_DURATION_DAYS = 7; // Don't show again for 7 days after dismissal

export function PushNotificationBanner({
  delay = 5000,
  excludePaths = ['/login', '/signup', '/qr'],
}: PushNotificationBannerProps) {
  const [show, setShow] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    // Check if we should show the banner
    const shouldShow = checkShouldShow();
    if (!shouldShow) return;

    // Show after delay
    const timer = setTimeout(() => {
      setShow(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, excludePaths]);

  function checkShouldShow(): boolean {
    // Check if push is supported
    if (!isPushSupported()) {
      return false;
    }

    // Check permission state
    const permissionState = getPermissionState();
    if (permissionState === 'granted' || permissionState === 'denied') {
      return false;
    }

    // Check if on excluded path
    const currentPath = window.location.pathname;
    if (excludePaths.some(path => currentPath.startsWith(path))) {
      return false;
    }

    // Check if recently dismissed
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissDate = new Date(dismissedAt);
      const daysSinceDismiss = (Date.now() - dismissDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_DURATION_DAYS) {
        return false;
      }
    }

    return true;
  }

  async function handleEnable() {
    setIsEnabling(true);
    try {
      const success = await enablePushNotifications();
      if (success) {
        showSuccess('Push notifications enabled!');
        // Show a test notification
        setTimeout(() => {
          showTestNotification();
        }, 1000);
        setShow(false);
      } else {
        showError('Could not enable notifications. Please check your browser settings.');
      }
    } catch (error) {
      console.error('[PushBanner] Error:', error);
      showError('Failed to enable notifications');
    } finally {
      setIsEnabling(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-2xl p-4 text-white">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-semibold text-lg mb-1">Stay Updated</h3>
            <p className="text-sm text-blue-100 mb-3">
              Enable notifications to get alerts for new messages, quotes, and job updates - even when the app is closed.
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <Smartphone className="w-3 h-3" />
                Works on mobile
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={isEnabling}
                className="flex-1 bg-white text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnabling ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Enabling...
                  </span>
                ) : (
                  'Enable Notifications'
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-sm text-blue-100 hover:text-white transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PushNotificationBanner;
