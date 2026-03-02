import { MessageSquare, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface CrewBottomNavProps {
  activeTab: 'chat' | 'profile';
  onTabChange: (tab: 'chat' | 'profile') => void;
  unreadCount: number;
}

export default function CrewBottomNav({ activeTab, onTabChange, unreadCount }: CrewBottomNavProps) {
  const tabs = [
    {
      id: 'chat' as const,
      label: 'Chat',
      icon: MessageSquare,
      badge: unreadCount,
    },
    {
      id: 'profile' as const,
      label: 'Perfil',
      icon: User,
      badge: 0,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasBadge = tab.badge > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[64px] flex-1 transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500 active:text-gray-700'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {hasBadge && (
                  <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
