import { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, Building2, ChevronDown, ChevronRight, ChevronsUpDown, Search, X, Plus, Lock, Crown, UserCheck, Eye, Folder } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus, useUpdateTaskField, useDeleteTask, usePersonalInitiativesQuery, useArchivePersonalInitiative, useReorderTasks, useLastCommentsQuery, setTaskViewed, type TaskWithDetails } from '../hooks/useMyTodos';
import TaskDetailModal from './TaskDetailModal';
import { TaskCard } from './TaskCard';
import { NewInitiativeModal, EditInitiativeModal, InitiativeSettingsMenu } from './modals/InitiativeModals';
import {
  InlineCommentPopup,
  InitiativeColorPicker,
  EmptyState,
  QuickAddTask,
} from './InlineEditors';
import { SortableTaskRow } from './SortableTaskRow';
import {
  headerColorOptions,
  getInitiativeColor,
  getUserInitiativeColors,
} from '../utils/todoHelpers';

interface MyTodosProps {
  onBack: () => void;
}

// Filter type for the single list view
type FilterId = 'all' | 'i-own' | 'assigned-to-me' | 'my-functions';



// Due date filter type
type DueDateFilter = 'all' | 'overdue' | 'due-today' | 'due-this-week' | 'high-priority' | 'in-progress' | 'done-this-week';

// Sort option type
type SortOption = 'default' | 'due-date-asc' | 'due-date-desc' | 'updated-desc' | 'created-desc';

// LocalStorage key for collapse state
const COLLAPSE_STATE_KEY = 'my-todos-collapse-state';

