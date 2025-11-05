import { Calendar, User, TrendingUp, AlertCircle, CheckCircle2, Clock, Pause, XCircle, Flag } from 'lucide-react';
import type { ProjectInitiative } from '../lib/leadership';

interface InitiativeCardProps {
  initiative: ProjectInitiative;
  onClick: () => void;
}

export default function InitiativeCard({ initiative, onClick }: InitiativeCardProps) {
  // Status configuration
  const statusConfig = {
    not_started: { label: 'Not Started', icon: Clock, color: 'text-gray-500 bg-gray-100' },
    active: { label: 'Active', icon: TrendingUp, color: 'text-blue-600 bg-blue-100' },
    on_hold: { label: 'On Hold', icon: Pause, color: 'text-yellow-600 bg-yellow-100' },
    at_risk: { label: 'At Risk', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-600 bg-red-100' },
    completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
  };

  const status = statusConfig[initiative.status] || statusConfig.not_started;
  const StatusIcon = status.icon;

  // Priority configuration
  const priorityConfig = {
    low: { label: 'Low', color: 'text-gray-600 bg-gray-100' },
    medium: { label: 'Medium', color: 'text-blue-600 bg-blue-100' },
    high: { label: 'High', color: 'text-red-600 bg-red-100' },
  };

  const priority = priorityConfig[initiative.priority] || priorityConfig.medium;

  // Color status indicator
  const colorStatusConfig = {
    green: 'border-l-4 border-l-green-500',
    yellow: 'border-l-4 border-l-yellow-500',
    red: 'border-l-4 border-l-red-500',
  };

  const colorStatus = colorStatusConfig[initiative.color_status] || colorStatusConfig.green;

  // Format target date
  const formatTarget = () => {
    if (initiative.target_date) {
      return new Date(initiative.target_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    if (initiative.target_week) return `Week ${initiative.target_week}`;
    if (initiative.target_quarter) return initiative.target_quarter;
    return 'No target set';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 text-left ${colorStatus} hover:scale-[1.02]`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
          {initiative.title}
        </h3>
        {initiative.priority === 'high' && (
          <Flag className="w-5 h-5 text-red-500 flex-shrink-0" />
        )}
      </div>

      {/* Description */}
      {initiative.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {initiative.description}
        </p>
      )}

      {/* Status & Priority Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
          {priority.label}
        </span>
      </div>

      {/* Progress Bar */}
      {initiative.progress_percent > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span className="font-medium">{initiative.progress_percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${initiative.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{formatTarget()}</span>
        </div>
        {initiative.assigned_to && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Assigned</span>
          </div>
        )}
      </div>
    </button>
  );
}
