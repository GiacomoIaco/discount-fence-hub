/**
 * JobVisitsSection - Visits timeline for JobCard
 *
 * Shows visits as a vertical timeline with:
 * - Visit type and number
 * - Scheduled date/time
 * - Assigned crew
 * - Duration and notes
 * - Status badge
 * - Action buttons (start, complete, edit)
 */

import {
  Plus,
  Calendar,
  Clock,
  Users,
  Check,
  Play,
  Edit2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { JobVisit, VisitStatus } from '../../types';
import type { JobVisitsSectionProps } from './types';
import { VISIT_TYPE_LABELS, VISIT_TYPE_COLORS } from './types';

// Visit status styling
const VISIT_STATUS_CONFIG: Record<VisitStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
  confirmed: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Confirmed' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
  rescheduled: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Rescheduled' },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', label: 'No Show' },
};

interface VisitCardProps {
  visit: JobVisit;
  isLast: boolean;
  mode: 'view' | 'create' | 'edit';
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
}

function VisitCard({ visit, isLast, mode, onEdit, onStart, onComplete }: VisitCardProps) {
  const typeConfig = VISIT_TYPE_COLORS[visit.visit_type];
  const statusConfig = VISIT_STATUS_CONFIG[visit.status];

  const canStart = visit.status === 'scheduled';
  const canComplete = visit.status === 'in_progress';
  const isEditable = mode !== 'view' && visit.status !== 'completed' && visit.status !== 'cancelled';

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={`w-3 h-3 rounded-full ${
            visit.status === 'completed'
              ? 'bg-green-500'
              : visit.status === 'in_progress'
              ? 'bg-amber-500'
              : 'bg-blue-500'
          }`}
        />
        {/* Line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
        )}
      </div>

      {/* Visit content */}
      <div className="flex-1 pb-6">
        <div className="bg-white border rounded-lg p-4">
          {/* Header: Visit number, type, status */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Visit {visit.visit_number}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                {VISIT_TYPE_LABELS[visit.visit_type]}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {canStart && mode === 'view' && (
                <button
                  onClick={onStart}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                  title="Start visit"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {canComplete && mode === 'view' && (
                <button
                  onClick={onComplete}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                  title="Complete visit"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {isEditable && (
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                  title="Edit visit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Schedule info */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>
                {visit.scheduled_date
                  ? new Date(visit.scheduled_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Not scheduled'}
              </span>
            </div>
            {(visit.scheduled_start_time || visit.scheduled_end_time) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  {visit.scheduled_start_time && formatTime(visit.scheduled_start_time)}
                  {visit.scheduled_end_time && ` - ${formatTime(visit.scheduled_end_time)}`}
                </span>
              </div>
            )}
          </div>

          {/* Crew */}
          {visit.assigned_crew && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Users className="w-4 h-4 text-gray-400" />
              <span>{visit.assigned_crew.name}</span>
              {visit.assigned_crew.code && (
                <span className="text-gray-400">({visit.assigned_crew.code})</span>
              )}
            </div>
          )}

          {/* Actual hours (if completed) */}
          {visit.status === 'completed' && visit.labor_hours !== undefined && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                {visit.labor_hours} hours actual
                {visit.scheduled_duration_hours && ` (estimated: ${visit.scheduled_duration_hours}h)`}
              </span>
            </div>
          )}

          {/* Notes */}
          {visit.notes && (
            <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="whitespace-pre-wrap">{visit.notes}</p>
            </div>
          )}

          {/* Completed timestamp */}
          {visit.completed_at && (
            <div className="flex items-center gap-2 text-xs text-green-600 mt-3 pt-2 border-t">
              <Check className="w-3.5 h-3.5" />
              <span>
                Completed {new Date(visit.completed_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

export default function JobVisitsSection({
  mode,
  jobId: _jobId,
  visits,
  isLoading,
  onAddVisit,
  onEditVisit,
  onCompleteVisit,
  onStartVisit,
}: JobVisitsSectionProps) {
  // Sort visits by visit_number
  const sortedVisits = [...visits].sort((a, b) => a.visit_number - b.visit_number);

  // Summary stats
  const completedCount = visits.filter(v => v.status === 'completed').length;
  const totalHours = visits.reduce((sum, v) => sum + (v.labor_hours || 0), 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Visits</h2>
          {visits.length > 0 && (
            <span className="text-sm text-gray-500">
              {completedCount}/{visits.length} completed
              {totalHours > 0 && ` • ${totalHours}h total`}
            </span>
          )}
        </div>

        {mode !== 'view' && (
          <button
            onClick={onAddVisit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            <Plus className="w-4 h-4" />
            Add Visit
          </button>
        )}
      </div>

      {/* Visits Timeline */}
      {sortedVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm">No visits scheduled yet</p>
          {mode !== 'view' && (
            <button
              onClick={onAddVisit}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add First Visit
            </button>
          )}
        </div>
      ) : (
        <div className="ml-1">
          {sortedVisits.map((visit, index) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              isLast={index === sortedVisits.length - 1}
              mode={mode}
              onEdit={() => onEditVisit(visit)}
              onStart={() => onStartVisit(visit.id)}
              onComplete={() => onCompleteVisit(visit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
