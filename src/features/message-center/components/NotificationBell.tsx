import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '../../../lib/utils';
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
              href="/contact-center?tab=notifications"
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
