/**
 * Toast Notification Utilities
 *
 * Provides a simple API for showing toast notifications.
 * Uses a singleton pattern to work from both React components and utility functions.
 */

import type { ToastType } from '../components/CustomToast';

type ToastCallback = (type: ToastType, message: string, duration?: number) => string;

// Singleton toast manager
class ToastManager {
  private callback: ToastCallback | null = null;

  setCallback(callback: ToastCallback) {
    this.callback = callback;
  }

  private showToast(type: ToastType, message: string, duration?: number): string {
    if (this.callback) {
      return this.callback(type, message, duration);
    } else {
      // Fallback to console if toast system isn't initialized
      console.warn(`[Toast ${type}]:`, message);
      return '';
    }
  }

  showError(message: string, duration: number = 4000): string {
    return this.showToast('error', message, duration);
  }

  showSuccess(message: string, duration: number = 3000): string {
    return this.showToast('success', message, duration);
  }

  showWarning(message: string, duration: number = 3500): string {
    return this.showToast('warning', message, duration);
  }

  showInfo(message: string, duration: number = 3000): string {
    return this.showToast('info', message, duration);
  }

  // Loading toasts are shown as info toasts in our custom system
  showLoading(message: string): string {
    return this.showToast('info', message, 10000); // Longer duration for loading
  }

  // Dismiss is handled automatically by the toast component
  dismissToast(_toastId: string) {
    // Not implemented in custom toast system - toasts auto-dismiss
    console.debug('Toast dismiss requested (auto-dismiss is enabled)');
  }
}

// Export singleton instance
export const toastManager = new ToastManager();

// Export convenience functions (maintain backward compatibility)
export const showError = (message: string, duration?: number): string => {
  return toastManager.showError(message, duration);
};

export const showSuccess = (message: string, duration?: number): string => {
  return toastManager.showSuccess(message, duration);
};

export const showWarning = (message: string, duration?: number): string => {
  return toastManager.showWarning(message, duration);
};

export const showInfo = (message: string, duration?: number): string => {
  return toastManager.showInfo(message, duration);
};

export const showLoading = (message: string): string => {
  return toastManager.showLoading(message);
};

export const dismissToast = (toastId: string): void => {
  toastManager.dismissToast(toastId);
};
