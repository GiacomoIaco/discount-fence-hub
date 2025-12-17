import { useState, useCallback, useMemo } from 'react';

// ============================================
// CALENDAR VIEW TYPES
// ============================================

export type CalendarViewType =
  | 'crew_capacity'      // Custom capacity-based daily grid for crews
  | 'timeline_day'       // FullCalendar resource timeline day
  | 'timeline_week'      // FullCalendar resource timeline week
  | 'month'              // FullCalendar month grid
  | 'list';              // FullCalendar list view

export interface CalendarViewTab {
  id: string;
  name: string;
  viewType: CalendarViewType;
  // Optional filter overrides per tab
  showCrews: boolean;
  showReps: boolean;
  // For crew_capacity view
  daysToShow?: number; // 5 or 7
}

export interface CalendarViewState {
  activeTabId: string;
  tabs: CalendarViewTab[];
}

// ============================================
// DEFAULT TABS
// ============================================

const DEFAULT_TABS: CalendarViewTab[] = [
  {
    id: 'crew-view',
    name: 'Crew Schedule',
    viewType: 'crew_capacity',
    showCrews: true,
    showReps: false,
    daysToShow: 5,
  },
  {
    id: 'sales-view',
    name: 'Sales Calendar',
    viewType: 'timeline_week',
    showCrews: false,
    showReps: true,
  },
  {
    id: 'full-view',
    name: 'Full View',
    viewType: 'timeline_week',
    showCrews: true,
    showReps: true,
  },
];

const DEFAULT_STATE: CalendarViewState = {
  activeTabId: 'crew-view',
  tabs: DEFAULT_TABS,
};

const STORAGE_KEY = 'calendar_view_state';

// ============================================
// HOOK
// ============================================

export function useCalendarViews() {
  // Initialize from localStorage or defaults
  const [state, setState] = useState<CalendarViewState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure we have at least the default tabs structure
        return {
          ...DEFAULT_STATE,
          ...parsed,
          tabs: parsed.tabs?.length > 0 ? parsed.tabs : DEFAULT_TABS,
        };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_STATE;
  });

  // Persist to localStorage
  const persistState = useCallback((newState: CalendarViewState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Get active tab
  const activeTab = useMemo(() => {
    return state.tabs.find(t => t.id === state.activeTabId) || state.tabs[0];
  }, [state]);

  // Set active tab
  const setActiveTab = useCallback((tabId: string) => {
    setState(prev => {
      const newState = { ...prev, activeTabId: tabId };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  // Update tab settings
  const updateTab = useCallback((tabId: string, updates: Partial<CalendarViewTab>) => {
    setState(prev => {
      const newTabs = prev.tabs.map(tab =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      );
      const newState = { ...prev, tabs: newTabs };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  // Add new tab
  const addTab = useCallback((tab: Omit<CalendarViewTab, 'id'>) => {
    const newTab: CalendarViewTab = {
      ...tab,
      id: `tab-${Date.now()}`,
    };
    setState(prev => {
      const newTabs = [...prev.tabs, newTab];
      const newState = { ...prev, tabs: newTabs, activeTabId: newTab.id };
      persistState(newState);
      return newState;
    });
    return newTab.id;
  }, [persistState]);

  // Remove tab (keep at least one)
  const removeTab = useCallback((tabId: string) => {
    setState(prev => {
      if (prev.tabs.length <= 1) return prev;

      const newTabs = prev.tabs.filter(t => t.id !== tabId);
      const newActiveId = prev.activeTabId === tabId
        ? newTabs[0].id
        : prev.activeTabId;

      const newState = { ...prev, tabs: newTabs, activeTabId: newActiveId };
      persistState(newState);
      return newState;
    });
  }, [persistState]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setState(DEFAULT_STATE);
    persistState(DEFAULT_STATE);
  }, [persistState]);

  return {
    // State
    tabs: state.tabs,
    activeTab,
    activeTabId: state.activeTabId,

    // Actions
    setActiveTab,
    updateTab,
    addTab,
    removeTab,
    resetToDefaults,

    // Helpers
    isCrewCapacityView: activeTab.viewType === 'crew_capacity',
    isTimelineView: activeTab.viewType === 'timeline_day' || activeTab.viewType === 'timeline_week',
  };
}

// ============================================
// VIEW TYPE LABELS
// ============================================

export const VIEW_TYPE_LABELS: Record<CalendarViewType, string> = {
  crew_capacity: 'Crew Capacity',
  timeline_day: 'Day Timeline',
  timeline_week: 'Week Timeline',
  month: 'Month',
  list: 'List',
};
