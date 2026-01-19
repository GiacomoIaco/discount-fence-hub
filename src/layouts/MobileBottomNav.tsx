import { Home, MessageSquare, Mic, RefreshCw, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Section } from '../lib/routes';

interface MobileBottomNavProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onVoiceRecord: () => void;
  onRefresh: () => void;
  unreadMessageCount: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  action: 'navigate' | 'action';
  section?: Section;
  onClick?: () => void;
  badge?: number;
  isActive?: boolean;
}

export default function MobileBottomNav({
  activeSection,
  onNavigate,
  onVoiceRecord,
  onRefresh,
  unreadMessageCount,
}: MobileBottomNavProps) {
  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      action: 'navigate',
      section: 'home',
      isActive: activeSection === 'home',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      action: 'navigate',
      section: 'mobile-inbox',
      badge: unreadMessageCount,
      isActive: activeSection === 'mobile-inbox',
    },
    {
      id: 'voice',
      label: 'Voice',
      icon: Mic,
      action: 'action',
      onClick: onVoiceRecord,
    },
    {
      id: 'refresh',
      label: 'Refresh',
      icon: RefreshCw,
      action: 'action',
      onClick: onRefresh,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      action: 'navigate',
      section: 'analytics',
      isActive: activeSection === 'analytics',
    },
  ];

  const handleItemClick = (item: NavItem) => {
    if (item.action === 'navigate' && item.section) {
      onNavigate(item.section);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive;
          const hasBadge = (item.badge ?? 0) > 0;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-[64px] transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-500 active:text-gray-700'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {hasBadge && (
                  <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full px-1">
                    {item.badge! > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
