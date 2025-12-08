import { Check, GripVertical, Eye, Trash2, MessageCircle } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isCommentUnread, type TaskWithDetails } from '../hooks/useMyTodos';
import { formatDate, isOverdue } from '../utils/todoHelpers';
import {
  InlineDatePicker,
  InlineTextEditor,
  InlineStatusDropdown,
  InlineOwnerPicker,
  InlineAssigneePicker,
  RoleBadges,
} from './InlineEditors';

export interface SortableTaskRowProps {
  task: TaskWithDetails;
  idx: number;
  lastComment: {
    id: string;
    content: string;
    created_at: string;
    user: { id: string; full_name: string } | null;
  } | null;
  onOpenTask: () => void;
  onOpenCommentPopup: (taskId: string, taskTitle: string, position: { top: number; left: number }) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onUpdateField: (params: { id: string; field: string; value: any }) => Promise<any>;
  onDeleteTask: (taskId: string) => void;
}

export function SortableTaskRow({ task, idx, lastComment, onOpenTask, onOpenCommentPopup, onStatusChange, onUpdateField, onDeleteTask }: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const taskOverdue = isOverdue(task);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors group cursor-pointer ${
        idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
      } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''} ${isDragging ? 'shadow-lg ring-2 ring-blue-500 z-50' : ''}`}
      onClick={onOpenTask}
    >
      {/* Task Title with drag handle, checkbox indicator, description tooltip, and role badges */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="pl-2">
            <div className="flex items-center gap-3">
              {/* Status circle */}
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 cursor-pointer transition-colors ${
                  task.status === 'done'
                    ? 'bg-green-500 border-green-500'
                    : task.status === 'in_progress'
                    ? 'bg-blue-500 border-blue-500'
                    : task.status === 'blocked'
                    ? 'bg-red-500 border-red-500'
                    : 'border-gray-400 hover:border-green-500'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (task.status !== 'done') {
                    onStatusChange(task.id, 'done');
                  }
                }}
                title={task.status === 'done' ? 'Completed' : 'Click to complete'}
              >
                {task.status === 'done' && (
                  <Check className="w-3 h-3 text-white m-auto" />
                )}
              </div>

              {/* High priority indicator */}
              {task.is_high_priority && (
                <div
                  className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                  title="High Priority"
                />
              )}

              {/* Title - inline editable */}
              <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                <InlineTextEditor
                  value={task.title}
                  onSave={async (value) => {
                    await onUpdateField({ id: task.id, field: 'title', value });
                  }}
                  placeholder="Add title..."
                  className={task.status === 'done' ? 'line-through text-gray-500' : 'font-medium'}
                />
              </div>
            </div>
            <div className="ml-7">
              <RoleBadges task={task} />
            </div>
          </div>
        </div>
      </td>

      {/* Owner - inline picker */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineOwnerPicker task={task} />
      </td>

      {/* Assignees - inline picker */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineAssigneePicker task={task} />
      </td>

      {/* Status */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineStatusDropdown
          status={task.status}
          onSave={async (value) => {
            await onStatusChange(task.id, value);
          }}
        />
      </td>

      {/* Due Date */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineDatePicker
          value={task.due_date}
          onSave={async (value) => {
            await onUpdateField({ id: task.id, field: 'due_date', value });
          }}
          isOverdue={!!taskOverdue}
        />
      </td>

      {/* Notes - inline editable */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineTextEditor
          value={task.notes}
          onSave={async (value) => {
            await onUpdateField({ id: task.id, field: 'notes', value });
          }}
          placeholder="Add notes..."
          className="text-gray-600 max-w-[120px]"
        />
      </td>

      {/* Last Comment - click to open inline comment popup */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div
          className={`text-xs rounded px-2 py-1 cursor-pointer hover:bg-blue-50 transition-colors ${
            lastComment && isCommentUnread(task.id, lastComment.created_at)
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-gray-50 border border-transparent'
          }`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenCommentPopup(task.id, task.title, { top: rect.bottom + 4, left: rect.left });
          }}
          title="Click to add comment"
        >
          {lastComment ? (
            <>
              <div className="flex items-center gap-1 text-gray-500 mb-0.5">
                <span className="font-medium truncate max-w-[80px]">
                  {lastComment.user?.full_name?.split(' ')[0] || 'Unknown'}
                </span>
                <span>•</span>
                <span>{formatDate(lastComment.created_at)}</span>
                {isCommentUnread(task.id, lastComment.created_at) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 ml-1" title="New comment" />
                )}
              </div>
              <div className="text-gray-700 truncate max-w-[150px]">
                {lastComment.content}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <MessageCircle className="w-3 h-3" />
              <span>Add comment</span>
            </div>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTask();
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
