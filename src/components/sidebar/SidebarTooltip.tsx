import { useState, useRef, useEffect, type ReactNode } from 'react';

interface SidebarTooltipProps {
  label: string;
  children: ReactNode;
  showTooltip: boolean; // Only show tooltip when sidebar is collapsed
  badge?: number;
}

/**
 * Tooltip wrapper for sidebar items using fixed positioning.
 * Shows tooltip to the right of the item on hover.
 * Only active when showTooltip is true (i.e., sidebar is collapsed).
 */
export default function SidebarTooltip({ label, children, showTooltip, badge }: SidebarTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHovered && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8, // 8px gap from the element
      });
    }
  }, [isHovered]);

  if (!showTooltip) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      {children}
      {isHovered && (
        <div
          className="fixed px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded-md
            pointer-events-none whitespace-nowrap z-[9999] shadow-lg
            flex items-center gap-2 -translate-y-1/2"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {/* Tooltip arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}
