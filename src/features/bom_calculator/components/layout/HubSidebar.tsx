import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Calculator,
  FolderOpen,
  Wrench,
  Sliders,
  Package,
  Boxes,
  DollarSign,
  ArrowLeft,
  ChevronRight,
  Pin,
  PinOff,
  FlaskConical,
  Upload,
  ListTodo,
  BarChart3,
  Settings2,
  Warehouse,
  CalendarDays,
  MapPin,
  Smartphone,
  Palette,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

export type BOMHubPage = 'calculator' | 'projects' | 'sku-builder' | 'custom-builder' | 'sku-catalog' | 'sku-import' | 'sku-queue' | 'materials' | 'labor-rates' | 'analytics' | 'component-config' | 'yard-schedule' | 'yard-spots' | 'yard-areas' | 'yard-mobile';

interface NavItem {
  id: BOMHubPage;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'calculator', label: 'Calculator', icon: Calculator },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'sku-builder', label: 'SKU Builder', icon: Wrench },
  { id: 'custom-builder', label: 'Custom Builder', icon: Sliders },
  { id: 'sku-catalog', label: 'SKU Catalog', icon: Package },
];

const YARD_NAV_ITEMS: NavItem[] = [
  { id: 'yard-schedule', label: 'Pick Lists', icon: CalendarDays },
  { id: 'yard-spots', label: 'Yard Spots', icon: MapPin },
  { id: 'yard-areas', label: 'Stocking Areas', icon: Palette },
  { id: 'yard-mobile', label: 'Mobile View', icon: Smartphone },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'sku-import', label: 'SKU Import', icon: Upload, adminOnly: true },
  { id: 'sku-queue', label: 'SKU Queue', icon: ListTodo, adminOnly: true },
  { id: 'materials', label: 'Materials', icon: Boxes, adminOnly: true },
  { id: 'labor-rates', label: 'Labor Rates', icon: DollarSign, adminOnly: true },
  { id: 'component-config', label: 'Components', icon: Settings2, adminOnly: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
];

const STORAGE_KEY = 'sidebar-collapsed-bom-hub';

interface HubSidebarProps {
  activePage: BOMHubPage;
  onPageChange: (page: BOMHubPage) => void;
  onBack: () => void;
  isAdmin: boolean;
  onOpenV2?: () => void;
}

export default function HubSidebar({ activePage, onPageChange, onBack, isAdmin, onOpenV2 }: HubSidebarProps) {
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
            ? 'bg-white text-blue-900 shadow-sm'
            : 'text-blue-100 hover:bg-blue-800/50'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : ''}`} />
        {isExpanded && (
          <>
            <span className="flex-1 font-medium truncate">{item.label}</span>
            {isActive && <ChevronRight className="w-3 h-3 text-blue-600 flex-shrink-0" />}
          </>
        )}
      </button>
    );

    return button;
  };

  return (
    <div
      className={`${isExpanded ? 'w-48' : 'w-14'} bg-[#1E3A8A] flex flex-col h-full transition-all duration-300`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-blue-800">
        <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'}`}>
          {isExpanded && (
            <>
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">BOM Hub</h2>
              </div>
            </>
          )}
          <button
            onClick={handleTogglePin}
            className={`p-1.5 rounded transition-colors ${pinned ? 'text-blue-300 hover:text-white' : 'text-blue-200 hover:text-white hover:bg-blue-800/50'}`}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV_ITEMS.map(renderNavItem)}

        {/* Yard Section */}
        <div className="my-2 border-t border-blue-700" />
        {isExpanded && (
          <div className="px-3 pb-1 flex items-center gap-1.5">
            <Warehouse className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
              Yard
            </span>
          </div>
        )}
        {!isExpanded && (
          <div className="flex justify-center py-1">
            <Warehouse className="w-3 h-3 text-amber-400" />
          </div>
        )}
        {YARD_NAV_ITEMS.map(renderNavItem)}

        {/* Admin Section Divider */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-blue-700" />
            {isExpanded && (
              <div className="px-3 pb-1">
                <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                  Admin
                </span>
              </div>
            )}
            {!isExpanded && (
              <div className="flex justify-center py-1">
                <Settings2 className="w-3 h-3 text-blue-300" />
              </div>
            )}
            {ADMIN_NAV_ITEMS.map(renderNavItem)}

            {/* v2 Beta Button */}
            {onOpenV2 && (
              <button
                onClick={onOpenV2}
                className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 mt-2 rounded-lg bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 transition-colors text-left text-sm border border-purple-500/30`}
              >
                <FlaskConical className="w-4 h-4 flex-shrink-0" />
                {isExpanded && (
                  <>
                    <span className="flex-1 font-medium truncate">Try v2 Beta</span>
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/40 text-purple-100 rounded">
                      NEW
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Back to Main App */}
      <div className="p-2 border-t border-blue-800">
        <button
          onClick={onBack}
          className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-2'} px-3 py-2 rounded-lg text-blue-200 hover:bg-blue-800/50 transition-colors text-sm`}
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span className="font-medium">Back</span>}
        </button>
      </div>
    </div>
  );
}
