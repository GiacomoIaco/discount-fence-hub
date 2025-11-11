import { useState } from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import { useUpdateTask, useDeleteTask } from '../hooks/useGoalsQuery';
import type { Task } from '../lib/goals.types';

interface TaskRowProps {
  task: Task;
  onDelete?: () => void;
}

export default function TaskRow({ task, onDelete }: TaskRowProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleStartEdit = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveEdit = async (field: string) => {
    if (!editingField) return;

    try {
      await updateTask.mutateAsync({
        id: task.id,
        [field]: editValue || undefined,
      });
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(field);
    } else if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask.mutateAsync(task.id);
      onDelete?.();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      done: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-700',
    };
    return colors[status] || colors.todo;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      done: 'Done',
      blocked: 'Blocked',
    };
    return labels[status] || status;
  };

  return (
    <tr className="bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors group">
      {/* Grip + Indented Title */}
      <td className="px-4 py-2 sticky left-0 bg-inherit">
        <div className="flex items-center gap-2 pl-8">
          <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-move" />
          {editingField === 'title' ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSaveEdit('title')}
              onKeyDown={(e) => handleKeyDown(e, 'title')}
              className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <span
              onClick={() => handleStartEdit('title', task.title)}
              className="flex-1 text-sm text-gray-700 hover:text-gray-900 cursor-text"
            >
              {task.title}
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-2">
        {editingField === 'status' ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSaveEdit('status')}
            className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        ) : (
          <button
            onClick={() => handleStartEdit('status', task.status)}
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)} hover:opacity-80 transition-opacity`}
          >
            {getStatusLabel(task.status)}
          </button>
        )}
      </td>

      {/* Priority - Empty for tasks (or could add) */}
      <td className="px-4 py-2">
        <span className="text-xs text-gray-400">-</span>
      </td>

      {/* This Week - Task description */}
      <td className="px-4 py-2">
        {editingField === 'description' ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSaveEdit('description')}
            onKeyDown={(e) => handleKeyDown(e, 'description')}
            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            autoFocus
          />
        ) : (
          <div
            onClick={() => handleStartEdit('description', task.description)}
            className="text-sm text-gray-600 hover:bg-gray-50 rounded cursor-text px-2 py-1"
          >
            {task.description || <span className="text-gray-400 italic">Add description...</span>}
          </div>
        )}
      </td>

      {/* Next Week - Empty for tasks */}
      <td className="px-4 py-2">
        <span className="text-xs text-gray-400">-</span>
      </td>

      {/* Progress - Empty for tasks (tasks are binary: done or not) */}
      <td className="px-4 py-2">
        <span className="text-xs text-gray-400">-</span>
      </td>

      {/* Goals - Empty for tasks */}
      <td className="px-4 py-2">
        <span className="text-xs text-gray-400">-</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-2">
        <button
          onClick={handleDelete}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
