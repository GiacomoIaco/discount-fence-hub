import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Calendar, CheckSquare, Square, ChevronLeft, Archive, ArchiveRestore, Eye, EyeOff, Filter, Clock, Lock, Unlock } from 'lucide-react';
import { useAreasQuery, useInitiativesByFunctionQuery, useInitiativeUpdatesQuery, useCreateInitiativeUpdate, useUpdateInitiativeUpdate, useDeactivateInitiative, useActivateInitiative, useWeekLockQuery, useUnlockWeek } from '../hooks/useLeadershipQuery';
import { useTasksQuery, useCreateTask, useUpdateTask } from '../hooks/useGoalsQuery';
import type { ProjectInitiative } from '../lib/leadership';
import type { Task } from '../lib/goals.types';
import { toast } from 'react-hot-toast';
import { getMondayOfWeek } from '../lib/leadership';
import TaskEditModal from './TaskEditModal';
import { useAuth } from '../../../contexts/AuthContext';

interface InitiativeTimelineTabProps {
  functionId: string;
}

type ActiveFilter = 'all' | 'active' | 'inactive';

// Helper to format date as local YYYY-MM-DD (avoiding timezone issues with toISOString)
const formatDateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function InitiativeTimelineTab({ functionId }: InitiativeTimelineTabProps) {
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [selectedWeek, setSelectedWeek] = useState<Date>(getMondayOfWeek());

  const { profile } = useAuth();
  const { data: areas } = useAreasQuery(functionId);
  const { data: allInitiatives } = useInitiativesByFunctionQuery(functionId);
  const deactivateInitiative = useDeactivateInitiative();
  const activateInitiative = useActivateInitiative();

  // Week lock status - use local date format to avoid timezone issues
  const weekStartDate = formatDateOnly(selectedWeek);
  const { data: weekLock } = useWeekLockQuery(weekStartDate);
  const unlockWeek = useUnlockWeek();

  const isWeekLocked = (weekLock?.locked && !weekLock?.in_grace_period) || false;
  const isInGracePeriod = weekLock?.in_grace_period || false;
  const isAdmin = profile?.is_super_admin === true;

  // Filter initiatives by active status
  const initiatives = allInitiatives?.filter(initiative => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return initiative.is_active !== false;
    if (activeFilter === 'inactive') return initiative.is_active === false;
    return true;
  }) || [];

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

  // Group initiatives by area
  const initiativesByArea = initiatives.reduce((acc, initiative) => {
    const areaId = initiative.area?.id || 'uncategorized';
    if (!acc[areaId]) {
      acc[areaId] = [];
    }
    acc[areaId].push(initiative);
    return acc;
  }, {} as Record<string, ProjectInitiative[]>);

  const handleDeactivateInitiative = async (initiative: ProjectInitiative) => {
    if (!window.confirm(`Deactivate "${initiative.title}"? This will hide it from planning views.`)) {
      return;
    }

    try {
      await deactivateInitiative.mutateAsync(initiative.id);
      toast.success(`Deactivated "${initiative.title}"`);
    } catch (error) {
      console.error('Failed to deactivate initiative:', error);
      toast.error('Failed to deactivate initiative');
    }
  };

  const handleActivateInitiative = async (initiative: ProjectInitiative) => {
    try {
      await activateInitiative.mutateAsync(initiative.id);
      toast.success(`Activated "${initiative.title}"`);
    } catch (error) {
      console.error('Failed to activate initiative:', error);
      toast.error('Failed to activate initiative');
    }
  };

  const formatWeekRange = (date: Date) => {
    const monday = new Date(date);
    const sunday = new Date(date);
    sunday.setDate(sunday.getDate() + 6);

    return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const goToPreviousWeek = () => {
    const prev = new Date(selectedWeek);
    prev.setDate(prev.getDate() - 7);
    setSelectedWeek(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(selectedWeek);
    next.setDate(next.getDate() + 7);
    setSelectedWeek(next);
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(getMondayOfWeek());
  };

  const handleUnlockWeek = async () => {
    const reason = window.prompt('Reason for unlocking this week:');
    if (!reason) return;

    try {
      await unlockWeek.mutateAsync({
        weekStartDate,
        unlockReason: reason,
      });
      toast.success('Week unlocked successfully');
    } catch (error) {
      console.error('Failed to unlock week:', error);
      toast.error('Failed to unlock week');
    }
  };

  // Compare dates only (not timestamps) to determine if viewing current week
  const isCurrentWeek = formatDateOnly(selectedWeek) === formatDateOnly(getMondayOfWeek());

  if (!areas || areas.length === 0) {
    return (
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No areas created yet
          </h3>
          <p className="text-gray-600">
            Create areas in the Annual Plan tab first to organize your initiatives
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Header with Week Navigation and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          {/* Week Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  Week of {formatWeekRange(selectedWeek)}
                </div>
                <input
                  type="date"
                  value={selectedWeek.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedWeek(getMondayOfWeek(new Date(e.target.value)))}
                  className="text-xs px-2 py-0.5 border border-gray-300 rounded mt-1"
                />
              </div>
            </div>

            <button
              onClick={goToNextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>

            {!isCurrentWeek && (
              <button
                onClick={goToCurrentWeek}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Current Week
              </button>
            )}
          </div>

          {/* Active Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Show:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveFilter('active')}
                className={`px-3 py-1 text-sm rounded ${
                  activeFilter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Eye className="w-3 h-3 inline-block mr-1" />
                Active
              </button>
              <button
                onClick={() => setActiveFilter('inactive')}
                className={`px-3 py-1 text-sm rounded ${
                  activeFilter === 'inactive'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <EyeOff className="w-3 h-3 inline-block mr-1" />
                Inactive
              </button>
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-sm rounded ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Track weekly progress and manage tasks. {isWeekLocked ? 'This week is locked.' : isInGracePeriod ? 'Grace period active until Monday 12pm.' : 'Current week is editable.'}
          </p>

          {isWeekLocked && isAdmin && (
            <button
              onClick={handleUnlockWeek}
              disabled={unlockWeek.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              title="CEO Override: Unlock this week"
            >
              <Unlock className="w-4 h-4" />
              {unlockWeek.isPending ? 'Unlocking...' : 'Unlock Week'}
            </button>
          )}
        </div>
      </div>

      {/* Areas and Initiatives Table */}
      {areas.map((area) => {
        const areaInitiatives = initiativesByArea[area.id] || [];
        const isCollapsed = collapsedAreas.has(area.id);

        // Skip areas with no initiatives based on current filter
        if (areaInitiatives.length === 0) return null;

        // Calculate last week date
        const lastWeek = new Date(selectedWeek);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Format week header dates
        const formatWeekHeader = (date: Date, isCurrent: boolean) => {
          const start = new Date(date);
          const end = new Date(date);
          end.setDate(end.getDate() + 6);

          const dateStr = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

          if (isCurrent) {
            return `${dateStr} (Current)`;
          }
          return dateStr;
        };

        return (
          <div key={area.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Area Header - Blue separator like Annual Plan */}
            <div
              className="bg-blue-900 border-b border-blue-700 px-4 py-2 cursor-pointer hover:bg-blue-800 transition-colors flex items-center gap-2"
              onClick={() => toggleAreaCollapse(area.id)}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-white" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white" />
              )}
              <h3 className="text-base font-semibold text-white">{area.name}</h3>
              <span className="text-xs text-blue-200">
                ({areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Initiatives Table */}
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/5">
                        Initiative
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/4 bg-gray-50">
                        <div className="flex flex-col">
                          <span>Previous Week</span>
                          <span className="text-xs font-normal text-gray-500 normal-case">
                            {formatWeekHeader(lastWeek, false)}
                          </span>
                        </div>
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/4 ${isWeekLocked ? 'bg-red-50' : isInGracePeriod ? 'bg-orange-50' : isCurrentWeek ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {isWeekLocked && <Lock className="w-4 h-4 text-red-600" />}
                            {isInGracePeriod && <Clock className="w-4 h-4 text-orange-600" />}
                            <span>Selected Week</span>
                          </div>
                          <span className={`text-xs font-normal normal-case ${isWeekLocked ? 'text-red-600 font-semibold' : isInGracePeriod ? 'text-orange-600 font-semibold' : isCurrentWeek ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                            {formatWeekHeader(selectedWeek, isCurrentWeek)}
                            {isInGracePeriod && ' (Grace Period)'}
                            {isWeekLocked && ' (Locked)'}
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/3">
                        Tasks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {areaInitiatives.map((initiative) => (
                      <InitiativeTableRow
                        key={initiative.id}
                        initiative={initiative}
                        selectedWeek={selectedWeek}
                        isCurrentWeek={isCurrentWeek}
                        isWeekLocked={isWeekLocked}
                        isInGracePeriod={isInGracePeriod}
                        onDeactivate={handleDeactivateInitiative}
                        onActivate={handleActivateInitiative}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Separate component for each initiative table row
interface InitiativeTableRowProps {
  initiative: ProjectInitiative;
  selectedWeek: Date;
  isCurrentWeek: boolean;
  isWeekLocked: boolean;
  isInGracePeriod: boolean;
  onDeactivate: (initiative: ProjectInitiative) => void;
  onActivate: (initiative: ProjectInitiative) => void;
}

function InitiativeTableRow({
  initiative,
  selectedWeek,
  isCurrentWeek,
  isWeekLocked,
  isInGracePeriod,
  onDeactivate,
  onActivate,
}: InitiativeTableRowProps) {
  const [isEditingThisWeek, setIsEditingThisWeek] = useState(false);
  const [thisWeekText, setThisWeekText] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Determine if editing is allowed
  // Can edit if it's current week OR if it's in grace period (but not locked)
  const canEdit = isCurrentWeek || (!isWeekLocked && isInGracePeriod);

  const { data: tasks } = useTasksQuery(initiative.id);
  const { data: allUpdates } = useInitiativeUpdatesQuery(initiative.id);
  const createUpdate = useCreateInitiativeUpdate();
  const updateUpdate = useUpdateInitiativeUpdate();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // Get last week's date
  const lastWeek = new Date(selectedWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);

  // Find updates for last week and this week using string comparison to avoid timezone issues
  const selectedWeekStr = formatDateOnly(selectedWeek);
  const lastWeekStr = formatDateOnly(lastWeek);

  const lastWeekUpdate = allUpdates?.find(update => {
    // week_start_date from DB is already in YYYY-MM-DD format
    return update.week_start_date === lastWeekStr;
  });

  const thisWeekUpdate = allUpdates?.find(update => {
    return update.week_start_date === selectedWeekStr;
  });

  // Filter tasks by completion date
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const activeTasks = tasks?.filter(t => t.status !== 'done') || [];
  const recentlyCompletedTasks = tasks?.filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    return completedDate >= oneWeekAgo;
  }) || [];
  const olderCompletedTasks = tasks?.filter(t => {
    if (t.status !== 'done' || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    return completedDate < oneWeekAgo;
  }) || [];

  const handleSaveUpdate = async (textToSave?: string) => {
    const text = textToSave !== undefined ? textToSave : thisWeekText;

    if (!text.trim()) {
      setIsEditingThisWeek(false);
      setThisWeekText('');
      return;
    }

    // Don't save if text hasn't changed
    if (thisWeekUpdate && text.trim() === thisWeekUpdate.update_text) {
      setIsEditingThisWeek(false);
      return;
    }

    try {
      if (thisWeekUpdate) {
        // Update existing
        await updateUpdate.mutateAsync({
          id: thisWeekUpdate.id,
          initiative_id: initiative.id,
          update_text: text.trim(),
        });
        toast.success('Update saved');
      } else {
        // Create new - use local date format to avoid timezone issues
        await createUpdate.mutateAsync({
          initiative_id: initiative.id,
          update_text: text.trim(),
          week_start_date: formatDateOnly(selectedWeek),
        });
        toast.success('Update added');
      }
      setIsEditingThisWeek(false);
    } catch (error) {
      console.error('Failed to save update:', error);
      toast.error('Failed to save update');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingThisWeek(false);
    setThisWeekText(thisWeekUpdate?.update_text || '');
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      setAddingTask(false);
      return;
    }

    try {
      await createTask.mutateAsync({
        initiative_id: initiative.id,
        title: newTaskTitle,
        status: 'todo',
      });
      toast.success('Task added');
      setNewTaskTitle('');
      setAddingTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await updateTask.mutateAsync({
        id: task.id,
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      });
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    }
  };

  const getTaskStatusColor = (task: Task) => {
    // If done, always green
    if (task.status === 'done') {
      return 'text-green-600';
    }

    // Check if overdue
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        return 'text-red-600'; // Overdue
      }
    }

    // Status-based colors
    switch (task.status) {
      case 'in_progress':
        return 'text-blue-600';
      case 'blocked':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTaskDueDateIndicator = (task: Task) => {
    if (!task.due_date || task.status === 'done') return null;

    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="text-xs text-red-600 font-semibold ml-2">(overdue)</span>;
    } else if (diffDays === 0) {
      return <span className="text-xs text-orange-600 font-semibold ml-2">(due today)</span>;
    } else if (diffDays === 1) {
      return <span className="text-xs text-yellow-600 ml-2">(due tomorrow)</span>;
    } else if (diffDays <= 3) {
      return <span className="text-xs text-gray-600 ml-2">(due in {diffDays} days)</span>;
    }

    return null;
  };

  return (
    <>
      <tr className="hover:bg-gray-50">
        {/* Initiative Column */}
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col gap-1">
            <div className="font-medium text-gray-900 text-sm">{initiative.title}</div>
            {!initiative.is_active && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded w-fit">
                Inactive
              </span>
            )}
            {initiative.is_active ? (
              <button
                onClick={() => onDeactivate(initiative)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors w-fit"
                title="Deactivate initiative"
              >
                <Archive className="w-3 h-3" />
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => onActivate(initiative)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors w-fit"
                title="Activate initiative"
              >
                <ArchiveRestore className="w-3 h-3" />
                Activate
              </button>
            )}
          </div>
        </td>

      {/* Last Week Column (Readonly) */}
      <td className="px-4 py-3 align-top bg-gray-50">
        {lastWeekUpdate ? (
          <div className="text-sm text-gray-700">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Clock className="w-3 h-3" />
              {lastWeekUpdate.author && <span>{lastWeekUpdate.author.full_name}</span>}
            </div>
            <p className="whitespace-pre-wrap">{lastWeekUpdate.update_text}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No update</p>
        )}
      </td>

      {/* This Week Column (Editable if allowed) */}
      <td className={`px-4 py-3 align-top ${isWeekLocked ? 'bg-red-50' : isInGracePeriod ? 'bg-orange-50' : isCurrentWeek ? 'bg-blue-50' : ''}`}>
        {canEdit ? (
          isEditingThisWeek ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={thisWeekText}
                onChange={(e) => setThisWeekText(e.target.value)}
                placeholder="What progress was made this week?"
                className="w-full text-sm px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                onBlur={(e) => handleSaveUpdate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.currentTarget.blur(); // Trigger save via onBlur
                  }
                }}
              />
              <div className="flex gap-2 items-center">
                {(createUpdate.isPending || updateUpdate.isPending) && (
                  <span className="text-xs text-blue-600">Saving...</span>
                )}
                <span className="text-xs text-gray-500">
                  Auto-saves on blur | Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setIsEditingThisWeek(true);
                setThisWeekText(thisWeekUpdate?.update_text || '');
              }}
              className="cursor-pointer hover:bg-blue-100 rounded p-2 min-h-[60px] transition-colors"
            >
              {thisWeekUpdate ? (
                <div className="text-sm text-gray-700">
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Clock className="w-3 h-3" />
                    {thisWeekUpdate.author && <span>{thisWeekUpdate.author.full_name}</span>}
                  </div>
                  <p className="whitespace-pre-wrap">{thisWeekUpdate.update_text}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Click to add update...</p>
              )}
            </div>
          )
        ) : (
          // Locked weeks - readonly with lock message
          <div>
            {thisWeekUpdate ? (
              <div className="text-sm text-gray-700">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <Clock className="w-3 h-3" />
                  {thisWeekUpdate.author && <span>{thisWeekUpdate.author.full_name}</span>}
                </div>
                <p className="whitespace-pre-wrap">{thisWeekUpdate.update_text}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No update</p>
            )}
            {isWeekLocked && (
              <div className="flex items-center gap-2 text-xs text-red-600 mt-2 italic">
                <Lock className="w-3 h-3" />
                Week locked
              </div>
            )}
          </div>
        )}
      </td>

      {/* Tasks Column */}
      <td className="px-4 py-3 align-top">
        <div className="space-y-1">
          {/* Active Tasks */}
          {activeTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 py-1 group">
              <button
                onClick={() => handleToggleTask(task)}
                className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
              >
                {task.status === 'done' ? (
                  <CheckSquare className={`w-4 h-4 ${getTaskStatusColor(task)}`} />
                ) : (
                  <Square className={`w-4 h-4 ${getTaskStatusColor(task)}`} />
                )}
              </button>
              <button
                onClick={() => setEditingTask(task)}
                className={`text-sm flex-1 text-left hover:underline ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}
              >
                {task.title}
                {task.status === 'blocked' && (
                  <span className="ml-2 text-xs text-red-600">(blocked)</span>
                )}
                {task.status === 'in_progress' && (
                  <span className="ml-2 text-xs text-blue-600">(in progress)</span>
                )}
                {getTaskDueDateIndicator(task)}
              </button>
            </div>
          ))}

          {/* Recently Completed Tasks (< 1 week) */}
          {recentlyCompletedTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 py-1 group">
              <button
                onClick={() => handleToggleTask(task)}
                className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
              >
                <CheckSquare className="w-4 h-4 text-green-600" />
              </button>
              <button
                onClick={() => setEditingTask(task)}
                className="text-sm flex-1 text-left line-through text-gray-400 hover:underline"
              >
                {task.title}
              </button>
            </div>
          ))}

          {/* Older Completed Tasks (Collapsed) */}
          {olderCompletedTasks.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                {olderCompletedTasks.length} older completed task{olderCompletedTasks.length !== 1 ? 's' : ''}
              </summary>
              <div className="ml-4 mt-1 space-y-1">
                {olderCompletedTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2 py-1 group">
                    <button
                      onClick={() => handleToggleTask(task)}
                      className="mt-0.5 hover:scale-110 transition-transform flex-shrink-0"
                    >
                      <CheckSquare className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={() => setEditingTask(task)}
                      className="text-sm flex-1 text-left line-through text-gray-400 hover:underline"
                    >
                      {task.title}
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Add Task Input - Only show if week is not locked */}
          {!isWeekLocked && (
            addingTask ? (
              <div className="flex items-center gap-2 py-1">
                <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  onBlur={handleAddTask}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setAddingTask(false);
                      setNewTaskTitle('');
                    }
                    if (e.key === 'Enter') {
                      handleAddTask();
                    }
                  }}
                  className="flex-1 text-sm px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingTask(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors mt-1"
              >
                <Plus className="w-3 h-3" />
                Add Task
              </button>
            )
          )}

          {activeTasks.length === 0 && recentlyCompletedTasks.length === 0 && !addingTask && (
            <p className="text-sm text-gray-400 italic py-1">No active tasks</p>
          )}
          </div>
        </td>
      </tr>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
