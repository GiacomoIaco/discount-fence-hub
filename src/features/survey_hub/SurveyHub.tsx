import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Plus,
  ChevronRight,
  Pin,
  PinOff,
} from 'lucide-react';
import type { SurveyHubView } from './types';
import SurveysDashboard from './components/SurveysDashboard';
import SurveysList from './components/SurveysList';
import PopulationsList from './components/PopulationsList';
import CampaignsList from './components/CampaignsList';
import AnalyticsDashboard from './components/AnalyticsDashboard';

const STORAGE_KEY = 'sidebar-collapsed-survey-hub';

// Hover timing constants (in ms)
const EXPAND_DELAY = 300;
const COLLAPSE_DELAY = 500;

const NAV_ITEMS: { key: SurveyHubView; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'surveys', label: 'Surveys', icon: FileText },
  { key: 'populations', label: 'Populations', icon: Users },
  { key: 'campaigns', label: 'Campaigns', icon: Calendar },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface SurveyHubProps {
  onBack?: () => void;
}

export default function SurveyHub({ onBack: _onBack }: SurveyHubProps) {
  const [activeView, setActiveView] = useState<SurveyHubView>('dashboard');

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
        return <SurveysDashboard onNavigate={setActiveView} />;
      case 'surveys':
        return <SurveysList />;
      case 'populations':
        return <PopulationsList />;
      case 'campaigns':
        return <CampaignsList />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <SurveysDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div
        className={`${isExpanded ? 'w-56' : 'w-14'} bg-gradient-to-b from-emerald-800 to-teal-900 text-white flex flex-col transition-all duration-300`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Header */}
        <div className="p-3 border-b border-emerald-700">
          <div className={`flex items-center ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            {isExpanded && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Survey Hub
              </h1>
            )}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded transition-colors ${pinned ? 'text-emerald-300 hover:text-white' : 'text-emerald-200 hover:text-white hover:bg-white/10'}`}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            >
              {pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
          </div>
          {isExpanded && <p className="text-xs text-emerald-200 mt-1">Customer Feedback System</p>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-emerald-100 hover:bg-white/10 hover:text-white'
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

        {/* Quick Actions */}
        <div className="p-2 border-t border-emerald-700 space-y-2">
          <button
            onClick={() => setActiveView('surveys')}
            className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors`}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            {isExpanded && 'New Survey'}
          </button>
          <button
            onClick={() => setActiveView('campaigns')}
            className={`w-full flex items-center ${!isExpanded ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium transition-colors`}
          >
            <Calendar className="w-4 h-4 flex-shrink-0" />
            {isExpanded && 'New Campaign'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
