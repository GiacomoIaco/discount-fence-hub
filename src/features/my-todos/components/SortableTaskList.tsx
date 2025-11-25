import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, Clock, ChevronRight, GripVertical } from 'lucide-react';
import { useUpdateTaskOrder } from '../hooks/useMyTodos';
import type { InitiativeWithDetails } from '../../leadership/lib/leadership';

interface SortableTaskListProps {
  tasks: InitiativeWithDetails[];
  showAssignee: boolean;
  onOpenTask: (task: InitiativeWithDetails) => void;
  onStatusChange: (taskId: string, status: string) => void;
}

// Helper to get initials
const getInitials = (fullName: string): string => {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    not_started: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Not Started' },
    active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' },
    on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'On Hold' },
    at_risk: { bg: 'bg-red-100', text: 'text-red-700', label: 'At Risk' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
  };

  const { bg, text, label } = config[status] || config.not_started;

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${bg} ${text}`}>
      {label}
    </span>
  );
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: string }) {
  if (priority === 'high') {
    return <span className="text-orange-500 text-sm" title="High Priority">!!!</span>;
  }
  return null;
}

// Sortable task card
function SortableTaskCard({
  task,
  showAssignee,
  onOpen,
  onStatusChange,
}: {
  task: InitiativeWithDetails;
  showAssignee: boolean;
  onOpen: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
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

  const handleQuickComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    try {
      await onStatusChange('completed');
    } finally {
      setIsUpdating(false);
    }
  };

  const isOverdue = task.target_date && new Date(task.target_date) < new Date() &&
    task.status !== 'completed' && task.status !== 'cancelled';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
        isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
      } ${isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0" onClick={onOpen}>
          <div className="flex items-center gap-2 mb-1">
            <PriorityIndicator priority={task.priority} />
            <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
          </div>

          {/* Function / Area path */}
          <p className="text-sm text-gray-500 truncate mb-2">
            {(task.area as any)?.function?.name ? `${(task.area as any).function.name} / ` : ''}{task.area?.name || 'No Area'}
          </p>

          {/* Meta info row */}
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={task.status} />

            {task.target_date && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <Clock className="w-3 h-3" />
                {new Date(task.target_date).toLocaleDateString()}
              </span>
            )}

            {showAssignee && task.assigned_user && (
              <div
                className="flex items-center gap-1 text-gray-600"
                title={`Assigned to ${task.assigned_user.full_name}`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                  {getInitials(task.assigned_user.full_name)}
                </div>
                <span className="text-xs">{task.assigned_user.full_name.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {task.status !== 'completed' && task.status !== 'cancelled' && (
            <button
              onClick={handleQuickComplete}
              disabled={isUpdating}
              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Mark as completed"
            >
              <CheckCircle2 className={`w-5 h-5 ${isUpdating ? 'animate-pulse' : ''}`} />
            </button>
          )}
          <ChevronRight className="w-5 h-5 text-gray-400" onClick={onOpen} />
        </div>
      </div>
    </div>
  );
}

export default function SortableTaskList({
  tasks,
  showAssignee,
  onOpenTask,
  onStatusChange,
}: SortableTaskListProps) {
  const [items, setItems] = useState(tasks);
  const updateOrder = useUpdateTaskOrder();

  // Update items when tasks prop changes
  if (tasks !== items && tasks.length !== items.length) {
    setItems(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Update order in database
      const updates = newItems.map((item, index) => ({
        id: item.id,
        order: index,
      }));

      try {
        await updateOrder.mutateAsync(updates);
      } catch (error) {
        console.error('Failed to update task order:', error);
        // Revert on error
        setItems(items);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              showAssignee={showAssignee}
              onOpen={() => onOpenTask(task)}
              onStatusChange={(status) => onStatusChange(task.id, status)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
