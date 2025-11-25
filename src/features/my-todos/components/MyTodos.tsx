import { useState, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, User, Users, Send, ChevronDown, ChevronRight, Search, X, MessageSquare } from 'lucide-react';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus } from '../hooks/useMyTodos';
import TaskDetailModal from './TaskDetailModal';
import type { InitiativeWithDetails } from '../../leadership/lib/leadership';

interface MyTodosProps {
  onBack: () => void;
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
function StatusBadge({ status, onClick }: { status: string; onClick?: () => void }) {
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
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs font-medium rounded-full ${bg} ${text} hover:opacity-80 transition-opacity flex items-center gap-1`}
    >
      {label}
      {onClick && <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: string }) {
  if (priority === 'high') {
    return <span className="text-orange-500 text-sm font-bold" title="High Priority">!!!</span>;
  }
  return null;
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

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// Check if task is overdue
function isOverdue(task: InitiativeWithDetails): boolean {
  if (!task.target_date) return false;
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  return new Date(task.target_date) < new Date();
}

export default function MyTodos({ onBack }: MyTodosProps) {
  const [activeTab, setActiveTab] = useState<TabId>('assigned-to-me');
  const [selectedTask, setSelectedTask] = useState<InitiativeWithDetails | null>(null);
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const { data, isLoading, error } = useMyTodosQuery();
  const stats = useMyTodosStats();
  const updateStatus = useUpdateTaskStatus();

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status });
  };

  const handleOpenTask = (task: InitiativeWithDetails) => {
    setSelectedTask(task);
  };

  const handleQuickComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await handleStatusChange(taskId, 'completed');
  };

  const toggleAreaCollapse = (areaId: string) => {
    setCollapsedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let tasks = getCurrentTasks();

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.area?.name?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      tasks = tasks.filter(t => t.status === filterStatus);
    }

    // Hide completed unless toggled
    if (!showCompleted) {
      tasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    }

    return tasks;
  }, [data, activeTab, searchQuery, filterStatus, showCompleted]);

  // Group tasks by area with function info
  const tasksByArea = useMemo(() => {
    const grouped = new Map<string, {
      areaId: string;
      areaName: string;
      functionName: string;
      tasks: InitiativeWithDetails[];
    }>();

    filteredTasks.forEach(task => {
      const areaId = task.area?.id || 'no-area';
      const areaName = task.area?.name || 'No Area';
      const functionName = (task.area as any)?.function?.name || 'Uncategorized';

      if (!grouped.has(areaId)) {
        grouped.set(areaId, {
          areaId,
          areaName,
          functionName,
          tasks: [],
        });
      }
      grouped.get(areaId)!.tasks.push(task);
    });

    // Sort by function name then area name
    return Array.from(grouped.values()).sort((a, b) => {
      const funcCompare = a.functionName.localeCompare(b.functionName);
      if (funcCompare !== 0) return funcCompare;
      return a.areaName.localeCompare(b.areaName);
    });
  }, [filteredTasks]);

  // Count active filters
  const hasActiveFilters = searchQuery !== '' || filterStatus !== 'all' || showCompleted;

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
    <div className="space-y-4">
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

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="at_risk">At Risk</option>
          </select>

          {/* Show Completed Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              showCompleted
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showCompleted ? 'Showing Completed' : 'Show Completed'}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setShowCompleted(false);
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-600 ml-auto">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table View */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No tasks match your filters"
              : activeTab === 'assigned-to-me'
              ? "No tasks assigned to you"
              : activeTab === 'created-by-me'
              ? "You haven't created any tasks yet"
              : "You haven't assigned any tasks to others"
          }
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[250px]">
                    Initiative / Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                    Description
                  </th>
                  {activeTab !== 'assigned-to-me' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                      Assignee
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
                    Target Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[110px]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                    Notes / Progress
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasksByArea.map(({ areaId, areaName, functionName, tasks }) => {
                  const isCollapsed = collapsedAreas.has(areaId);

                  return (
                    <>
                      {/* Area Header Row */}
                      <tr
                        key={`area-${areaId}`}
                        className="bg-blue-900 border-t-2 border-blue-700 cursor-pointer hover:bg-blue-800 transition-colors"
                        onClick={() => toggleAreaCollapse(areaId)}
                      >
                        <td colSpan={activeTab !== 'assigned-to-me' ? 7 : 6} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-white" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-white" />
                            )}
                            <span className="font-semibold text-white">{functionName}</span>
                            <span className="text-blue-200">/</span>
                            <span className="font-medium text-blue-100">{areaName}</span>
                            <span className="text-sm text-blue-200 ml-2">
                              ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Task Rows */}
                      {!isCollapsed && tasks.map((task, idx) => {
                        const taskOverdue = isOverdue(task);

                        return (
                          <tr
                            key={task.id}
                            className={`border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                            } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''}`}
                            onClick={() => handleOpenTask(task)}
                          >
                            {/* Initiative / Task */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <PriorityIndicator priority={task.priority} />
                                <span className="font-medium text-gray-900">{task.title}</span>
                              </div>
                            </td>

                            {/* Description */}
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {task.description || <span className="text-gray-400 italic">No description</span>}
                              </p>
                            </td>

                            {/* Assignee (only show if not "assigned to me" tab) */}
                            {activeTab !== 'assigned-to-me' && (
                              <td className="px-4 py-3">
                                {task.assigned_user ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                                      {getInitials(task.assigned_user.full_name)}
                                    </div>
                                    <span className="text-sm text-gray-700">
                                      {task.assigned_user.full_name.split(' ')[0]}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400 italic">Unassigned</span>
                                )}
                              </td>
                            )}

                            {/* Target Date */}
                            <td className="px-4 py-3">
                              <span className={`text-sm ${taskOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {task.target_date ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(task.target_date)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <StatusBadge status={task.status} />
                            </td>

                            {/* Notes / Progress */}
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {task.this_week && (
                                  <p className="text-sm text-gray-600 line-clamp-2">{task.this_week}</p>
                                )}
                                {task.progress_percent !== undefined && task.progress_percent > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[100px]">
                                      <div
                                        className="bg-blue-600 h-1.5 rounded-full"
                                        style={{ width: `${Math.min(task.progress_percent, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500">{task.progress_percent}%</span>
                                  </div>
                                )}
                                {!task.this_week && (!task.progress_percent || task.progress_percent === 0) && (
                                  <span className="text-sm text-gray-400 italic">No updates</span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                {task.status !== 'completed' && task.status !== 'cancelled' && (
                                  <button
                                    onClick={(e) => handleQuickComplete(e, task.id)}
                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Mark as completed"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenTask(task)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View details & comments"
                                >
                                  <MessageSquare className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
