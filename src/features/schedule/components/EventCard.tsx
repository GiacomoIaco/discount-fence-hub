import type { EventApi } from '@fullcalendar/core';
import { Truck, Clipboard, Ban, Users, Layers, CalendarDays } from 'lucide-react';
import type { ScheduleEntryType } from '../types/schedule.types';

// ============================================
// EVENT CARD COMPONENT
// Custom rendering for calendar events
// ============================================

interface EventCardProps {
  event: EventApi;
  timeText?: string;
}

export function EventCard({ event, timeText }: EventCardProps) {
  const entryType = event.extendedProps.entryType as ScheduleEntryType;
  const footage = event.extendedProps.footage as number | undefined;
  const materialStatus = event.extendedProps.materialStatus as string | undefined;
  const isMultiJobProject = event.extendedProps.isMultiJobProject as boolean | undefined;
  const projectNumber = event.extendedProps.projectNumber as string | undefined;
  const entry = event.extendedProps.entry as { is_multi_day?: boolean; multi_day_sequence?: number; total_days?: number } | undefined;
  const isMultiDay = entry?.is_multi_day;
  const multiDaySequence = entry?.multi_day_sequence;
  const totalDays = entry?.total_days;

  const Icon = getEntryIcon(entryType);
  const statusBadge = materialStatus ? getMaterialStatusBadge(materialStatus) : null;

  return (
    <div className="flex items-start gap-1 px-1 py-0.5 overflow-hidden w-full h-full">
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-white/80" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Time (if not in header) */}
        {timeText && (
          <div className="text-[10px] text-white/70 leading-tight truncate">
            {timeText}
          </div>
        )}

        {/* Title */}
        <div className="text-xs font-medium text-white leading-tight truncate">
          {event.title}
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {/* Multi-day badge */}
          {isMultiDay && multiDaySequence && totalDays && (
            <span className="text-[10px] bg-indigo-500/40 text-white px-1 rounded flex items-center gap-0.5">
              <CalendarDays className="w-2.5 h-2.5" />
              {multiDaySequence}/{totalDays}
            </span>
          )}

          {/* Multi-job project badge */}
          {isMultiJobProject && (
            <span className="text-[10px] bg-purple-500/40 text-white px-1 rounded flex items-center gap-0.5">
              <Layers className="w-2.5 h-2.5" />
              {projectNumber ? projectNumber.split('-').pop() : 'Multi'}
            </span>
          )}

          {/* Footage badge for jobs */}
          {footage && (
            <span className="text-[10px] bg-white/20 text-white px-1 rounded">
              {footage} LF
            </span>
          )}

          {/* Material status badge */}
          {statusBadge && (
            <span
              className={`text-[10px] px-1 rounded ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getEntryIcon(entryType: ScheduleEntryType) {
  switch (entryType) {
    case 'job_visit':
      return Truck;
    case 'assessment':
      return Clipboard;
    case 'blocked':
      return Ban;
    case 'meeting':
      return Users;
    default:
      return Truck;
  }
}

function getMaterialStatusBadge(status: string): { label: string; className: string } | null {
  switch (status) {
    case 'not_sent':
      return { label: 'Pending', className: 'bg-gray-500/30 text-white' };
    case 'sent_to_yard':
      return { label: 'In Yard', className: 'bg-blue-500/30 text-white' };
    case 'picking':
      return { label: 'Picking', className: 'bg-orange-500/30 text-white' };
    case 'staged':
      return { label: 'Staged', className: 'bg-yellow-500/30 text-white' };
    case 'loaded':
      return { label: 'Loaded', className: 'bg-green-500/30 text-white' };
    case 'completed':
      return { label: 'Done', className: 'bg-emerald-500/30 text-white' };
    default:
      return null;
  }
}

// ============================================
// COMPACT EVENT CARD (for month view)
// ============================================

export function CompactEventCard({ event }: { event: EventApi }) {
  const footage = event.extendedProps.footage as number | undefined;
  const isMultiJobProject = event.extendedProps.isMultiJobProject as boolean | undefined;
  const entry = event.extendedProps.entry as { is_multi_day?: boolean; multi_day_sequence?: number; total_days?: number } | undefined;
  const isMultiDay = entry?.is_multi_day;
  const multiDaySequence = entry?.multi_day_sequence;
  const totalDays = entry?.total_days;

  return (
    <div className="flex items-center gap-1 px-1 py-0.5 text-xs truncate">
      {isMultiDay && multiDaySequence && totalDays && (
        <span className="text-[10px] opacity-80 flex-shrink-0">
          {multiDaySequence}/{totalDays}
        </span>
      )}
      {isMultiJobProject && (
        <Layers className="w-2.5 h-2.5 flex-shrink-0 opacity-80" />
      )}
      <span className="font-medium truncate">{event.title}</span>
      {footage && (
        <span className="text-[10px] opacity-70 flex-shrink-0">
          {footage}LF
        </span>
      )}
    </div>
  );
}
