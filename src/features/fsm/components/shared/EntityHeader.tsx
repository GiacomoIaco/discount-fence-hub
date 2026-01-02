/**
 * EntityHeader - Unified header for FSM detail pages
 *
 * Provides consistent layout for:
 * - Back navigation
 * - Entity icon and title
 * - Status and priority badges
 * - Subtitle with metadata
 * - Workflow progress
 * - Action buttons
 */

import { ArrowLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Badge {
  label: string;
  colorClass: string; // Tailwind classes like 'bg-blue-100 text-blue-700'
}

interface EntityHeaderProps {
  /** Back button handler */
  onBack: () => void;
  /** Back button label (e.g., "Back to Requests") */
  backLabel?: string;

  /** Optional icon component */
  icon?: LucideIcon;
  /** Icon background color class (e.g., 'bg-orange-100') */
  iconBgClass?: string;
  /** Icon color class (e.g., 'text-orange-600') */
  iconColorClass?: string;

  /** Main title (e.g., request number, job number) */
  title: string;
  /** Status badge */
  statusBadge: Badge;
  /** Optional additional badges (priority, etc.) */
  extraBadges?: Badge[];

  /** Subtitle metadata items */
  subtitle?: ReactNode;

  /** Workflow progress component */
  workflowProgress?: ReactNode;

  /** Action buttons (rendered on the right side) */
  actions?: ReactNode;

  /** Optional children rendered below the header content */
  children?: ReactNode;
}

export function EntityHeader({
  onBack,
  backLabel,
  icon: Icon,
  iconBgClass = 'bg-gray-100',
  iconColorClass = 'text-gray-600',
  title,
  statusBadge,
  extraBadges = [],
  subtitle,
  workflowProgress,
  actions,
  children,
}: EntityHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 py-4">
        {/* Back button */}
        {backLabel ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        ) : (
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors mb-2"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}

        {/* Main content row */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Left side: Icon + Title + Badges */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            {Icon && (
              <div className={`p-3 ${iconBgClass} rounded-lg`}>
                <Icon className={`w-8 h-8 ${iconColorClass}`} />
              </div>
            )}

            <div>
              {/* Title row with badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.colorClass}`}
                >
                  {statusBadge.label}
                </span>
                {extraBadges.map((badge, i) => (
                  <span
                    key={i}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.colorClass}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              {/* Subtitle */}
              {subtitle && (
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  {subtitle}
                </div>
              )}

              {/* Workflow Progress */}
              {workflowProgress && <div className="mt-3">{workflowProgress}</div>}
            </div>
          </div>

          {/* Right side: Actions */}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        {/* Optional children below */}
        {children}
      </div>
    </div>
  );
}

export default EntityHeader;
