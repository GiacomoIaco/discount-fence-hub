import { useEffect, useState } from 'react';
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
  PanelLeftClose,
  PanelLeft,
  MapPin,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SidebarTooltip } from '../../../components/sidebar';

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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;

    const button = (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg transition-colors text-left text-sm ${
          isActive
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-200 hover:bg-slate-700/50'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-slate-600' : ''}`} />
        {!collapsed && (
          <>
            <span className="flex-1 font-medium truncate">{item.label}</span>
            {isActive && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
          </>
        )}
      </button>
    );

    return (
      <SidebarTooltip key={item.id} label={item.label} showTooltip={collapsed}>
        {button}
      </SidebarTooltip>
    );
  };

  const renderSectionHeader = (label: string) => {
    if (collapsed) {
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
    <div className={`${collapsed ? 'w-14' : 'w-48'} bg-slate-800 flex flex-col h-full transition-all duration-300`}>
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-700">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
          {!collapsed && (
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
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
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
        <SidebarTooltip label="Back to Main App" showTooltip={collapsed}>
          <button
            onClick={onBack}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700/50 transition-colors text-sm`}
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="font-medium">Back</span>}
          </button>
        </SidebarTooltip>
      </div>
    </div>
  );
}
