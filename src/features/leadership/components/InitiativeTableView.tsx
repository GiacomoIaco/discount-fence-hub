import React, { useState, useMemo, useEffect } from 'react';
import { Target, AlertCircle, ChevronDown, ChevronRight, TrendingUp, Plus, Folder, FolderOpen, Search, X } from 'lucide-react';
import { useUpdateInitiative } from '../hooks/useLeadershipQuery';
import { useInitiativeGoalLinksQuery, useTasksQuery, useCreateTask } from '../hooks/useGoalsQuery';
import type { ProjectInitiative, ProjectArea } from '../lib/leadership';
import WeeklyMetrics from './WeeklyMetrics';
import TaskRow from './TaskRow';
import Toast, { type ToastType } from './Toast';

interface InitiativeTableViewProps {
  initiatives: ProjectInitiative[];
  areas?: ProjectArea[];
  onInitiativeClick: (initiativeId: string) => void;
  onAddInitiativeToArea?: (areaId: string) => void;
}

interface EditingCell {
  initiativeId: string;
  field: 'this_week' | 'next_week' | 'status' | 'priority' | 'progress_percent';
}

interface PendingChange {
  initiativeId: string;
  field: string;
  value: any;
}

export default function InitiativeTableView({ initiatives, areas = [], onInitiativeClick, onAddInitiativeToArea }: InitiativeTableViewProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [weeklyMetricsInitiative, setWeeklyMetricsInitiative] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showNeedsUpdateOnly, setShowNeedsUpdateOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const updateInitiative = useUpdateInitiative();
  const createTask = useCreateTask();

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(initiative => {
      // Status filter
      if (filterStatus !== 'all' && initiative.status !== filterStatus) {
        return false;
      }

      // Priority filter
      if (filterPriority !== 'all' && initiative.priority !== filterPriority) {
        return false;
      }

      // Needs update filter
      if (showNeedsUpdateOnly && !needsWeeklyUpdate(initiative)) {
        return false;
      }

      // Search query
      if (searchQuery && !initiative.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [initiatives, filterStatus, filterPriority, showNeedsUpdateOnly, searchQuery]);

  // Group initiatives by area - include all areas even if empty
  const initiativesByArea = useMemo(() => {
    const grouped = new Map<string, ProjectInitiative[]>();

    // First, initialize all areas with empty arrays
    areas.forEach(area => {
      grouped.set(area.id, []);
    });

    // Then add initiatives to their respective areas
    filteredInitiatives.forEach(initiative => {
      const areaId = initiative.area?.id || 'no-area';
      if (!grouped.has(areaId)) {
        grouped.set(areaId, []);
      }
      grouped.get(areaId)!.push(initiative);
    });

    return grouped;
  }, [filteredInitiatives, areas]);

  // Warn before navigation if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.length > 0) {
        e.preventDefault();
        // Modern browsers require returnValue to be set
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingChanges.length]);

  // Check if initiative needs weekly update
  const needsWeeklyUpdate = (initiative: ProjectInitiative): boolean => {
    // Initiative needs update if:
    // 1. "This Week" field is empty
    // 2. Status is active or at_risk (not completed, cancelled, or on_hold)
    const isActiveStatus = initiative.status === 'active' || initiative.status === 'at_risk';
    const hasNoThisWeekUpdate = !initiative.this_week || initiative.this_week.trim() === '';

    return isActiveStatus && hasNoThisWeekUpdate;
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

  const toggleExpand = (initiativeId: string) => {
    setExpandedInitiatives(prev => {
      const next = new Set(prev);
      if (next.has(initiativeId)) {
        next.delete(initiativeId);
      } else {
        next.add(initiativeId);
      }
      return next;
    });
  };

  const handleAddTask = async (initiativeId: string) => {
    if (!newTaskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        initiative_id: initiativeId,
        title: newTaskTitle,
        status: 'todo',
        sort_order: 0,
      });
      setAddingTaskTo(null);
      setNewTaskTitle('');
      // Expand the initiative to show the new task
      setExpandedInitiatives(prev => new Set(prev).add(initiativeId));
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleStartEdit = (initiativeId: string, field: EditingCell['field'], currentValue: any) => {
    setEditingCell({ initiativeId, field });
    setEditValue(currentValue?.toString() || '');
  };

  const handleSaveEdit = (initiativeId: string, field: string) => {
    if (!editingCell) return;

    // Parse value based on field type
    let value: any;
    if (field === 'progress_percent') {
      value = parseInt(editValue) || 0;
    } else {
      value = editValue || undefined;
    }

    // Add to pending changes
    setPendingChanges(prev => {
      const filtered = prev.filter(
        change => !(change.initiativeId === initiativeId && change.field === field)
      );
      return [...filtered, { initiativeId, field, value }];
    });

    setEditingCell(null);
    setEditValue('');
  };

  const handleSaveAllChanges = async () => {
    if (pendingChanges.length === 0) return;

    try {
      // Group changes by initiative
      const changesByInitiative = pendingChanges.reduce((acc, change) => {
        if (!acc[change.initiativeId]) {
          acc[change.initiativeId] = {};
        }
        acc[change.initiativeId][change.field] = change.value;
        return acc;
      }, {} as Record<string, any>);

      // Save all changes
      await Promise.all(
        Object.entries(changesByInitiative).map(([id, data]) =>
          updateInitiative.mutateAsync({ id, ...data })
        )
      );

      const changeCount = pendingChanges.length;
      setPendingChanges([]);

      // Show success toast
      setToast({
        message: `Successfully saved ${changeCount} change${changeCount !== 1 ? 's' : ''}`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to save changes:', error);

      // Show error toast
      setToast({
        message: 'Failed to save changes. Please try again.',
        type: 'error'
      });
    }
  };

  const handleDiscardChanges = () => {
    setPendingChanges([]);
  };

  const hasPendingChange = (initiativeId: string, field: string) => {
    return pendingChanges.some(
      change => change.initiativeId === initiativeId && change.field === field
    );
  };

  const getPendingValue = (initiativeId: string, field: string) => {
    const change = pendingChanges.find(
      c => c.initiativeId === initiativeId && c.field === field
    );
    return change?.value;
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, initiativeId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(initiativeId, field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      not_started: 'bg-gray-100 text-gray-700',
      active: 'bg-blue-100 text-blue-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      at_risk: 'bg-red-100 text-red-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || colors.not_started;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
    };
    return colors[priority] || colors.medium;
  };

  const renderEditableCell = (
    initiative: ProjectInitiative,
    field: 'this_week' | 'next_week',
    value: string | null | undefined
  ) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === field;
    const isPending = hasPendingChange(initiative.id, field);
    const displayValue = isPending ? getPendingValue(initiative.id, field) : value;

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, field)}
          onKeyDown={(e) => handleKeyDown(e, initiative.id, field)}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
          autoFocus
        />
      );
    }

    return (
      <div
        onClick={() => handleStartEdit(initiative.id, field, displayValue)}
        className={`w-full px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-text min-h-[40px] ${
          isPending ? 'bg-yellow-100' : ''
        }`}
      >
        {displayValue || <span className="text-gray-400 italic">Click to edit...</span>}
      </div>
    );
  };

  const renderStatusCell = (initiative: ProjectInitiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'status';
    const isPending = hasPendingChange(initiative.id, 'status');
    const displayStatus = isPending ? getPendingValue(initiative.id, 'status') : initiative.status;

    if (isEditing) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'status')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        >
          <option value="not_started">Not Started</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="at_risk">At Risk</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      );
    }

    return (
      <button
        onClick={() => handleStartEdit(initiative.id, 'status', displayStatus)}
        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(displayStatus)} hover:opacity-80 transition-opacity flex items-center gap-1 ${
          isPending ? 'ring-2 ring-yellow-400' : ''
        }`}
      >
        {displayStatus.replace('_', ' ')}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  };

  const renderPriorityCell = (initiative: ProjectInitiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'priority';
    const isPending = hasPendingChange(initiative.id, 'priority');
    const displayPriority = isPending ? getPendingValue(initiative.id, 'priority') : initiative.priority;

    if (isEditing) {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'priority')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      );
    }

    return (
      <button
        onClick={() => handleStartEdit(initiative.id, 'priority', displayPriority)}
        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(displayPriority)} hover:opacity-80 transition-opacity flex items-center gap-1 capitalize ${
          isPending ? 'ring-2 ring-yellow-400' : ''
        }`}
      >
        {displayPriority}
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  };

  const renderProgressCell = (initiative: ProjectInitiative) => {
    const isEditing = editingCell?.initiativeId === initiative.id && editingCell?.field === 'progress_percent';
    const isPending = hasPendingChange(initiative.id, 'progress_percent');
    const displayProgress = isPending ? getPendingValue(initiative.id, 'progress_percent') : initiative.progress_percent;

    if (isEditing) {
      return (
        <input
          type="number"
          min="0"
          max="100"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSaveEdit(initiative.id, 'progress_percent')}
          onKeyDown={(e) => handleKeyDown(e, initiative.id, 'progress_percent')}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      );
    }

    return (
      <div
        onClick={() => handleStartEdit(initiative.id, 'progress_percent', displayProgress)}
        className={`cursor-pointer hover:bg-gray-50 rounded p-2 ${
          isPending ? 'bg-yellow-100' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(displayProgress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-10 text-right">
            {displayProgress}%
          </span>
        </div>
      </div>
    );
  };

  const TaskRows = ({ initiativeId }: { initiativeId: string }) => {
    const { data: tasks } = useTasksQuery(initiativeId);

    if (!tasks || tasks.length === 0) {
      return (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 py-2 text-center text-sm text-gray-500 italic">
            No tasks yet. Click + to add one.
          </td>
        </tr>
      );
    }

    return (
      <>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </>
    );
  };

  const GoalIndicator = ({ initiativeId }: { initiativeId: string }) => {
    const { data: goalLinks } = useInitiativeGoalLinksQuery(initiativeId);
    const hasGoals = goalLinks && goalLinks.length > 0;

    if (!hasGoals) {
      return (
        <div className="flex items-center justify-center text-yellow-600" title="No goals linked">
          <AlertCircle className="w-4 h-4" />
        </div>
      );
    }

    // Check if any linked goal is high-weight (≥25%)
    const hasHighWeightGoal = goalLinks.some((link) => {
      const annualGoal = link.quarterly_goal?.annual_goal;
      return annualGoal && annualGoal.weight >= 25;
    });

    if (hasHighWeightGoal) {
      return (
        <div className="flex items-center justify-center gap-1" title={`${goalLinks.length} goal(s) linked • High Priority`}>
          <span className="text-orange-500 text-base">🔥</span>
          <Target className="w-4 h-4 text-orange-600" />
          <span className="text-xs text-orange-600 font-semibold">{goalLinks.length}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center text-purple-600" title={`${goalLinks.length} goal(s) linked`}>
        <Target className="w-4 h-4" />
        <span className="text-xs ml-1">{goalLinks.length}</span>
      </div>
    );
  };

  // Count initiatives needing updates
  const initiativesNeedingUpdate = useMemo(() => {
    return initiatives.filter(needsWeeklyUpdate);
  }, [initiatives]);

  // Check if any filters are active
  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || showNeedsUpdateOnly || searchQuery !== '';

  if (initiatives.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No initiatives to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Weekly Update Alert - Show if initiatives need updates */}
      {initiativesNeedingUpdate.length > 0 && (
        <div className="bg-orange-50 border-b-2 border-orange-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <span className="text-sm font-medium text-orange-900">
                {initiativesNeedingUpdate.length} initiative{initiativesNeedingUpdate.length !== 1 ? 's' : ''} need{initiativesNeedingUpdate.length === 1 ? 's' : ''} a weekly update
              </span>
              <p className="text-xs text-orange-700 mt-0.5">
                Active initiatives without a "This Week" update are highlighted
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Banner - Show when there are pending changes */}
      {pendingChanges.length > 0 && (
        <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-900">
              You have {pendingChanges.length} unsaved change{pendingChanges.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAllChanges}
              disabled={updateInitiative.isPending}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateInitiative.isPending ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search initiatives..."
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
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Needs Update Toggle */}
          <button
            onClick={() => setShowNeedsUpdateOnly(!showNeedsUpdateOnly)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              showNeedsUpdateOnly
                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showNeedsUpdateOnly ? 'Showing: Needs Update' : 'Show Needs Update'}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterPriority('all');
                setShowNeedsUpdateOnly(false);
                setSearchQuery('');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-600 ml-auto">
            {filteredInitiatives.length} of {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[250px]">
              Initiative
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
              Priority
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
              This Week
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
              Next Week
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
              Progress
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
              Goals
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from(initiativesByArea.entries()).map(([areaId, areaInitiatives]) => {
            const isAreaCollapsed = collapsedAreas.has(areaId);
            // Get area name from areas array first, fallback to initiative's area data
            const area = areas.find(a => a.id === areaId);
            const areaName = area?.name || areaInitiatives[0]?.area?.name || 'Uncategorized';

            return (
              <React.Fragment key={areaId}>
                {/* Area Header Row */}
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={8} className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleAreaCollapse(areaId)}
                        className="flex items-center gap-2 text-left hover:bg-gray-200 rounded px-2 py-1 transition-colors flex-1"
                      >
                        {isAreaCollapsed ? (
                          <FolderOpen className="w-4 h-4 text-gray-600" />
                        ) : (
                          <Folder className="w-4 h-4 text-gray-600" />
                        )}
                        {isAreaCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                        <span className="font-semibold text-gray-900">{areaName}</span>
                        <span className="text-sm text-gray-500">
                          ({areaInitiatives.length} initiative{areaInitiatives.length !== 1 ? 's' : ''})
                        </span>
                      </button>
                      {onAddInitiativeToArea && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddInitiativeToArea(areaId);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Add initiative to this area"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Initiative</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Initiative Rows (only if area not collapsed) */}
                {!isAreaCollapsed && areaInitiatives.map((initiative, idx) => {
            const isExpanded = expandedInitiatives.has(initiative.id);
            const isAddingTask = addingTaskTo === initiative.id;
            const needsUpdate = needsWeeklyUpdate(initiative);

            return (
              <>
                {/* Initiative Row */}
                <tr
                  key={initiative.id}
                  className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                  } ${needsUpdate ? 'border-l-4 border-l-orange-400 bg-orange-50' : ''}`}
                >
                  {/* Title with Expand/Collapse */}
                  <td className="px-4 py-3 sticky left-0 bg-inherit">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(initiative.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onInitiativeClick(initiative.id)}
                            className="text-left font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {initiative.title}
                          </button>
                          {needsUpdate && (
                            <div title="This initiative needs a weekly update">
                              <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">{renderStatusCell(initiative)}</td>

                  {/* Priority */}
                  <td className="px-4 py-3">{renderPriorityCell(initiative)}</td>

                  {/* This Week */}
                  <td className="px-4 py-3">
                    {renderEditableCell(initiative, 'this_week', initiative.this_week)}
                  </td>

                  {/* Next Week */}
                  <td className="px-4 py-3">
                    {renderEditableCell(initiative, 'next_week', initiative.next_week)}
                  </td>

                  {/* Progress */}
                  <td className="px-4 py-3">{renderProgressCell(initiative)}</td>

                  {/* Goals Indicator */}
                  <td className="px-4 py-3">
                    <GoalIndicator initiativeId={initiative.id} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingTaskTo(initiative.id);
                          setNewTaskTitle('');
                          if (!isExpanded) {
                            toggleExpand(initiative.id);
                          }
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Add task"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWeeklyMetricsInitiative({
                            id: initiative.id,
                            title: initiative.title,
                          });
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Track weekly metrics"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Task Rows (when expanded) */}
                {isExpanded && <TaskRows initiativeId={initiative.id} />}

                {/* Add Task Row */}
                {isAddingTask && (
                  <tr className="bg-blue-50 border-b border-blue-100">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex items-center gap-2 pl-12">
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddTask(initiative.id);
                            } else if (e.key === 'Escape') {
                              setAddingTaskTo(null);
                              setNewTaskTitle('');
                            }
                          }}
                          placeholder="Task name..."
                          className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddTask(initiative.id)}
                          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setAddingTaskTo(null);
                            setNewTaskTitle('');
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Weekly Metrics Modal */}
      {weeklyMetricsInitiative && (
        <WeeklyMetrics
          initiativeId={weeklyMetricsInitiative.id}
          initiativeTitle={weeklyMetricsInitiative.title}
          onClose={() => setWeeklyMetricsInitiative(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
