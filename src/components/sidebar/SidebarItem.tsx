import { ChevronRight } from 'lucide-react';
import SidebarTooltip from './SidebarTooltip';
import type { SidebarItemConfig, SidebarColorScheme } from './types';
import { colorSchemes } from './types';

interface SidebarItemProps extends SidebarItemConfig {
  collapsed: boolean;
  colorScheme: SidebarColorScheme;
  showActiveIndicator?: boolean; // Show ChevronRight when active
}

/**
 * Individual sidebar navigation item.
 * - Shows icon + label when expanded
 * - Shows icon only when collapsed (with tooltip on hover)
 * - Handles active state, badges, disabled state
 */
export default function SidebarItem({
  id,
  label,
  icon: Icon,
  onClick,
  badge,
  disabled,
  disabledLabel = 'Soon',
  active,
  highlight,
  highlightColor = 'purple',
  highlightBadge,
  collapsed,
  colorScheme,
  showActiveIndicator = false,
}: SidebarItemProps) {
  const scheme = colorSchemes[colorScheme];

  // Highlight button styling (like v2 Beta)
  const highlightStyles = {
    purple: 'bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 border border-purple-500/30',
    amber: 'bg-amber-600/20 text-amber-200 hover:bg-amber-600/30 border border-amber-500/30',
    green: 'bg-green-600/20 text-green-200 hover:bg-green-600/30 border border-green-500/30',
  };

  const highlightBadgeStyles = {
    purple: 'bg-purple-500/40 text-purple-100',
    amber: 'bg-amber-500/40 text-amber-100',
    green: 'bg-green-500/40 text-green-100',
  };

  const getButtonClasses = () => {
    const baseClasses = 'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm';

    if (highlight) {
      return `${baseClasses} ${highlightStyles[highlightColor]}`;
    }

    if (disabled) {
      return `${baseClasses} ${scheme.disabled}`;
    }

    if (active) {
      return `${baseClasses} ${scheme.active}`;
    }

    return `${baseClasses} ${scheme.text} ${scheme.hover}`;
  };

  const button = (
    <button
      onClick={() => !disabled && onClick?.()}
      disabled={disabled}
      className={getButtonClasses()}
      data-sidebar-item={id}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${active && colorScheme === 'blue' ? 'text-blue-600' : ''}`} />

      {!collapsed && (
        <>
          <span className="flex-1 font-medium truncate">{label}</span>

          {/* Disabled label */}
          {disabled && (
            <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
              {disabledLabel}
            </span>
          )}

          {/* Highlight badge (e.g., "NEW") */}
          {highlight && highlightBadge && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded ${highlightBadgeStyles[highlightColor]}`}>
              {highlightBadge}
            </span>
          )}

          {/* Regular badge (notification count) */}
          {!disabled && !highlight && badge !== undefined && badge > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}

          {/* Active indicator */}
          {showActiveIndicator && active && (
            <ChevronRight className={`w-3 h-3 flex-shrink-0 ${colorScheme === 'blue' ? 'text-blue-600' : 'text-current'}`} />
          )}
        </>
      )}

      {/* Badge shown when collapsed (small dot indicator) */}
      {collapsed && !disabled && badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  );

  return (
    <SidebarTooltip label={label} showTooltip={collapsed} badge={badge}>
      <div className="relative">
        {button}
      </div>
    </SidebarTooltip>
  );
}
