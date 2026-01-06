import { useState, useEffect, useRef, useCallback } from 'react';

interface UseHoverExpandOptions {
  /** LocalStorage key to persist pinned state */
  storageKey: string;
  /** Delay in ms before expanding on hover (default: 300) */
  expandDelay?: number;
  /** Delay in ms before collapsing when mouse leaves (default: 500) */
  collapseDelay?: number;
  /** Start collapsed by default (default: true) */
  defaultCollapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface UseHoverExpandReturn {
  /** Whether the sidebar is currently collapsed */
  collapsed: boolean;
  /** Whether the sidebar is pinned (locked in current state) */
  pinned: boolean;
  /** Whether currently in "peeking" state (expanded via hover, not pinned) */
  isPeeking: boolean;
  /** Mouse enter handler - attach to sidebar container */
  onMouseEnter: () => void;
  /** Mouse leave handler - attach to sidebar container */
  onMouseLeave: () => void;
  /** Toggle pin state - attach to pin/collapse button */
  togglePin: () => void;
  /** Force expand (for programmatic control) */
  expand: () => void;
  /** Force collapse (for programmatic control) */
  collapse: () => void;
}

/**
 * Hook to manage sidebar hover-to-expand behavior with pin support.
 *
 * Behavior:
 * - Hover to peek: Mouse enters → delay → expands (if not pinned closed)
 * - Leave to collapse: Mouse leaves → delay → collapses (if not pinned open)
 * - Pin toggle: Click button to lock current state
 *
 * State persistence:
 * - Pinned state saved to localStorage
 * - When pinned=true, collapsed state is also saved
 */
export function useHoverExpand({
  storageKey,
  expandDelay = 300,
  collapseDelay = 500,
  defaultCollapsed = true,
  onCollapsedChange,
}: UseHoverExpandOptions): UseHoverExpandReturn {
  // Load initial state from localStorage
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return { pinned: false, collapsed: defaultCollapsed };
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          pinned: parsed.pinned ?? false,
          collapsed: parsed.collapsed ?? defaultCollapsed,
        };
      }
    } catch {
      // Invalid JSON, use defaults
    }
    return { pinned: false, collapsed: defaultCollapsed };
  };

  const initial = getInitialState();
  const [pinned, setPinned] = useState(initial.pinned);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const [isPeeking, setIsPeeking] = useState(false);

  // Refs for timeout management
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef(false);

  // Clear all pending timeouts
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify({ pinned, collapsed }));
    }
  }, [storageKey, pinned, collapsed]);

  // Notify parent of collapsed changes
  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  const onMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    clearTimeouts();

    // Only expand on hover if collapsed and not pinned in collapsed state
    if (collapsed && !pinned) {
      expandTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setCollapsed(false);
          setIsPeeking(true);
        }
      }, expandDelay);
    }
  }, [collapsed, pinned, expandDelay, clearTimeouts]);

  const onMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    clearTimeouts();

    // Only collapse on leave if peeking (expanded via hover, not pinned open)
    if (isPeeking && !pinned) {
      collapseTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setCollapsed(true);
          setIsPeeking(false);
        }
      }, collapseDelay);
    }
  }, [isPeeking, pinned, collapseDelay, clearTimeouts]);

  const togglePin = useCallback(() => {
    clearTimeouts();

    if (pinned) {
      // Unpinning - go back to collapsed state, ready to peek
      setPinned(false);
      setCollapsed(true);
      setIsPeeking(false);
    } else {
      // Pinning - lock in expanded state
      setPinned(true);
      setCollapsed(false);
      setIsPeeking(false);
    }
  }, [pinned, clearTimeouts]);

  const expand = useCallback(() => {
    clearTimeouts();
    setCollapsed(false);
    setIsPeeking(false);
  }, [clearTimeouts]);

  const collapse = useCallback(() => {
    clearTimeouts();
    setCollapsed(true);
    setIsPeeking(false);
  }, [clearTimeouts]);

  return {
    collapsed,
    pinned,
    isPeeking,
    onMouseEnter,
    onMouseLeave,
    togglePin,
    expand,
    collapse,
  };
}

export default useHoverExpand;
