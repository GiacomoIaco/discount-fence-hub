/**
 * useTabRoute - Sync internal tab state with URL
 *
 * This hook enables URL-based tab navigation within sections.
 * It keeps the internal tab state in sync with the URL, supporting:
 * - Browser back/forward navigation
 * - Direct URL access to specific tabs
 * - Bookmarkable tab URLs
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildTabUrl, getTabFromPath, TAB_ROUTES, type Section } from '../lib/routes';

interface UseTabRouteOptions<T extends string> {
  /** The section this component belongs to */
  section: Section;
  /** Current active tab from component state */
  activeTab: T;
  /** State setter for active tab */
  setActiveTab: (tab: T) => void;
  /** Optional: override default tab */
  defaultTab?: T;
}

interface UseTabRouteReturn<T extends string> {
  /** Navigate to a specific tab (updates both URL and state) */
  navigateToTab: (tab: T) => void;
  /** Current tab from URL */
  currentTab: T;
}

export function useTabRoute<T extends string>({
  section,
  activeTab,
  setActiveTab,
  defaultTab,
}: UseTabRouteOptions<T>): UseTabRouteReturn<T> {
  const location = useLocation();
  const navigate = useNavigate();

  // Track the source of the last change to prevent infinite loops
  const lastChangeSource = useRef<'url' | 'state' | null>(null);
  const isInitialized = useRef(false);

  // Get the config for this section
  const config = TAB_ROUTES[section];
  const effectiveDefaultTab = (defaultTab || config?.defaultTab || '') as T;

  // Get current tab from URL
  const currentTabFromUrl = getTabFromPath(section, location.pathname) as T;

  // Handle URL changes (browser back/forward, direct URL entry)
  useEffect(() => {
    // Skip if we just changed the URL from state
    if (lastChangeSource.current === 'state') {
      lastChangeSource.current = null;
      return;
    }

    // Only sync if the URL tab is different from current state
    const tabFromUrl = getTabFromPath(section, location.pathname) as T;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      lastChangeSource.current = 'url';
      setActiveTab(tabFromUrl);
    }

    isInitialized.current = true;
  }, [location.pathname, section, activeTab, setActiveTab]);

  // Handle state changes (tab clicks)
  useEffect(() => {
    // Skip initial render and URL-triggered changes
    if (!isInitialized.current || lastChangeSource.current === 'url') {
      lastChangeSource.current = null;
      return;
    }

    const targetPath = buildTabUrl(section, activeTab);

    // Only update URL if different from current path
    if (location.pathname !== targetPath) {
      lastChangeSource.current = 'state';
      navigate(targetPath, { replace: false });
    }
  }, [activeTab, section, location.pathname, navigate]);

  // Initial sync: set tab from URL on first mount
  useEffect(() => {
    if (!isInitialized.current) {
      const tabFromUrl = getTabFromPath(section, location.pathname) as T;
      if (tabFromUrl && tabFromUrl !== activeTab) {
        setActiveTab(tabFromUrl);
      }
      isInitialized.current = true;
    }
  }, [section, location.pathname, activeTab, setActiveTab]);

  // Navigate to a specific tab
  const navigateToTab = useCallback(
    (tab: T) => {
      lastChangeSource.current = 'state';
      setActiveTab(tab);
      navigate(buildTabUrl(section, tab), { replace: false });
    },
    [section, setActiveTab, navigate]
  );

  return {
    navigateToTab,
    currentTab: currentTabFromUrl || effectiveDefaultTab,
  };
}
