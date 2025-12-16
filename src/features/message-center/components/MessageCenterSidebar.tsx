import { useEffect, useState } from 'react';
import {
  Phone,
  Inbox,
  Users,
  Building2,
  FileText,
  Archive,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SidebarTooltip } from '../../../components/sidebar';
import type { ConversationFilter, ConversationCounts } from '../types';

interface FilterItem {
  id: ConversationFilter;
  label: string;
  icon: LucideIcon;
  countKey: keyof ConversationCounts;
}

const FILTER_ITEMS: FilterItem[] = [
  { id: 'all', label: 'All', icon: Inbox, countKey: 'all' },
  { id: 'team', label: 'Team', icon: Users, countKey: 'team' },
  { id: 'clients', label: 'Clients', icon: Building2, countKey: 'clients' },
  { id: 'requests', label: 'Requests', icon: FileText, countKey: 'requests' },
  { id: 'archived', label: 'Archived', icon: Archive, countKey: 'archived' },
];

const STORAGE_KEY = 'sidebar-collapsed-message-center';

interface MessageCenterSidebarProps {
  activeFilter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  counts: ConversationCounts;
}

export function MessageCenterSidebar({
  activeFilter,
  onFilterChange,
  counts
}: MessageCenterSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const renderFilterItem = (item: FilterItem) => {
    const Icon = item.icon;
    const isActive = activeFilter === item.id;
    const count = counts[item.countKey];

    const button = (
      <button
        key={item.id}
        onClick={() => onFilterChange(item.id)}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg transition-colors text-left text-sm ${
          isActive
            ? 'bg-white text-blue-900 shadow-sm'
            : 'text-blue-100 hover:bg-blue-700/50'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
        {!collapsed && (
          <>
            <span className="flex-1 font-medium truncate">{item.label}</span>
            {count > 0 && (
              <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-medium ${
                isActive ? 'bg-blue-100 text-blue-700' : 'bg-blue-700/50 text-blue-100'
              }`}>
                {count}
              </span>
            )}
            {isActive && <ChevronRight className="w-3 h-3 text-blue-600 flex-shrink-0" />}
          </>
        )}
      </button>
    );

    return (
      <SidebarTooltip key={item.id} label={`${item.label} (${count})`} showTooltip={collapsed}>
        {button}
      </SidebarTooltip>
    );
  };

  return (
    <div className={`${collapsed ? 'w-14' : 'w-48'} bg-blue-800 flex flex-col h-full transition-all duration-300`}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-blue-700">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
          {!collapsed && (
            <>
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">Messages</h2>
              </div>
            </>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-700/50 rounded transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {FILTER_ITEMS.map(renderFilterItem)}
      </div>

      {/* Service Phone Plan button like Workiz */}
      <div className="p-2 border-t border-blue-700">
        <SidebarTooltip label="Connect Phone Service" showTooltip={collapsed}>
          <button
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-700/50 transition-colors text-sm`}
          >
            <Phone className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="font-medium text-xs">Connect QUO Phone</span>}
          </button>
        </SidebarTooltip>
      </div>
    </div>
  );
}

export default MessageCenterSidebar;
