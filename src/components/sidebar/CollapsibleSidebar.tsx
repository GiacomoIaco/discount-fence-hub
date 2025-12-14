import { useState, useEffect } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import SidebarSection from './SidebarSection';
import type { CollapsibleSidebarProps } from './types';
import { colorSchemes } from './types';

/**
 * Main collapsible sidebar wrapper component.
 * - Manages collapsed state with localStorage persistence
 * - Renders collapse/expand toggle button at top
 * - Smooth width transition
 * - Supports multiple color schemes
 */
export default function CollapsibleSidebar({
  storageKey,
  sections,
  header,
  footer,
  colorScheme = 'dark',
  defaultCollapsed = false,
  expandedWidth = 'w-64',
  collapsedWidth = 'w-14',
  onCollapsedChange,
  className = '',
  // Controlled mode props
  collapsed: controlledCollapsed,
  onToggle,
}: CollapsibleSidebarProps) {
  // Use controlled mode if both collapsed and onToggle are provided
  const isControlled = controlledCollapsed !== undefined && onToggle !== undefined;

  // Internal state for uncontrolled mode
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultCollapsed;
  });

  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const scheme = colorSchemes[colorScheme];

  // Persist collapsed state to localStorage (uncontrolled mode)
  useEffect(() => {
    if (!isControlled) {
      localStorage.setItem(storageKey, String(internalCollapsed));
      onCollapsedChange?.(internalCollapsed);
    }
  }, [internalCollapsed, storageKey, isControlled, onCollapsedChange]);

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <div
      className={`
        ${collapsed ? collapsedWidth : expandedWidth}
        h-full ${scheme.bg} text-white
        transition-all duration-300 ease-in-out
        flex flex-col overflow-visible
        ${className}
      `}
      data-sidebar-collapsed={collapsed}
    >
      {/* Header with collapse toggle */}
      <div className={`p-3 border-b ${scheme.headerBorder}`}>
        {header ? (
          <div className="flex items-center justify-between gap-2">
            {!collapsed && <div className="flex-1 min-w-0">{header}</div>}
            <button
              onClick={handleToggle}
              className={`p-1.5 ${scheme.text} ${scheme.hover} rounded transition-colors flex-shrink-0`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          </div>
        ) : (
          <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
            <button
              onClick={handleToggle}
              className={`p-1.5 ${scheme.text} ${scheme.hover} rounded transition-colors`}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {sections.map((section, index) => (
          <SidebarSection
            key={section.id}
            {...section}
            collapsed={collapsed}
            colorScheme={colorScheme}
            showActiveIndicator={colorScheme === 'blue'}
            showDivider={index > 0 || !!section.title}
          />
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className={`p-2 border-t ${scheme.headerBorder}`}>
          {footer}
        </div>
      )}
    </div>
  );
}
