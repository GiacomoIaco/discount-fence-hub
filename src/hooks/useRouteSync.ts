/**
 * useRouteSync - Bidirectional sync between URL and activeSection state
 *
 * This hook enables URL-based navigation while keeping the existing
 * state-based rendering logic intact. It:
 *
 * 1. Updates activeSection when URL changes (browser back/forward, direct URL)
 * 2. Updates URL when activeSection changes (navigation clicks)
 * 3. Handles initial page load to restore correct section from URL
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pathToSection, sectionToPath, type Section } from '../lib/routes';

interface UseRouteSyncOptions {
  /** Current active section from state */
  activeSection: Section;
  /** State setter for active section */
  setActiveSection: (section: Section) => void;
  /** Optional callback when section changes via URL */
  onSectionChange?: (section: Section, source: 'url' | 'state') => void;
}

interface UseRouteSyncReturn {
  /** Navigate to a section (updates both URL and state) */
  navigateTo: (section: Section) => void;
  /** Current path from URL */
  currentPath: string;
}

export function useRouteSync({
  activeSection,
  setActiveSection,
  onSectionChange,
}: UseRouteSyncOptions): UseRouteSyncReturn {
  const location = useLocation();
  const navigate = useNavigate();

  // Track the source of the last change to prevent infinite loops
  const lastChangeSource = useRef<'url' | 'state' | null>(null);
  const isInitialized = useRef(false);

  // Handle URL changes (browser back/forward, direct URL entry)
  useEffect(() => {
    // Skip if we just changed the URL from state
    if (lastChangeSource.current === 'state') {
      lastChangeSource.current = null;
      return;
    }

    const sectionFromUrl = pathToSection(location.pathname);

    // Only update if different from current section
    if (sectionFromUrl !== activeSection) {
      lastChangeSource.current = 'url';
      setActiveSection(sectionFromUrl);
      onSectionChange?.(sectionFromUrl, 'url');
    }

    isInitialized.current = true;
  }, [location.pathname, activeSection, setActiveSection, onSectionChange]);

  // Handle state changes (navigation clicks)
  useEffect(() => {
    // Skip initial render and URL-triggered changes
    if (!isInitialized.current || lastChangeSource.current === 'url') {
      lastChangeSource.current = null;
      return;
    }

    const targetPath = sectionToPath(activeSection);

    // Only update URL if different from current path
    if (location.pathname !== targetPath) {
      lastChangeSource.current = 'state';
      navigate(targetPath, { replace: false });
      onSectionChange?.(activeSection, 'state');
    }
  }, [activeSection, location.pathname, navigate, onSectionChange]);

  // Initial sync: set section from URL on first mount
  useEffect(() => {
    if (!isInitialized.current) {
      const sectionFromUrl = pathToSection(location.pathname);
      if (sectionFromUrl !== activeSection) {
        setActiveSection(sectionFromUrl);
      }
      isInitialized.current = true;
    }
  }, [location.pathname, activeSection, setActiveSection]);

  // Navigate function for programmatic navigation
  const navigateTo = useCallback(
    (section: Section) => {
      if (section !== activeSection) {
        lastChangeSource.current = 'state';
        setActiveSection(section);
        navigate(sectionToPath(section), { replace: false });
      }
    },
    [activeSection, setActiveSection, navigate]
  );

  return {
    navigateTo,
    currentPath: location.pathname,
  };
}

/**
 * Simple navigation hook for components that just need to navigate
 * without managing activeSection state
 */
export function useAppNavigation() {
  const navigate = useNavigate();

  const navigateTo = useCallback(
    (section: Section) => {
      navigate(sectionToPath(section));
    },
    [navigate]
  );

  const navigateToEntity = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  return {
    navigateTo,
    navigateToEntity,
  };
}
