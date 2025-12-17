import { useMemo } from 'react';
import { Package, AlertTriangle, ArrowRight } from 'lucide-react';
import type { ScheduleEntry } from '../../types/schedule.types';

// ============================================
// CAPACITY CELL TYPES
// ============================================

export interface CapacityCellJob {
  id: string;
  entryId: string;
  jobNumber: string;
  clientName: string;
  jobName?: string | null;
  footage: number;
  percentOfCapacity: number;
  materialStatus?: string;
  isMultiDay?: boolean;
  multiDaySequence?: number;
  totalDays?: number;
}

export interface CapacityCellData {
  crewId: string;
  date: string;
  jobs: CapacityCellJob[];
  totalFootage: number;
  maxFootage: number;
  totalPercent: number;
  isOverCapacity: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

// ============================================
// CAPACITY CELL COMPONENT
// ============================================

interface CapacityCellProps {
  data: CapacityCellData;
  onJobClick?: (entryId: string) => void;
  onCellClick?: (crewId: string, date: string) => void;
  onDrop?: (crewId: string, date: string, jobId: string) => void;
}

export function CapacityCell({
  data,
  onJobClick,
  onCellClick,
}: CapacityCellProps) {
  const {
    crewId,
    date,
    jobs,
    totalFootage,
    maxFootage,
    totalPercent,
    isOverCapacity,
    isWeekend,
    isToday,
  } = data;

  // Capacity bar color based on utilization
  const barColor = useMemo(() => {
    if (totalPercent === 0) return 'bg-gray-200';
    if (totalPercent <= 80) return 'bg-green-500';
    if (totalPercent <= 100) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [totalPercent]);

  const bgColor = useMemo(() => {
    if (isToday) return 'bg-blue-50';
    if (isWeekend) return 'bg-gray-50';
    return 'bg-white';
  }, [isToday, isWeekend]);

  const handleCellClick = (e: React.MouseEvent) => {
    // Only trigger if clicking the cell itself, not a job
    if ((e.target as HTMLElement).closest('.job-card')) return;
    onCellClick?.(crewId, date);
  };

  return (
    <div
      className={`
        h-full min-h-[100px] border-r border-b p-1.5 cursor-pointer
        hover:bg-gray-50 transition-colors relative
        ${bgColor}
        ${isToday ? 'ring-2 ring-blue-300 ring-inset' : ''}
      `}
      onClick={handleCellClick}
    >
      {/* Jobs List */}
      <div className="space-y-1 mb-1.5">
        {jobs.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3">
            Available
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.entryId}
              job={job}
              onClick={() => onJobClick?.(job.entryId)}
            />
          ))
        )}
      </div>

      {/* Capacity Bar (at bottom) */}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
        <div className="flex items-center gap-1">
          {/* Bar */}
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(totalPercent, 100)}%` }}
            />
          </div>
          {/* Percentage */}
          <span className={`text-[10px] font-medium ${
            isOverCapacity ? 'text-red-600' : 'text-gray-500'
          }`}>
            {totalPercent}%
          </span>
        </div>
        {/* Footage text */}
        <div className="text-[10px] text-gray-400 text-center mt-0.5">
          {totalFootage}/{maxFootage} LF
        </div>
      </div>

      {/* Over capacity warning */}
      {isOverCapacity && (
        <div className="absolute top-1 right-1">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        </div>
      )}
    </div>
  );
}

// ============================================
// JOB CARD (inside cell)
// ============================================

interface JobCardProps {
  job: CapacityCellJob;
  onClick: () => void;
}

function JobCard({ job, onClick }: JobCardProps) {
  // Material status colors
  const statusColor = useMemo(() => {
    switch (job.materialStatus) {
      case 'staged':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'loaded':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  }, [job.materialStatus]);

  const statusIcon = useMemo(() => {
    if (job.materialStatus === 'staged' || job.materialStatus === 'loaded') {
      return <Package className="w-3 h-3" />;
    }
    return null;
  }, [job.materialStatus]);

  return (
    <div
      className={`
        job-card px-1.5 py-1 rounded border text-xs cursor-pointer
        hover:shadow-sm transition-shadow
        ${statusColor}
      `}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          {/* Job number or name */}
          <div className="font-medium truncate">
            {job.jobName || job.jobNumber}
          </div>
          {/* Client name */}
          <div className="text-[10px] opacity-75 truncate">
            {job.clientName}
          </div>
        </div>
        {/* Status icon & footage */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {statusIcon}
          {job.footage > 0 && (
            <span className="text-[10px] font-medium">
              {job.footage}
            </span>
          )}
        </div>
      </div>

      {/* Multi-day indicator */}
      {job.isMultiDay && job.multiDaySequence && job.totalDays && (
        <div className="flex items-center gap-0.5 mt-0.5 text-[10px] opacity-75">
          <ArrowRight className="w-2.5 h-2.5" />
          <span>Day {job.multiDaySequence}/{job.totalDays}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// HELPER: Convert ScheduleEntry to CapacityCellJob
// ============================================

export function entryToCellJob(
  entry: ScheduleEntry,
  maxFootage: number
): CapacityCellJob {
  const footage = entry.estimated_footage || 0;
  const percentOfCapacity = maxFootage > 0
    ? Math.round((footage / maxFootage) * 100)
    : 0;

  return {
    id: entry.job_id || entry.id,
    entryId: entry.id,
    jobNumber: entry.job?.job_number || 'Job',
    clientName: entry.job?.client_name || 'Unknown',
    jobName: entry.job?.name,
    footage,
    percentOfCapacity,
    materialStatus: entry.job?.material_status,
    isMultiDay: entry.is_multi_day,
    multiDaySequence: entry.multi_day_sequence ?? undefined,
    totalDays: entry.total_days,
  };
}
