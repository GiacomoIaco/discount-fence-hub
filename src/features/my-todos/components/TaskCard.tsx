import { CheckCircle2, AlertTriangle, Clock, MessageCircle } from 'lucide-react';
import { type TaskWithDetails, isCommentUnread } from '../hooks/useMyTodos';
import { getAvatarColor, formatDate, isOverdue, getStatusInfo } from '../utils/todoHelpers';
import { getInitials } from '../../../lib/stringUtils';

interface TaskCardProps {
  task: TaskWithDetails;
  lastComment?: {
    id: string;
    content: string;
    created_at: string;
    user: { id: string; full_name: string } | null;
  } | null;
  onOpenTask: () => void;
}

export function TaskCard({ task, lastComment, onOpenTask }: TaskCardProps) {
  const taskOverdue = isOverdue(task);
  const statusInfo = getStatusInfo(task.status);

  // Get assignees for display
  const assignees = task.assignees?.length
    ? task.assignees
    : task.assigned_user
      ? [{ user_id: task.assigned_user.id, user: task.assigned_user }]
      : [];

  const hasUnreadComment = lastComment && isCommentUnread(task.id, lastComment.created_at);

  return (
    <div
      onClick={onOpenTask}
      className={`bg-white rounded-lg shadow-sm border p-4 active:scale-[0.98] transition-transform cursor-pointer ${
        taskOverdue ? 'border-l-4 border-l-red-400 border-red-200' : 'border-gray-200'
      }`}
    >
      {/* Top row: Title + Status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Status circle */}
          <div
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
              task.status === 'done'
                ? 'bg-green-500 border-green-500'
                : task.status === 'in_progress'
                ? 'bg-blue-500 border-blue-500'
                : task.status === 'blocked'
                ? 'bg-red-500 border-red-500'
                : 'border-gray-400'
            }`}
          >
            {task.status === 'done' && (
              <CheckCircle2 className="w-3 h-3 text-white m-auto" />
            )}
          </div>

          {/* Title */}
          <h3 className={`text-sm font-medium flex-1 ${
            task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
          }`}>
            {task.title}
          </h3>
        </div>

        {/* Status badge */}
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Middle row: Priority + Due date + Comment indicator */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        {task.is_high_priority && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3" />
            High
          </span>
        )}

        {task.due_date && (
          <span className={`flex items-center gap-1 ${taskOverdue ? 'text-red-600 font-medium' : ''}`}>
            <Clock className="w-3 h-3" />
            {formatDate(task.due_date)}
          </span>
        )}

        {hasUnreadComment && (
          <span className="flex items-center gap-1 text-amber-600">
            <MessageCircle className="w-3 h-3 fill-amber-200" />
            New
          </span>
        )}
      </div>

      {/* Bottom row: Assignees + Initiative */}
      <div className="flex items-center justify-between">
        {/* Assignees */}
        <div className="flex items-center gap-2">
          {assignees.length > 0 ? (
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((assignee, idx) => (
                <div
                  key={assignee.user_id || idx}
                  className={`w-6 h-6 rounded-full ${getAvatarColor(assignee.user_id || '')} text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white`}
                  title={assignee.user?.full_name || 'Unknown'}
                >
                  {assignee.user?.avatar_url ? (
                    <img
                      src={assignee.user.avatar_url}
                      alt={assignee.user?.full_name || 'User'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(assignee.user?.full_name || 'U')
                  )}
                </div>
              ))}
              {assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>

        {/* Initiative name if available */}
        {task.initiative && (
          <span className="text-xs text-gray-400 truncate max-w-[120px]">
            {task.initiative.title}
          </span>
        )}
      </div>

      {/* Notes preview if any */}
      {task.notes && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-1 border-t border-gray-100 pt-2">
          {task.notes}
        </p>
      )}
    </div>
  );
}
