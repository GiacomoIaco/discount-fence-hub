import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, User, Users, Send, ChevronRight } from 'lucide-react';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus } from '../hooks/useMyTodos';
import type { InitiativeWithDetails } from '../../leadership/lib/leadership';

interface MyTodosProps {
  onBack: () => void;
  onOpenInitiative: (initiativeId: string) => void;
}

type TabId = 'assigned-to-me' | 'created-by-me' | 'assigned-by-me';

// Helper to get initials from a full name
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

// Task card component
function TaskCard({
  task,
  showAssignee = false,
  onOpen,
  onStatusChange,
}: {
  task: InitiativeWithDetails;
  showAssignee?: boolean;
  onOpen: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

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
      onClick={onOpen}
      className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
        isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
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

            {/* Show assignee if requested */}
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
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p>{message}</p>
    </div>
  );
}

export default function MyTodos({ onBack, onOpenInitiative }: MyTodosProps) {
  const [activeTab, setActiveTab] = useState<TabId>('assigned-to-me');
  const { data, isLoading, error } = useMyTodosQuery();
  const stats = useMyTodosStats();
  const updateStatus = useUpdateTaskStatus();

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status });
  };

  const tabs = [
    {
      id: 'assigned-to-me' as TabId,
      label: 'Assigned to Me',
      icon: User,
      count: stats.totalAssigned,
    },
    {
      id: 'created-by-me' as TabId,
      label: 'Created by Me',
      icon: Users,
      count: stats.totalCreated,
    },
    {
      id: 'assigned-by-me' as TabId,
      label: 'Assigned to Others',
      icon: Send,
      count: stats.totalAssignedByMe,
    },
  ];

  // Get tasks for current tab
  const getCurrentTasks = (): InitiativeWithDetails[] => {
    if (!data) return [];
    switch (activeTab) {
      case 'assigned-to-me':
        return data.assignedToMe;
      case 'created-by-me':
        return data.createdByMe;
      case 'assigned-by-me':
        return data.assignedByMe;
      default:
        return [];
    }
  };

  const currentTasks = getCurrentTasks();

  // Group tasks by status
  const groupedTasks = {
    active: currentTasks.filter(t => t.status === 'active' || t.status === 'at_risk'),
    pending: currentTasks.filter(t => t.status === 'not_started' || t.status === 'on_hold'),
    completed: currentTasks.filter(t => t.status === 'completed'),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
        <p>Error loading tasks. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">My To-Dos</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgressCount}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Completed This Week</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completedThisWeek}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <User className="w-4 h-4" />
            <span className="text-sm">Assigned to Me</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalAssigned}</p>
        </div>

        {stats.overdueCount > 0 && (
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Overdue</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Lists */}
      <div className="space-y-6">
        {/* Active / In Progress */}
        {groupedTasks.active.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              In Progress ({groupedTasks.active.length})
            </h2>
            <div className="space-y-3">
              {groupedTasks.active.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={activeTab !== 'assigned-to-me'}
                  onOpen={() => onOpenInitiative(task.id)}
                  onStatusChange={(status) => handleStatusChange(task.id, status)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending / Not Started */}
        {groupedTasks.pending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Pending ({groupedTasks.pending.length})
            </h2>
            <div className="space-y-3">
              {groupedTasks.pending.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={activeTab !== 'assigned-to-me'}
                  onOpen={() => onOpenInitiative(task.id)}
                  onStatusChange={(status) => handleStatusChange(task.id, status)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {groupedTasks.completed.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Completed ({groupedTasks.completed.length})
            </h2>
            <div className="space-y-3 opacity-60">
              {groupedTasks.completed.slice(0, 5).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={activeTab !== 'assigned-to-me'}
                  onOpen={() => onOpenInitiative(task.id)}
                  onStatusChange={(status) => handleStatusChange(task.id, status)}
                />
              ))}
              {groupedTasks.completed.length > 5 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  + {groupedTasks.completed.length - 5} more completed tasks
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {currentTasks.length === 0 && (
          <EmptyState
            message={
              activeTab === 'assigned-to-me'
                ? "No tasks assigned to you"
                : activeTab === 'created-by-me'
                ? "You haven't created any tasks yet"
                : "You haven't assigned any tasks to others"
            }
          />
        )}
      </div>
    </div>
  );
}
