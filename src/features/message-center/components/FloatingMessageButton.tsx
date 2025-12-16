import { MessageSquare, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useRightPane } from '../context/RightPaneContext';
import { useUnreadNotificationCount } from '../hooks/useNotifications';

interface FloatingMessageButtonProps {
  className?: string;
}

export function FloatingMessageButton({ className }: FloatingMessageButtonProps) {
  const { isOpen, toggle } = useRightPane();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  return (
    <button
      onClick={toggle}
      className={cn(
        'fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center z-40',
        isOpen
          ? 'bg-gray-600 hover:bg-gray-700'
          : 'bg-blue-600 hover:bg-blue-700 hover:scale-105',
        className
      )}
      title={isOpen ? 'Close messages (Ctrl+M)' : 'Open messages (Ctrl+M)'}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <>
          <MessageSquare className="w-6 h-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] text-xs font-bold text-white bg-red-500 rounded-full px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}

export default FloatingMessageButton;
