import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Image,
  Calculator,
  FileText,
  ChevronRight,
  TrendingUp,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../contexts/PermissionContext';
import { useTabRoute } from '../../hooks/useTabRoute';
import type { SalesHubView } from './types';
import { SalesDashboard } from './components';

const STORAGE_KEY = 'sidebar-collapsed-sales-hub';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

// Lazy load the actual sales tools to avoid circular dependencies
const SalesCoach = lazy(() => import('../ai-coach').then(m => ({ default: m.SalesCoach })));
const ClientPresentation = lazy(() => import('../sales-tools').then(m => ({ default: m.ClientPresentation })));
const PhotoGallery = lazy(() => import('../photos').then(m => ({ default: m.PhotoGalleryRefactored })));
const StainCalculator = lazy(() => import('../sales-tools').then(m => ({ default: m.StainCalculator })));
const SalesResources = lazy(() => import('../sales-resources').then(m => ({ default: m.SalesResources })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <div className="text-gray-500">Loading...</div>
    </div>
  </div>
);

const NAV_ITEMS: { key: SalesHubView; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'sales-coach', label: 'AI Sales Coach', icon: Bot },
  { key: 'presentation', label: 'Presentation', icon: BookOpen },
  { key: 'photo-gallery', label: 'Photo Gallery', icon: Image },
  { key: 'stain-calculator', label: 'Stain Calculator', icon: Calculator },
  { key: 'sales-resources', label: 'Resources', icon: FileText },
];

interface SalesHubProps {
  onBack?: () => void;
  initialView?: SalesHubView;
}

export default function SalesHub({ onBack: _onBack, initialView = 'dashboard' }: SalesHubProps) {
  const [activeView, setActiveView] = useState<SalesHubView>(initialView);
  const { user, profile } = useAuth();
  const { role } = usePermission();

  // Sync view state with URL
  const { navigateToTab } = useTabRoute<SalesHubView>({
    section: 'sales-hub',
    activeTab: activeView,
    setActiveTab: setActiveView,
  });

  // Load initial state from localStorage (hover-to-expand pattern)
  const getInitialSidebarState = () => {
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

  const initialSidebar = getInitialSidebarState();
  const [pinned, setPinned] = useState(initialSidebar.pinned);
  const [collapsed, setCollapsed] = useState(initialSidebar.collapsed);
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

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pinned, collapsed }));
  }, [pinned, collapsed]);

  const handleSidebarMouseEnter = useCallback(() => {
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

  const handleSidebarMouseLeave = useCallback(() => {
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

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <SalesDashboard onNavigate={navigateToTab} />;
      case 'sales-coach':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SalesCoach userId={user?.id || 'unknown'} />
          </Suspense>
        );
      case 'presentation':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ClientPresentation onBack={() => setActiveView('dashboard')} isMobile={false} />
          </Suspense>
        );
      case 'photo-gallery':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <PhotoGallery onBack={() => setActiveView('dashboard')} viewMode="desktop" />
          </Suspense>
        );
      case 'stain-calculator':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <StainCalculator onBack={() => setActiveView('dashboard')} />
          </Suspense>
        );
      case 'sales-resources':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SalesResources onBack={() => setActiveView('dashboard')} />
          </Suspense>
        );
      default:
        return <SalesDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div
        className={`${isExpanded ? 'w-56' : 'w-14'} bg-gradient-to-b from-amber-700 to-orange-800 text-white flex flex-col transition-all duration-300`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Header */}
        <div className="p-3 border-b border-amber-600">
          <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            {isExpanded && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Sales Hub
              </h1>
            )}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded transition-colors ${pinned ? 'text-amber-300 hover:text-white' : 'text-amber-200 hover:text-white hover:bg-white/10'}`}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
          </div>
          {isExpanded && <p className="text-xs text-amber-200 mt-1">Tools to close more deals</p>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigateToTab(item.key)}
                className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-amber-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {isExpanded && (
                  <>
                    {item.label}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tips Section - hidden when collapsed */}
        {isExpanded && (
          <div className="p-3 border-t border-amber-600">
            <div className="bg-amber-600/50 rounded-lg p-3">
              <p className="text-xs text-amber-100 font-medium mb-1">Pro Tip</p>
              <p className="text-xs text-amber-200">
                Use the AI Sales Coach before customer meetings to prepare objection responses.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
