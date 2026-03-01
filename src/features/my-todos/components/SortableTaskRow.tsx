import { Check, GripVertical, Eye, Trash2, MessageCircle, ArrowRight, Calendar } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isCommentUnread } from '../hooks/useMyTodos';
import { useMoveTodoItem } from '../hooks/useTodoItems';
import { formatDate, isOverdue, statusOptions, getAvatarColor } from '../utils/todoHelpers';
import { getInitials } from '../../../lib/stringUtils';
import {
  InlineDatePicker,
  InlineTextEditor,
  InlineStatusDropdown,
  InlineAssignedToPicker,
} from './InlineEditors';
import type { TodoItem, TodoSection } from '../types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface SortableTaskRowProps {
  task: TodoItem;
  idx: number;
  listId: string;
  sections?: TodoSection[];
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

export function SortableTaskRow({ task, idx, listId, sections, lastComment, onOpenTask, onOpenCommentPopup, onStatusChange, onUpdateField, onDeleteTask }: SortableTaskRowProps) {
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

  // Move-to-section dropdown
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [moveMenuPos, setMoveMenuPos] = useState({ top: 0, left: 0 });
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);
  const moveItem = useMoveTodoItem();

  useEffect(() => {
    if (!showMoveMenu) return;
    const handler = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node) &&
          moveButtonRef.current && !moveButtonRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoveMenu]);

  const otherSections = sections?.filter(s => s.id !== task.section_id) || [];

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors group cursor-pointer ${
        idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
      } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''} ${isDragging ? 'shadow-lg ring-2 ring-blue-500 z-50' : ''} ${task.status === 'done' ? 'opacity-50' : ''}`}
      onClick={onOpenTask}
    >
      {/* Task Title with drag handle and checkbox */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="pl-2 flex-1">
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
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="High Priority" />
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

            {/* Followers inline */}
            {task.followers && task.followers.length > 0 && (
              <div className="ml-7 mt-1 flex items-center gap-1">
                <span className="text-xs text-gray-400">Following:</span>
                <div className="flex -space-x-1">
                  {task.followers.slice(0, 3).map(f => (
                    <div
                      key={f.user_id}
                      className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-medium flex items-center justify-center ring-1 ring-white"
                      title={f.user?.full_name || 'User'}
                    >
                      {(f.user?.full_name || 'U').charAt(0)}
                    </div>
                  ))}
                  {task.followers.length > 3 && (
                    <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-medium flex items-center justify-center ring-1 ring-white">
                      +{task.followers.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Assigned To — single person picker */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineAssignedToPicker task={task} listId={listId} />
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

      {/* Last Comment */}
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
                <span>·</span>
                <span>{formatDate(lastComment.created_at)}</span>
                {isCommentUnread(task.id, lastComment.created_at) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 ml-1" title="New comment" />
                )}
              </div>
              <div className="text-gray-700 truncate max-w-[150px]">{lastComment.content}</div>
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
          {/* Move to section */}
          {otherSections.length > 0 && (
            <>
              <button
                ref={moveButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMoveMenuPos({ top: rect.bottom + 4, left: rect.left - 120 });
                  setShowMoveMenu(!showMoveMenu);
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Move to section"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              {showMoveMenu && createPortal(
                <div
                  ref={moveMenuRef}
                  className="fixed z-[9999] w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
                  style={{ top: moveMenuPos.top, left: moveMenuPos.left }}
                >
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">Move to</div>
                  {otherSections.map(s => (
                    <button
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveItem.mutate({ id: task.id, sectionId: s.id, listId });
                        setShowMoveMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {s.title}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </>
          )}
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

// ============================================
// Mobile Task Card
// ============================================

const statusBorderColor: Record<string, string> = {
  todo: 'border-l-gray-300',
  in_progress: 'border-l-blue-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};

export function MobileTaskCard({ task, lastComment, onOpenTask, onOpenCommentPopup, onStatusChange }: SortableTaskRowProps) {
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
  const currentStatus = statusOptions.find(o => o.value === task.status) || statusOptions[0];
  const hasUnreadComment = lastComment && isCommentUnread(task.id, lastComment.created_at);

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeAction, setSwipeAction] = useState<'none' | 'complete' | 'open'>('none');
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setSwipeX(0);
    setSwiping(false);
    setSwipeAction('none');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // If vertical movement is dominant, let DnD handle it
    if (Math.abs(deltaY) > Math.abs(deltaX) && !swiping) return;

    // Lock into horizontal swipe
    if (Math.abs(deltaX) > 10) {
      setSwiping(true);
      setSwipeX(deltaX);

      if (deltaX > SWIPE_THRESHOLD) {
        setSwipeAction('complete');
      } else if (deltaX < -SWIPE_THRESHOLD) {
        setSwipeAction('open');
      } else {
        setSwipeAction('none');
      }
    }
  };

  const handleTouchEnd = () => {
    if (swipeAction === 'complete' && task.status !== 'done') {
      onStatusChange(task.id, 'done');
    } else if (swipeAction === 'open') {
      onOpenTask();
    }

    // Reset
    touchStartRef.current = null;
    setSwipeX(0);
    setSwiping(false);
    setSwipeAction('none');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative overflow-hidden"
    >
      {/* Swipe background */}
      {swiping && (
        <div className="absolute inset-0 flex items-center">
          {swipeX > 0 && (
            <div className={`absolute inset-0 flex items-center pl-4 transition-colors ${
              swipeAction === 'complete' ? 'bg-green-500' : 'bg-green-200'
            }`}>
              <Check className={`w-6 h-6 ${swipeAction === 'complete' ? 'text-white' : 'text-green-600'}`} />
            </div>
          )}
          {swipeX < 0 && (
            <div className={`absolute inset-0 flex items-center justify-end pr-4 transition-colors ${
              swipeAction === 'open' ? 'bg-blue-500' : 'bg-blue-200'
            }`}>
              <Eye className={`w-6 h-6 ${swipeAction === 'open' ? 'text-white' : 'text-blue-600'}`} />
            </div>
          )}
        </div>
      )}

      {/* Foreground (slides) */}
      <div
        className={`border-l-4 ${statusBorderColor[task.status] || 'border-l-gray-300'} ${
          taskOverdue ? 'bg-red-50' : 'bg-white'
        } ${isDragging ? 'shadow-lg ring-2 ring-blue-500 z-50' : ''} ${
          task.status === 'done' ? 'opacity-50' : ''
        } cursor-pointer active:bg-gray-50 transition-transform`}
        style={{
          transform: swiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
        }}
        onClick={!swiping ? onOpenTask : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="py-3 px-4">
          {/* Row 1: status circle + title + priority dot */}
          <div className="flex items-center gap-2">
            {/* Status circle */}
            <div
              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                task.status === 'done'
                  ? 'bg-green-500 border-green-500'
                  : task.status === 'in_progress'
                  ? 'bg-blue-500 border-blue-500'
                  : task.status === 'blocked'
                  ? 'bg-red-500 border-red-500'
                  : 'border-gray-400'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (task.status !== 'done') {
                  onStatusChange(task.id, 'done');
                }
              }}
            >
              {task.status === 'done' && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>

            {/* Title */}
            <span
              className={`flex-1 text-sm leading-snug truncate ${
                task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 font-medium'
              }`}
            >
              {task.title}
            </span>

            {/* High priority dot */}
            {task.is_high_priority && (
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" title="High Priority" />
            )}
          </div>

          {/* Row 2: assignee + status badge + due date + comments */}
          <div className="flex items-center gap-2 mt-2 ml-7 flex-wrap">
            {/* Assignee avatar */}
            {task.assigned_user ? (
              <div
                className={`w-6 h-6 rounded-full ${getAvatarColor(task.assigned_user.id)} text-white text-[10px] font-medium flex items-center justify-center flex-shrink-0`}
                title={task.assigned_user.full_name}
              >
                {task.assigned_user.avatar_url ? (
                  <img src={task.assigned_user.avatar_url} alt={task.assigned_user.full_name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(task.assigned_user.full_name)
                )}
              </div>
            ) : null}

            {/* Status badge */}
            <span
              className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${currentStatus.bg} ${currentStatus.text} flex-shrink-0`}
            >
              {currentStatus.label}
            </span>

            {/* Due date pill */}
            {task.due_date && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full flex-shrink-0 ${
                  taskOverdue
                    ? 'bg-red-100 text-red-700 font-medium'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Calendar className="w-3 h-3" />
                {formatDate(task.due_date)}
              </span>
            )}

            {/* Comment indicator */}
            {lastComment && (
              <button
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full flex-shrink-0 ${
                  hasUnreadComment
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenCommentPopup(task.id, task.title, { top: rect.bottom + 4, left: rect.left });
                }}
              >
                <MessageCircle className="w-3 h-3" />
                {hasUnreadComment && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
