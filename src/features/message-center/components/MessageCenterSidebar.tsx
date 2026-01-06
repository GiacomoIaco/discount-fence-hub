import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Phone,
  Inbox,
  Users,
  Building2,
  FileText,
  Archive,
  Pin,
  PinOff,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConversationFilter, ConversationCounts } from '../types';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

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
  // Load initial state from localStorage
  const getInitialState = () => {
    if (typeof window === 'undefined') return { pinned: false, collapsed: true };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          pinned: parsed.pinned ?? false,
          collapsed: parsed.collapsed ?? true,
        };
      }
    } catch {
      // Legacy format (just boolean string) - migrate to new format
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy === 'true' || legacy === 'false') {
        return { pinned: false, collapsed: legacy === 'true' };
      }
    }
    return { pinned: false, collapsed: true };
  };

  const initial = getInitialState();
  const [pinned, setPinned] = useState(initial.pinned);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const [isPeeking, setIsPeeking] = useState(false);

  // Refs for timeout management
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Sidebar is expanded if pinned open OR peeking
  const isExpanded = pinned || isPeeking || !collapsed;

  const clearTimeouts = useCallback(() => {
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinned, collapsed }));
  }, [pinned, collapsed]);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeouts();

    // Only peek if collapsed and not pinned
    if (collapsed && !pinned) {
      expandTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setIsPeeking(true);
        }
      }, EXPAND_DELAY);
    }
  }, [collapsed, pinned, clearTimeouts]);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeouts();

    // Only collapse if peeking (not pinned open)
    if (isPeeking) {
      collapseTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsPeeking(false);
        }
      }, COLLAPSE_DELAY);
    }
  }, [isPeeking, clearTimeouts]);

  const handleTogglePin = useCallback(() => {
    clearTimeouts();
    if (pinned) {
      // Unpin - go to collapsed state
      setPinned(false);
      setCollapsed(true);
      setIsPeeking(false);
    } else {
      // Pin open
      setPinned(true);
      setCollapsed(false);
      setIsPeeking(false);
    }
  }, [pinned, clearTimeouts]);

  const renderFilterItem = (item: FilterItem) => {
    const Icon = item.icon;
    const isActive = activeFilter === item.id;
    const count = counts[item.countKey];

    const button = (
      <button
        key={item.id}
        onClick={() => onFilterChange(item.id)}
        className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg transition-colors text-left text-sm ${
          isActive
            ? 'bg-white text-blue-900 shadow-sm'
            : 'text-blue-100 hover:bg-blue-700/50'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
        {isExpanded && (
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

    return button;
  };

  return (
    <div
      className={`${isExpanded ? 'w-48' : 'w-14'} bg-blue-800 flex flex-col h-full transition-all duration-300`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-blue-700">
        <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'}`}>
          {isExpanded && (
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
            onClick={handleTogglePin}
            className={`p-1.5 rounded transition-colors ${pinned ? 'text-blue-300 hover:text-white' : 'text-blue-200 hover:text-white hover:bg-blue-700/50'}`}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Filter Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {FILTER_ITEMS.map(renderFilterItem)}
      </div>

      {/* Service Phone Plan button like Workiz */}
      <div className="p-2 border-t border-blue-700">
        <button
          className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-700/50 transition-colors text-sm`}
        >
          <Phone className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span className="font-medium text-xs">Connect QUO Phone</span>}
        </button>
      </div>
    </div>
  );
}

export default MessageCenterSidebar;
