/**
 * Toast Context
 *
 * Provides toast notification functions throughout the app.
 * Registers with the singleton toast manager to allow toasts from anywhere.
 */

import React, { createContext, useContext, useEffect } from 'react';
import { ToastContainer, useToastManager } from '../components/CustomToast';
import { toastManager as singletonToastManager } from '../lib/toast';

interface ToastContextValue {
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toastManager = useToastManager();

  // Register the addToast function with the singleton manager
  useEffect(() => {
    singletonToastManager.setCallback((type, message, duration) => {
      return toastManager.addToast(type, message, duration);
    });
  }, [toastManager]);

  const contextValue: ToastContextValue = {
    showSuccess: toastManager.showSuccess,
    showError: toastManager.showError,
    showWarning: toastManager.showWarning,
    showInfo: toastManager.showInfo,
    clearAll: toastManager.clearAll,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toastManager.toasts} removeToast={toastManager.removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
