import SidebarItem from './SidebarItem';
import SidebarTooltip from './SidebarTooltip';
import type { SidebarSectionConfig, SidebarColorScheme } from './types';
import { colorSchemes } from './types';

interface SidebarSectionProps extends SidebarSectionConfig {
  collapsed: boolean;
  colorScheme: SidebarColorScheme;
  showActiveIndicator?: boolean;
  showDivider?: boolean; // Show divider before section
}

/**
 * Section grouping for sidebar items.
 * - Shows section title when expanded (e.g., "Yard", "Admin")
 * - Shows horizontal divider when collapsed
 * - Maps over items and renders SidebarItem components
 */
export default function SidebarSection({
  id,
  title,
  titleIcon: TitleIcon,
  titleIconColor,
  items,
  collapsed,
  colorScheme,
  showActiveIndicator,
  showDivider = false,
}: SidebarSectionProps) {
  const scheme = colorSchemes[colorScheme];

  // If no items, don't render anything
  if (items.length === 0) return null;

  return (
    <div data-sidebar-section={id}>
      {/* Divider (shows both expanded and collapsed) */}
      {showDivider && (
        <div className={`my-2 border-t ${scheme.border}`} />
      )}

      {/* Section Header (only when expanded and has title) */}
      {title && !collapsed && (
        <div className="px-3 pb-1 flex items-center gap-1.5">
          {TitleIcon && (
            <TitleIcon className={`w-3 h-3 ${titleIconColor || scheme.sectionTitle}`} />
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${scheme.sectionTitle}`}>
            {title}
          </span>
        </div>
      )}

      {/* Section Header Tooltip (when collapsed and has title) */}
      {title && collapsed && (
        <SidebarTooltip label={title} showTooltip={true}>
          <div className={`my-2 mx-2 border-t ${scheme.border} relative`}>
            {TitleIcon && (
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-inherit">
                <TitleIcon className={`w-3 h-3 ${titleIconColor || scheme.sectionTitle}`} />
              </div>
            )}
          </div>
        </SidebarTooltip>
      )}

      {/* Items */}
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarItem
            key={item.id}
            {...item}
            collapsed={collapsed}
            colorScheme={colorScheme}
            showActiveIndicator={showActiveIndicator}
          />
        ))}
      </div>
    </div>
  );
}
