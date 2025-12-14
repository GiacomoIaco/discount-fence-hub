/**
 * useRouteSync - Bidirectional sync between URL and activeSection state
 *
 * This hook enables URL-based navigation while keeping the existing
 * state-based rendering logic intact. It:
 *
 * 1. Updates activeSection when URL changes (browser back/forward, direct URL)
 * 2. Updates URL when activeSection changes (navigation clicks)
 * 3. Handles initial page load to restore correct section from URL
 * 4. Parses entity routes (e.g., /clients/abc123) and extracts entity info
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  sectionToPath,
  parseEntityUrl,
  buildEntityUrl,
  getBestMatchingSection,
  type Section,
  type EntityType
} from '../lib/routes';

/**
 * Entity context from URL - passed to components that need to show specific entities
 */
export interface EntityContext {
  type: EntityType;
  id: string;
  params: Record<string, string>;
}


interface UseRouteSyncOptions {
  /** Current active section from state */
  activeSection: Section;
  /** State setter for active section */
  setActiveSection: (section: Section) => void;
  /** Optional callback when section changes via URL */
  onSectionChange?: (section: Section, source: 'url' | 'state') => void;
  /** Optional callback when entity context changes */
  onEntityChange?: (entity: EntityContext | null) => void;
}

interface UseRouteSyncReturn {
  /** Navigate to a section (updates both URL and state) */
  navigateTo: (section: Section) => void;
  /** Navigate to a specific entity (e.g., client, request) */
  navigateToEntity: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list view) */
  clearEntity: () => void;
  /** Current entity context from URL (null if on list view) */
  entityContext: EntityContext | null;
  /** Current path from URL */
  currentPath: string;
}

export function useRouteSync({
  activeSection,
  setActiveSection,
  onSectionChange,
  onEntityChange,
}: UseRouteSyncOptions): UseRouteSyncReturn {
  const location = useLocation();
  const navigate = useNavigate();

  // Track entity context from URL
  const [entityContext, setEntityContext] = useState<EntityContext | null>(null);

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

    // First, check if this is an entity route (e.g., /clients/abc123)
    const entityInfo = parseEntityUrl(location.pathname);

    if (entityInfo) {
      // Entity route - set section and entity context
      const newEntity: EntityContext = {
        type: entityInfo.type,
        id: entityInfo.params.id,
        params: entityInfo.params,
      };

      if (entityInfo.section !== activeSection) {
        lastChangeSource.current = 'url';
        setActiveSection(entityInfo.section);
        onSectionChange?.(entityInfo.section, 'url');
      }

      setEntityContext(newEntity);
      onEntityChange?.(newEntity);
    } else {
      // Regular section route
      const sectionFromUrl = getBestMatchingSection(location.pathname);

      if (sectionFromUrl !== activeSection) {
        lastChangeSource.current = 'url';
        setActiveSection(sectionFromUrl);
        onSectionChange?.(sectionFromUrl, 'url');
      }

      // Clear entity context when navigating to a list view
      if (entityContext !== null) {
        setEntityContext(null);
        onEntityChange?.(null);
      }
    }

    isInitialized.current = true;
  }, [location.pathname, activeSection, setActiveSection, onSectionChange, onEntityChange, entityContext]);

  // Handle state changes (navigation clicks) - only for section changes without entity
  useEffect(() => {
    // Skip initial render and URL-triggered changes
    if (!isInitialized.current || lastChangeSource.current === 'url') {
      lastChangeSource.current = null;
      return;
    }

    // Don't update URL if we're on an entity route (let entity navigation handle it)
    const currentEntityInfo = parseEntityUrl(location.pathname);
    if (currentEntityInfo) {
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
      const entityInfo = parseEntityUrl(location.pathname);

      if (entityInfo) {
        setActiveSection(entityInfo.section);
        setEntityContext({
          type: entityInfo.type,
          id: entityInfo.params.id,
          params: entityInfo.params,
        });
      } else {
        const sectionFromUrl = getBestMatchingSection(location.pathname);
        if (sectionFromUrl !== activeSection) {
          setActiveSection(sectionFromUrl);
        }
      }

      isInitialized.current = true;
    }
  }, [location.pathname, activeSection, setActiveSection]);

  // Navigate to a section (clears entity context)
  const navigateTo = useCallback(
    (section: Section) => {
      lastChangeSource.current = 'state';
      setActiveSection(section);
      setEntityContext(null);
      onEntityChange?.(null);
      navigate(sectionToPath(section), { replace: false });
    },
    [setActiveSection, navigate, onEntityChange]
  );

  // Navigate to a specific entity
  const navigateToEntity = useCallback(
    (entityType: EntityType, params: Record<string, string>) => {
      const url = buildEntityUrl(entityType, params);
      const entityInfo = parseEntityUrl(url);

      if (entityInfo) {
        lastChangeSource.current = 'state';
        setActiveSection(entityInfo.section);

        const newEntity: EntityContext = {
          type: entityType,
          id: params.id,
          params,
        };
        setEntityContext(newEntity);
        onEntityChange?.(newEntity);

        navigate(url, { replace: false });
      }
    },
    [setActiveSection, navigate, onEntityChange]
  );

  // Clear entity selection (go back to list view)
  const clearEntity = useCallback(() => {
    if (entityContext) {
      lastChangeSource.current = 'state';
      setEntityContext(null);
      onEntityChange?.(null);
      navigate(sectionToPath(activeSection), { replace: false });
    }
  }, [entityContext, activeSection, navigate, onEntityChange]);

  return {
    navigateTo,
    navigateToEntity,
    clearEntity,
    entityContext,
    currentPath: location.pathname,
  };
}

/**
 * Simple navigation hook for components that just need to navigate
 * without managing activeSection state
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateTo = useCallback(
    (section: Section) => {
      navigate(sectionToPath(section));
    },
    [navigate]
  );

  const navigateToEntity = useCallback(
    (entityType: EntityType, params: Record<string, string>) => {
      const url = buildEntityUrl(entityType, params);
      navigate(url);
    },
    [navigate]
  );

  const navigateToPath = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  // Get current entity context from URL
  const getEntityContext = useCallback((): EntityContext | null => {
    const entityInfo = parseEntityUrl(location.pathname);
    if (entityInfo) {
      return {
        type: entityInfo.type,
        id: entityInfo.params.id,
        params: entityInfo.params,
      };
    }
    return null;
  }, [location.pathname]);

  return {
    navigateTo,
    navigateToEntity,
    navigateToPath,
    getEntityContext,
    currentPath: location.pathname,
  };
}
