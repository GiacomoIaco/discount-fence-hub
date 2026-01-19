/**
 * Horizontal scrollable filter pills for the unified inbox
 * Shows: All | SMS | Team | Alerts with unread badge counts
 */

import { cn } from '../../../lib/utils';
import type { UnifiedInboxFilter } from '../types';

interface FilterPillsProps {
  activeFilter: UnifiedInboxFilter;
  onFilterChange: (filter: UnifiedInboxFilter) => void;
  counts: {
    all: number;
    sms: number;
    team: number;
    tickets: number;
    alerts: number;
  };
}

interface FilterOption {
  id: UnifiedInboxFilter;
  label: string;
  countKey: keyof FilterPillsProps['counts'];
}

const filters: FilterOption[] = [
  { id: 'all', label: 'All', countKey: 'all' },
  { id: 'sms', label: 'SMS', countKey: 'sms' },
  { id: 'team', label: 'Team', countKey: 'team' },
  { id: 'tickets', label: 'Tickets', countKey: 'tickets' },
  { id: 'alerts', label: 'Alerts', countKey: 'alerts' },
];

export function FilterPills({ activeFilter, onFilterChange, counts }: FilterPillsProps) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar bg-white border-b border-gray-100">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        const count = counts[filter.countKey];
        const hasUnread = count > 0;

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              'min-h-[40px]', // 40px touch target
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            )}
          >
            <span>{filter.label}</span>
            {hasUnread && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-red-500 text-white'
                )}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FilterPills;
