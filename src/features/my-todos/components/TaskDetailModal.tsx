import { useState } from 'react';
import { X, Calendar, CheckCircle2, MessageSquare, Flag, TrendingUp } from 'lucide-react';
import { useUpdateTaskStatus } from '../hooks/useMyTodos';
import TaskComments from './TaskComments';
import type { InitiativeWithDetails } from '../../leadership/lib/leadership';

interface TaskDetailModalProps {
  task: InitiativeWithDetails;
  onClose: () => void;
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

// Status badge config
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Not Started' },
  active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' },
  on_hold: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'On Hold' },
  at_risk: { bg: 'bg-red-100', text: 'text-red-700', label: 'At Risk' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

// Priority config
const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'text-gray-500', label: 'Low' },
  medium: { color: 'text-blue-500', label: 'Medium' },
  high: { color: 'text-orange-500', label: 'High' },
};

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  type StatusType = 'not_started' | 'active' | 'on_hold' | 'at_risk' | 'completed' | 'cancelled';

  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [newStatus, setNewStatus] = useState<StatusType>(task.status as StatusType);
  const updateStatus = useUpdateTaskStatus();

  const isOverdue = task.target_date && new Date(task.target_date) < new Date() &&
    task.status !== 'completed' && task.status !== 'cancelled';

  const handleStatusChange = async (status: StatusType) => {
    setNewStatus(status);
    await updateStatus.mutateAsync({ id: task.id, status });
  };

  const statusInfo = statusConfig[task.status] || statusConfig.not_started;
  const priorityInfo = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {task.priority === 'high' && (
                <Flag className="w-4 h-4 text-orange-500 flex-shrink-0" />
              )}
              <h2 className="text-xl font-bold text-gray-900 truncate">{task.title}</h2>
            </div>
            <p className="text-sm text-gray-500">
              {(task.area as any)?.function?.name ? `${(task.area as any).function.name} / ` : ''}{task.area?.name || 'No Area'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Details
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Comments
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Status & Priority Row */}
              <div className="flex flex-wrap gap-4">
                {/* Status Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => handleStatusChange(e.target.value as StatusType)}
                    disabled={updateStatus.isPending}
                    className={`px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="at_risk">At Risk</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
                  <div className={`px-3 py-2 rounded-lg bg-gray-50 text-sm font-medium ${priorityInfo.color}`}>
                    {priorityInfo.label}
                  </div>
                </div>

                {/* Due Date */}
                {task.target_date && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Due Date</label>
                    <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${isOverdue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {new Date(task.target_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Assignee */}
              {task.assigned_user && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Assigned To</label>
                  <div className="flex items-center gap-2">
                    {task.assigned_user.avatar_url ? (
                      <img
                        src={task.assigned_user.avatar_url}
                        alt={task.assigned_user.full_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">
                          {getInitials(task.assigned_user.full_name)}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{task.assigned_user.full_name}</span>
                  </div>
                </div>
              )}

              {/* Description */}
              {task.description && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Description</label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Success Criteria */}
              {task.success_criteria && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Success Criteria</label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.success_criteria}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  {task.status !== 'completed' && task.status !== 'cancelled' && (
                    <button
                      onClick={() => handleStatusChange('completed')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Complete
                    </button>
                  )}
                  {task.status === 'not_started' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Start Working
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <TaskComments initiativeId={task.id} />
          )}
        </div>
      </div>
    </div>
  );
}
