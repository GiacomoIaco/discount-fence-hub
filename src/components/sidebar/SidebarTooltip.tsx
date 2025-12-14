import type { ReactNode } from 'react';

interface SidebarTooltipProps {
  label: string;
  children: ReactNode;
  showTooltip: boolean; // Only show tooltip when sidebar is collapsed
  badge?: number;
}

/**
 * CSS-only tooltip wrapper for sidebar items.
 * Shows tooltip to the right of the item on hover.
 * Only active when showTooltip is true (i.e., sidebar is collapsed).
 */
export default function SidebarTooltip({ label, children, showTooltip, badge }: SidebarTooltipProps) {
  if (!showTooltip) {
    return <>{children}</>;
  }

  return (
    <div className="group/tooltip relative">
      {children}
      <div className="
        absolute left-full ml-2 top-1/2 -translate-y-1/2
        px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md
        opacity-0 group-hover/tooltip:opacity-100
        pointer-events-none transition-opacity duration-200
        whitespace-nowrap z-50 shadow-lg
        flex items-center gap-2
      ">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {/* Tooltip arrow */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
      </div>
    </div>
  );
}
