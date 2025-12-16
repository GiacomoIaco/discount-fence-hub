import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import * as notificationService from '../services/notificationService';
import type { NotificationType } from '../types';

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
    const subscription = notificationService.subscribeToNotifications(() => {
      queryClient.invalidateQueries({ queryKey: ['mc_notifications'] });
      queryClient.invalidateQueries({ queryKey: ['mc_notification_count'] });
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
