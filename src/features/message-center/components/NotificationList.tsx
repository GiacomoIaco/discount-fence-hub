import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, X, ExternalLink } from 'lucide-react';
import { cn } from '../../../lib/utils';
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

  // Color mapping for backgrounds
  const bgColorMap: Record<string, string> = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    emerald: 'bg-emerald-100',
    red: 'bg-red-100',
    yellow: 'bg-yellow-100',
    purple: 'bg-purple-100',
    indigo: 'bg-indigo-100',
    teal: 'bg-teal-100',
    gray: 'bg-gray-100',
  };

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
        bgColorMap[color] || 'bg-gray-100'
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