export default function MyTodos({ onBack }: MyTodosProps) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  // Initialize collapsed state from localStorage
  const [collapsedInitiatives, setCollapsedInitiatives] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed.collapsed || []);
      }
    } catch (e) {
      console.warn('Failed to load collapse state:', e);
    }
    return new Set();
  });
  const [allCollapsed, setAllCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.allCollapsed || false;
      }
    } catch (e) {
      console.warn('Failed to load collapse state:', e);
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingTaskToInitiative, setAddingTaskToInitiative] = useState<string | null>(null);
  const [showNewInitiativeModal, setShowNewInitiativeModal] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<{ id: string; title: string; isPrivate: boolean; headerColor: string | null } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [functionFilter, setFunctionFilter] = useState<string>('all');
  const [colorRefresh, setColorRefresh] = useState(0); // Trigger re-render when user changes initiative color
  const [commentPopup, setCommentPopup] = useState<{
    taskId: string;
    taskTitle: string;
    position: { top: number; left: number };
  } | null>(null);

  const { data, isLoading, error, refetch } = useMyTodosQuery();
  const { data: personalInitiatives = [], refetch: refetchPersonal } = usePersonalInitiativesQuery();
  const archiveInitiative = useArchivePersonalInitiative();
  const stats = useMyTodosStats();
  const updateStatus = useUpdateTaskStatus();
  const updateField = useUpdateTaskField();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();

  // Fetch last comments for all tasks
  const taskIds = useMemo(() => data?.tasks?.map(t => t.id) || [], [data?.tasks]);
  const { data: lastComments = {} } = useLastCommentsQuery(taskIds);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await deleteTask.mutateAsync(taskId);
  };

  const handleArchiveInitiative = async (initiativeId: string, title: string) => {
    if (!confirm(`Are you sure you want to archive "${title}"? This will hide it from your To-Dos.`)) return;
    try {
      await archiveInitiative.mutateAsync(initiativeId);
      refetchPersonal();
    } catch (err) {
      console.error('Failed to archive initiative:', err);
    }
  };

  // Save collapse state to localStorage
  const saveCollapseState = (collapsed: Set<string>, allCollapsedState: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify({
        collapsed: Array.from(collapsed),
        allCollapsed: allCollapsedState,
      }));
    } catch (e) {
      console.warn('Failed to save collapse state:', e);
    }
  };

  const toggleInitiativeCollapse = (initiativeId: string) => {
    setCollapsedInitiatives(prev => {
      const next = new Set(prev);
      if (next.has(initiativeId)) {
        next.delete(initiativeId);
      } else {
        next.add(initiativeId);
      }
      saveCollapseState(next, false);
      setAllCollapsed(false);
      return next;
    });
  };

  // Expand/collapse all initiatives
  const toggleAllCollapse = () => {
    const allInitiativeIds = tasksByInitiative.map(g => g.initiativeId);
    if (allCollapsed) {
      // Expand all
      setCollapsedInitiatives(new Set());
      setAllCollapsed(false);
      saveCollapseState(new Set(), false);
    } else {
      // Collapse all
      const newCollapsed = new Set(allInitiativeIds);
      setCollapsedInitiatives(newCollapsed);
      setAllCollapsed(true);
      saveCollapseState(newCollapsed, true);
    }
  };

  // Handle task drag end within an initiative
  const handleTaskDragEnd = async (event: DragEndEvent, _initiativeId: string, tasks: TaskWithDetails[]) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    const updates = reordered.map((task, index) => ({
      id: task.id,
      sort_order: index,
    }));

    try {
      await reorderTasks.mutateAsync(updates);
      // Optimistic updates handle the UI - refetch happens in onSettled
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
    }
  };

  // TODO: Initiative drag-drop can be added by wrapping tasksByInitiative with DndContext
  // and adding drag handles to initiative headers. The reorderInitiatives mutation is ready.

  // Get unique functions for the filter dropdown
  const availableFunctions = useMemo(() => {
    if (!data?.tasks) return [];
    const functionsMap = new Map<string, string>();
    data.tasks.forEach(task => {
      const funcName = task.initiative?.area?.function?.name;
      const funcId = task.initiative?.area?.function?.id;
      if (funcName && funcId) {
        functionsMap.set(funcId, funcName);
      }
    });
    // Add "Personal" option if there are personal initiatives
    if (personalInitiatives.length > 0) {
      functionsMap.set('personal', 'Personal');
    }
    return Array.from(functionsMap.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.tasks, personalInitiatives]);

  // Filter chips configuration
  const filterChips = [
    { id: 'all' as FilterId, label: 'All Tasks', icon: Eye, count: stats.totalTasks },
    { id: 'i-own' as FilterId, label: 'I Own', icon: Crown, count: stats.totalOwned },
    { id: 'assigned-to-me' as FilterId, label: 'Assigned to Me', icon: UserCheck, count: stats.totalAssigned },
    { id: 'my-functions' as FilterId, label: 'My Functions', icon: Building2, count: stats.totalInMyFunctions },
  ];

  // Get tasks based on active filter
  const getFilteredByRole = (tasks: TaskWithDetails[]): TaskWithDetails[] => {
    switch (activeFilter) {
      case 'all':
        return tasks;
      case 'i-own':
        return tasks.filter(t => t.isOwner);
      case 'assigned-to-me':
        return tasks.filter(t => t.isAssignee);
      case 'my-functions':
        return tasks.filter(t => t.isInMyFunction && !t.isOwner && !t.isAssignee);
      default:
        return tasks;
    }
  };

  // Helper functions for date comparisons
  const isToday = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isThisWeek = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return date >= startOfWeek && date <= endOfWeek;
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];

    // Start with all tasks from the unified array
    let tasks = [...data.tasks];

    // Apply role filter
    tasks = getFilteredByRole(tasks);

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.initiative?.title?.toLowerCase().includes(query) ||
        t.owner?.full_name?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      tasks = tasks.filter(t => t.status === filterStatus);
    }

    // Hide completed unless toggled
    if (!showCompleted) {
      tasks = tasks.filter(t => t.status !== 'done');
    }

    // Apply due date filter
    if (dueDateFilter !== 'all') {
      const now = new Date();
      tasks = tasks.filter(t => {
        switch (dueDateFilter) {
          case 'overdue':
            return t.due_date && new Date(t.due_date) < now && t.status !== 'done';
          case 'due-today':
            return isToday(t.due_date);
          case 'due-this-week':
            return isThisWeek(t.due_date);
          case 'high-priority':
            return t.is_high_priority;
          case 'in-progress':
            return t.status === 'in_progress';
          case 'done-this-week': {
            if (t.status !== 'done') return false;
            if (!t.updated_at) return false;
            const updatedDate = new Date(t.updated_at);
            const today = new Date();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            return updatedDate >= startOfWeek;
          }
          default:
            return true;
        }
      });
    }

    // Apply sorting
    if (sortOption !== 'default') {
      tasks.sort((a, b) => {
        switch (sortOption) {
          case 'due-date-asc':
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          case 'due-date-desc':
            if (!a.due_date && !b.due_date) return 0;
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
          case 'updated-desc':
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          case 'created-desc':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default:
            return 0;
        }
      });
    }

    return tasks;
  }, [data, activeFilter, searchQuery, filterStatus, showCompleted, dueDateFilter, sortOption]);

  // Group tasks by initiative, including personal initiatives with no tasks
  const tasksByInitiative = useMemo(() => {
    const grouped = new Map<string, {
      initiativeId: string;
      initiativeTitle: string;
      functionName: string;
      functionId: string | null;
      areaId: string;
      areaName: string;
      tasks: TaskWithDetails[];
      isPersonal: boolean;
      isPrivate: boolean;
      headerColor: string | null;
      sortOrder: number;
    }>();

    // Add personal initiatives first (even if they have no tasks)
    // Only if function filter is 'all' or 'personal'
    if (functionFilter === 'all' || functionFilter === 'personal') {
      personalInitiatives.forEach(initiative => {
        grouped.set(initiative.id, {
          initiativeId: initiative.id,
          initiativeTitle: initiative.title,
          functionName: 'Personal',
          functionId: 'personal',
          areaId: '',
          areaName: '',
          tasks: [],
          isPersonal: true,
          isPrivate: initiative.is_private,
          headerColor: initiative.header_color,
          sortOrder: initiative.sort_order,
        });
      });
    }

    // Add tasks to their initiatives
    filteredTasks.forEach(task => {
      const initiativeId = task.initiative_id || 'no-initiative';
      const initiativeTitle = task.initiative?.title || 'No Initiative';
      const areaId = task.initiative?.area?.id || '';
      const areaName = task.initiative?.area?.name || '';
      const functionName = task.initiative?.area?.function?.name || 'Uncategorized';
      const taskFunctionId = task.initiative?.area?.function?.id || null;

      // Apply function filter
      if (functionFilter !== 'all') {
        // For personal filter, skip non-personal tasks
        if (functionFilter === 'personal') {
          // Skip tasks that have a function (they're not personal)
          if (taskFunctionId) return;
        } else {
          // Skip tasks that don't match the selected function
          if (taskFunctionId !== functionFilter) return;
        }
      }

      if (!grouped.has(initiativeId)) {
        grouped.set(initiativeId, {
          initiativeId,
          initiativeTitle,
          functionName,
          functionId: taskFunctionId,
          areaId,
          areaName,
          tasks: [],
          isPersonal: false,
          isPrivate: false,
          headerColor: null,
          sortOrder: 999, // Non-personal at the end
        });
      }
      grouped.get(initiativeId)!.tasks.push(task);
    });

    // Sort tasks within each initiative by sort_order when using default order
    if (sortOption === 'default') {
      grouped.forEach((group) => {
        group.tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      });
    }

    // Sort: personal initiatives first (by sortOrder), then others by function/title
    return Array.from(grouped.values()).sort((a, b) => {
      // Personal initiatives first
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;

      // Within personal, sort by sortOrder
      if (a.isPersonal && b.isPersonal) {
        return a.sortOrder - b.sortOrder;
      }

      // Non-personal: sort by function name then title
      const funcCompare = a.functionName.localeCompare(b.functionName);
      if (funcCompare !== 0) return funcCompare;
      return a.initiativeTitle.localeCompare(b.initiativeTitle);
    });
  }, [filteredTasks, personalInitiatives, functionFilter, sortOption, colorRefresh]);

  // Count active filters
  const hasActiveFilters = searchQuery !== '' || filterStatus !== 'all' || showCompleted || activeFilter !== 'all' || dueDateFilter !== 'all' || sortOption !== 'default' || functionFilter !== 'all';

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">My To-Dos</h1>
        </div>
        <button
          onClick={() => setShowNewInitiativeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Initiative
        </button>
      </div>

      {/* Row 1: Search, Status, Quick Filters, Sort */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
          </select>

          {/* Show Completed Toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showCompleted
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            {showCompleted ? '✓ Completed' : 'Show Completed'}
          </button>

          <div className="h-5 w-px bg-gray-300" />

          {/* Due Date Quick Filters */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                dueDateFilter === 'overdue'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Overdue
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'due-today' ? 'all' : 'due-today')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                dueDateFilter === 'due-today'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'due-this-week' ? 'all' : 'due-this-week')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                dueDateFilter === 'due-this-week'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'high-priority' ? 'all' : 'high-priority')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                dueDateFilter === 'high-priority'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Priority
            </button>
          </div>

          <div className="h-5 w-px bg-gray-300" />

          {/* Sort Dropdown */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="default">Default Order</option>
            <option value="due-date-asc">Due Date ↑</option>
            <option value="due-date-desc">Due Date ↓</option>
            <option value="updated-desc">Updated</option>
            <option value="created-desc">Created</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
                setFilterStatus('all');
                setShowCompleted(false);
                setDueDateFilter('all');
                setSortOption('default');
                setFunctionFilter('all');
              }}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            >
              ✕ Clear
            </button>
          )}

        </div>
      </div>

      {/* Row 2: Role Filters, Function Filter, Collapse, Task Count */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Role Filter Chips */}
        <div className="flex items-center gap-1">
          {filterChips.map((chip) => {
            const Icon = chip.icon;
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{chip.label}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-gray-300" />

        {/* Status Quick Filters */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDueDateFilter(dueDateFilter === 'in-progress' ? 'all' : 'in-progress')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              dueDateFilter === 'in-progress'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            In Progress ({stats.inProgressCount})
          </button>
          <button
            onClick={() => setDueDateFilter(dueDateFilter === 'done-this-week' ? 'all' : 'done-this-week')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
              dueDateFilter === 'done-this-week'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Done This Week ({stats.completedThisWeek})
          </button>
        </div>

        <div className="h-5 w-px bg-gray-300" />

        {/* Function Filter */}
        {availableFunctions.length > 1 && (
          <div className="flex items-center gap-1">
            <Folder className="w-4 h-4 text-gray-400" />
            <select
              value={functionFilter}
              onChange={(e) => setFunctionFilter(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Functions</option>
              {availableFunctions.map(func => (
                <option key={func.id} value={func.id}>{func.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Expand/Collapse All Toggle */}
        <button
          onClick={toggleAllCollapse}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
          title={allCollapsed ? 'Expand all initiatives' : 'Collapse all initiatives'}
        >
          <ChevronsUpDown className="w-4 h-4" />
          {allCollapsed ? 'Expand' : 'Collapse'}
        </button>

        {/* Results Count */}
        <div className="text-sm text-gray-500 ml-auto">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table View */}
      {filteredTasks.length === 0 && tasksByInitiative.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No tasks match your filters"
              : "No tasks yet. Create an initiative and add tasks!"
          }
        />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {tasksByInitiative.map(({ initiativeId, initiativeTitle, functionName, areaName, tasks, isPersonal, headerColor }) => (
              <div key={`mobile-${initiativeId}`} className="space-y-2">
                {/* Initiative Header */}
                <div
                  className={`px-4 py-2 rounded-lg cursor-pointer ${
                    isPersonal && headerColor
                      ? `bg-${headerColor}`
                      : getInitiativeColor(initiativeId).bg
                  }`}
                  onClick={() => toggleInitiativeCollapse(initiativeId)}
                >
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      {collapsedInitiatives.has(initiativeId) ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <span className="font-medium text-sm">{initiativeTitle}</span>
                    </div>
                    <span className="text-xs text-white/70">{tasks.length} tasks</span>
                  </div>
                  {functionName && (
                    <div className="text-xs text-white/60 ml-6">
                      {functionName} {areaName && `/ ${areaName}`}
                    </div>
                  )}
                </div>

                {/* Tasks */}
                {!collapsedInitiatives.has(initiativeId) && (
                  <div className="space-y-2 pl-2">
                    {tasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        lastComment={lastComments[task.id] || null}
                        onOpenTask={() => setSelectedTaskId(task.id)}
                      />
                    ))}
                    {tasks.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4 bg-gray-50 rounded-lg">
                        No tasks yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[250px]">
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
                    Assignee(s)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[110px]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px]">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[180px]">
                    Last Comment
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[70px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasksByInitiative.map(({ initiativeId, initiativeTitle, functionName, areaName, tasks, isPersonal, isPrivate, headerColor }) => {
                  const isCollapsed = collapsedInitiatives.has(initiativeId);

                  // Color logic:
                  // - Personal initiatives: use custom headerColor (user-selected, stored in DB)
                  // - Organizational initiatives: use user preference from localStorage (default blue)
                  let bgClass: string;
                  let hoverClass: string;
                  let borderClass: string;
                  let currentColorValue: string = 'blue-900';

                  if (isPersonal && headerColor) {
                    // Personal with custom color (stored in DB)
                    const colorOption = headerColorOptions.find(c => c.value === headerColor) || headerColorOptions[0];
                    bgClass = `bg-${headerColor}`;
                    hoverClass = colorOption.hover;
                    borderClass = `border-${headerColor.replace('900', '700').replace('800', '600').replace('700', '500')}`;
                    currentColorValue = headerColor;
                  } else {
                    // Organizational or personal without color - use user preference (localStorage) with blue default
                    const userColor = getInitiativeColor(initiativeId);
                    bgClass = userColor.bg;
                    hoverClass = userColor.hover;
                    borderClass = userColor.border;
                    // Get the current color value for the picker
                    const userColors = getUserInitiativeColors();
                    currentColorValue = userColors[initiativeId] || 'blue-900';
                  }

                  return (
                    <>
                      {/* Initiative Header Row (like Area header in Initiatives tab) */}
                      <tr
                        key={`initiative-${initiativeId}`}
                        className={`${bgClass} border-t-2 ${borderClass} cursor-pointer ${hoverClass} transition-colors`}
                        onClick={() => toggleInitiativeCollapse(initiativeId)}
                      >
                        <td colSpan={8} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-white" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white" />
                              )}
                              <span className="font-semibold text-white">{initiativeTitle}</span>
                              {isPrivate && (
                                <span title="Private initiative">
                                  <Lock className="w-3.5 h-3.5 text-white/70" />
                                </span>
                              )}
                              {areaName && (
                                <>
                                  <span className="text-white/50">•</span>
                                  <span className="text-white/70 text-sm">{functionName} / {areaName}</span>
                                </>
                              )}
                              {isPersonal && !areaName && (
                                <>
                                  <span className="text-white/50">•</span>
                                  <span className="text-white/70 text-sm">Personal</span>
                                </>
                              )}
                              <span className="text-sm text-white/70 ml-2">
                                ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="flex items-center gap-1 group">
                              {/* Color picker for organizational initiatives (user preference stored in localStorage) */}
                              {!isPersonal && (
                                <InitiativeColorPicker
                                  initiativeId={initiativeId}
                                  currentColor={currentColorValue}
                                  onColorChange={() => setColorRefresh(prev => prev + 1)}
                                />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddingTaskToInitiative(initiativeId);
                                  if (isCollapsed) {
                                    toggleInitiativeCollapse(initiativeId);
                                  }
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                Add Task
                              </button>
                              {isPersonal && (
                                <InitiativeSettingsMenu
                                  initiativeId={initiativeId}
                                  initiativeTitle={initiativeTitle}
                                  isPrivate={isPrivate}
                                  headerColor={headerColor}
                                  onEdit={() => setEditingInitiative({ id: initiativeId, title: initiativeTitle, isPrivate, headerColor })}
                                  onArchive={() => handleArchiveInitiative(initiativeId, initiativeTitle)}
                                />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Quick Add Task Row */}
                      {!isCollapsed && addingTaskToInitiative === initiativeId && (
                        <QuickAddTask
                          initiativeId={initiativeId}
                          onCancel={() => setAddingTaskToInitiative(null)}
                          onSuccess={() => {
                            setAddingTaskToInitiative(null);
                            refetch();
                          }}
                        />
                      )}

                      {/* Task Rows with Drag-Drop */}
                      {!isCollapsed && tasks.length > 0 && (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleTaskDragEnd(event, initiativeId, tasks)}
                        >
                          <SortableContext
                            items={tasks.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {tasks.map((task, idx) => (
                              <SortableTaskRow
                                key={task.id}
                                task={task}
                                idx={idx}
                                lastComment={lastComments[task.id] || null}
                                onOpenTask={() => {
                                  setTaskViewed(task.id);
                                  setSelectedTaskId(task.id);
                                }}
                                onOpenCommentPopup={(taskId, taskTitle, position) => {
                                  setCommentPopup({ taskId, taskTitle, position });
                                }}
                                onStatusChange={handleStatusChange}
                                onUpdateField={updateField.mutateAsync}
                                onDeleteTask={handleDeleteTask}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                      {/* Empty Initiative Message */}
                      {!isCollapsed && tasks.length === 0 && addingTaskToInitiative !== initiativeId && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-6 text-center text-gray-500 text-sm">
                            <div className="flex flex-col items-center gap-2">
                              <span>No tasks yet. Click "+ Add Task" to create one.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {/* New Initiative Modal */}
      {showNewInitiativeModal && (
        <NewInitiativeModal
          onClose={() => setShowNewInitiativeModal(false)}
          onSuccess={() => {
            refetchPersonal();
            refetch();
          }}
        />
      )}

      {/* Edit Initiative Modal */}
      {editingInitiative && (
        <EditInitiativeModal
          initiative={editingInitiative}
          onClose={() => setEditingInitiative(null)}
          onSuccess={() => {
            setEditingInitiative(null);
            refetchPersonal();
          }}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Inline Comment Popup */}
      {commentPopup && (
        <InlineCommentPopup
          taskId={commentPopup.taskId}
          taskTitle={commentPopup.taskTitle}
          lastComment={lastComments[commentPopup.taskId] || null}
          position={commentPopup.position}
          onClose={() => setCommentPopup(null)}
        />
      )}
    </div>
  );
}