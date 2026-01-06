import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Settings,
  Smartphone,
  Bell,
  Users,
  FileText,
  Menu,
  BookOpen,
  Truck,
  SlidersHorizontal,
  ArrowLeft,
  ChevronRight,
  Pin,
  PinOff,
  MapPin,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SidebarTooltip } from '../../../components/sidebar';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

export type SettingsPage =
  | 'app'
  | 'notifications'
  | 'team'
  | 'request-settings'
  | 'menu-visibility'
  | 'qbo-classes'
  | 'fsm'
  | 'custom-fields'
  | 'territories';

interface NavItem {
  id: SettingsPage;
  label: string;
  icon: LucideIcon;
}

const GENERAL_NAV_ITEMS: NavItem[] = [
  { id: 'app', label: 'App', icon: Smartphone },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const TEAM_NAV_ITEMS: NavItem[] = [
  { id: 'team', label: 'Team Management', icon: Users },
];

const CONFIG_NAV_ITEMS: NavItem[] = [
  { id: 'request-settings', label: 'Request Settings', icon: FileText },
  { id: 'menu-visibility', label: 'Menu Visibility', icon: Menu },
  { id: 'qbo-classes', label: 'QBO Classes', icon: BookOpen },
  { id: 'fsm', label: 'FSM', icon: Truck },
  { id: 'custom-fields', label: 'Custom Fields', icon: SlidersHorizontal },
  { id: 'territories', label: 'Territories', icon: MapPin },
];

const STORAGE_KEY = 'sidebar-collapsed-settings';

interface SettingsSidebarProps {
  activePage: SettingsPage;
  onPageChange: (page: SettingsPage) => void;
  onBack: () => void;
}

export default function SettingsSidebar({ activePage, onPageChange, onBack }: SettingsSidebarProps) {
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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;

    const button = (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg transition-colors text-left text-sm ${
          isActive
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-600' : ''}`} />
        {isExpanded && (
          <>
            <span className="flex-1 font-medium truncate">{item.label}</span>
            {isActive && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
          </>
        )}
      </button>
    );

    return (
      <SidebarTooltip key={item.id} label={item.label} showTooltip={!isExpanded}>
        {button}
      </SidebarTooltip>
    );
  };

  const renderSectionHeader = (label: string) => {
    if (!isExpanded) {
      return (
        <SidebarTooltip label={label} showTooltip={true}>
          <div className="flex justify-center py-1">
            <div className="w-1 h-1 bg-slate-500 rounded-full" />
          </div>
        </SidebarTooltip>
      );
    }
    return (
      <div className="px-3 pb-1">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`${isExpanded ? 'w-48' : 'w-14'} bg-slate-800 flex flex-col h-full transition-all duration-300`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-700">
        <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'}`}>
          {isExpanded && (
            <>
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">Settings</h2>
              </div>
            </>
          )}
          <button
            onClick={handleTogglePin}
            className={`p-1.5 rounded transition-colors ${pinned ? 'text-blue-400 hover:text-blue-300' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* General Section */}
        {renderSectionHeader('General')}
        {GENERAL_NAV_ITEMS.map(renderNavItem)}

        {/* Team Section */}
        <div className="my-2 border-t border-slate-700" />
        {renderSectionHeader('Team')}
        {TEAM_NAV_ITEMS.map(renderNavItem)}

        {/* Configuration Section */}
        <div className="my-2 border-t border-slate-700" />
        {renderSectionHeader('Configuration')}
        {CONFIG_NAV_ITEMS.map(renderNavItem)}
      </div>

      {/* Back to Main App */}
      <div className="p-2 border-t border-slate-700">
        <SidebarTooltip label="Back to Main App" showTooltip={!isExpanded}>
          <button
            onClick={onBack}
            className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors text-sm`}
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span className="font-medium">Back</span>}
          </button>
        </SidebarTooltip>
      </div>
    </div>
  );
}
