import { useMemo } from 'react';
import type { CrewDailyCapacity } from '../types/schedule.types';

// ============================================
// CAPACITY BAR COMPONENT
// Visual indicator of crew utilization
// ============================================

interface CapacityBarProps {
  capacity?: CrewDailyCapacity;
  maxFootage?: number;
  scheduledFootage?: number;
  compact?: boolean;
}

export function CapacityBar({
  capacity,
  maxFootage: propMaxFootage,
  scheduledFootage: propScheduledFootage,
  compact = false,
}: CapacityBarProps) {
  const maxFootage = capacity?.max_footage ?? propMaxFootage ?? 200;
  const scheduledFootage = capacity?.scheduled_footage ?? propScheduledFootage ?? 0;

  const { percent, color, label } = useMemo(() => {
    const pct = maxFootage > 0 ? Math.min((scheduledFootage / maxFootage) * 100, 100) : 0;

    let barColor = 'bg-green-500';
    let statusLabel = 'Available';

    if (pct >= 100) {
      barColor = 'bg-red-500';
      statusLabel = 'Full';
    } else if (pct >= 80) {
      barColor = 'bg-yellow-500';
      statusLabel = 'Almost Full';
    } else if (pct >= 50) {
      barColor = 'bg-blue-500';
      statusLabel = 'Moderate';
    }

    return { percent: pct, color: barColor, label: statusLabel };
  }, [maxFootage, scheduledFootage]);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 tabular-nums">
          {Math.round(percent)}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 tabular-nums w-10 text-right">
          {Math.round(percent)}%
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{scheduledFootage} / {maxFootage} LF</span>
        <span className={`font-medium ${
          percent >= 100 ? 'text-red-600' :
          percent >= 80 ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ============================================
// INLINE CAPACITY INDICATOR
// For use in resource labels
// ============================================

interface InlineCapacityProps {
  scheduledFootage: number;
  maxFootage: number;
  jobCount?: number;
}

export function InlineCapacity({
  scheduledFootage,
  maxFootage,
  jobCount,
}: InlineCapacityProps) {
  const percent = maxFootage > 0 ? Math.min((scheduledFootage / maxFootage) * 100, 100) : 0;
  const available = Math.max(0, maxFootage - scheduledFootage);

  let colorClass = 'text-green-600';
  if (percent >= 100) {
    colorClass = 'text-red-600';
  } else if (percent >= 80) {
    colorClass = 'text-yellow-600';
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Mini progress bar */}
      <div className="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            percent >= 100 ? 'bg-red-500' :
            percent >= 80 ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Available footage */}
      <span className={colorClass}>
        {available} LF
      </span>

      {/* Job count */}
      {jobCount !== undefined && jobCount > 0 && (
        <span className="text-gray-400">
          ({jobCount})
        </span>
      )}
    </div>
  );
}

export default CapacityBar;
