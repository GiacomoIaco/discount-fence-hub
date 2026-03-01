import { useState, useRef, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Settings, Users, Archive, GripVertical, Search, UserCircle, Eye, EyeOff, Bookmark, X } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../../contexts/AuthContext';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import { useTodoSectionsQuery, useCreateTodoSection, useUpdateTodoSection, useDeleteTodoSection, useReorderTodoSections } from '../hooks/useTodoSections';
import {
  useTodoItemsQuery,
  useUpdateTodoItemStatus,
  useUpdateTodoItem,
  useDeleteTodoItem,
  useReorderTodoItems,
  useTodoLastCommentsQuery,
} from '../hooks/useTodoItems';
import { setTaskViewed } from '../hooks/useMyTodos';
import { SortableTaskRow, MobileTaskCard } from './SortableTaskRow';
import { InlineCommentPopup, SectionColorPicker, EmptyState, QuickAddTask, MobileQuickAddTask } from './InlineEditors';
import TaskDetailModal from './TaskDetailModal';
import { getSectionColor, statusOptions } from '../utils/todoHelpers';
import { useTodoKeyboard } from '../hooks/useTodoKeyboard';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import type { TodoItem, TodoSection, TodoItemStatus } from '../types';

// Auto-hide tasks completed more than 7 days ago
function isStaleCompleted(task: TodoItem): boolean {
  if (task.status !== 'done' || !task.completed_at) return false;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(task.completed_at) < sevenDaysAgo;
}

// === Saved Views ===

interface SavedView {
  id: string;
  name: string;
  filters: {
    searchQuery: string;
    statusFilter: string;
    myTasksOnly: boolean;
    showDone: boolean;
    dueDateFilter: string;
    priorityOnly: boolean;
  };
}

const SAVED_VIEWS_KEY = 'todo-saved-views';

function getSavedViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(SAVED_VIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSavedViews(views: SavedView[]) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
}

const PRESET_VIEWS: SavedView[] = [
  {
    id: 'preset-overdue',
    name: 'My Overdue',
    filters: { searchQuery: '', statusFilter: 'all', myTasksOnly: true, showDone: false, dueDateFilter: 'overdue', priorityOnly: false },
  },
  {
    id: 'preset-today',
    name: 'Due Today',
    filters: { searchQuery: '', statusFilter: 'all', myTasksOnly: false, showDone: false, dueDateFilter: 'today', priorityOnly: false },
  },
  {
    id: 'preset-priority',
    name: 'High Priority',
    filters: { searchQuery: '', statusFilter: 'all', myTasksOnly: false, showDone: false, dueDateFilter: 'all', priorityOnly: true },
  },
];

interface TodoListViewProps {
  listId: string;
  onEditList: () => void;
  onManageMembers: () => void;
  onArchiveList: () => void;
}

export default function TodoListView({ listId, onEditList, onManageMembers, onArchiveList }: TodoListViewProps) {
  const { user } = useAuth();
  const { data: lists } = useTodoListsQuery();
  const { data: sections } = useTodoSectionsQuery(listId);
  const { data: items } = useTodoItemsQuery(listId);

  const list = lists?.find(l => l.id === listId);

  // Collect item IDs for last comments query
  const itemIds = useMemo(() => (items || []).map(i => i.id), [items]);
  const { data: lastComments } = useTodoLastCommentsQuery(itemIds);

  // State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [addingTaskInSection, setAddingTaskInSection] = useState<string | null>(null);
  const [addingSectionTitle, setAddingSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [commentPopup, setCommentPopup] = useState<{
    taskId: string;
    taskTitle: string;
    position: { top: number; left: number };
  } | null>(null);
  const [showListMenu, setShowListMenu] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TodoItemStatus | 'all'>('all');
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [showDone, setShowDone] = useState(true);
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'today' | 'this_week'>('all');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Saved views state
  const [savedViews, setSavedViews] = useState<SavedView[]>(getSavedViews);
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const [savingViewName, setSavingViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showHelp, setShowHelp } = useTodoKeyboard({
    onNewTask: () => {
      if (sections && sections.length > 0) {
        setAddingTaskInSection(sections[0].id);
      }
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
    onToggleMyTasks: () => {
      setMyTasksOnly(prev => !prev);
    },
    onSetStatus: (index) => {
      const statuses: Array<TodoItemStatus | 'all'> = ['todo', 'in_progress', 'done', 'blocked'];
      const newStatus = statuses[index];
      setStatusFilter(prev => prev === newStatus ? 'all' : newStatus);
    },
    onEscape: () => {
      setSearchQuery('');
      setStatusFilter('all');
      setMyTasksOnly(false);
      setShowDone(true);
      setDueDateFilter('all');
      setPriorityOnly(false);
    },
  });

  const handleSaveView = () => {
    if (!savingViewName.trim()) return;
    const newView: SavedView = {
      id: `custom-${Date.now()}`,
      name: savingViewName.trim(),
      filters: {
        searchQuery,
        statusFilter: statusFilter as string,
        myTasksOnly,
        showDone,
        dueDateFilter,
        priorityOnly,
      },
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    saveSavedViews(updated);
    setSavingViewName('');
    setShowSaveInput(false);
  };

  const handleLoadView = (view: SavedView) => {
    setSearchQuery(view.filters.searchQuery);
    setStatusFilter(view.filters.statusFilter as any);
    setMyTasksOnly(view.filters.myTasksOnly);
    setShowDone(view.filters.showDone);
    setDueDateFilter(view.filters.dueDateFilter as any);
    setPriorityOnly(view.filters.priorityOnly);
    setShowViewsDropdown(false);
  };

  const handleDeleteView = (viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updated);
    saveSavedViews(updated);
  };

  // Mutations
  const updateStatus = useUpdateTodoItemStatus();
  const updateItem = useUpdateTodoItem();
  const deleteItem = useDeleteTodoItem();
  const reorderItems = useReorderTodoItems();
  const createSection = useCreateTodoSection();
  const updateSection = useUpdateTodoSection();
  const deleteSection = useDeleteTodoSection();
  const reorderSections = useReorderTodoSections();

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Filter items then group by section
  const filteredItems = useMemo(() => {
    let result = items || [];

    // Hide completed
    if (!showDone) {
      result = result.filter(i => i.status !== 'done');
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }

    // My tasks only (assigned to me OR I follow)
    if (myTasksOnly && user?.id) {
      result = result.filter(i =>
        i.assigned_to === user.id ||
        i.created_by === user.id ||
        i.followers?.some(f => f.user_id === user.id)
      );
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      );
    }

    // Due date filters
    if (dueDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      if (dueDateFilter === 'overdue') {
        result = result.filter(i => {
          if (!i.due_date || i.status === 'done') return false;
          return i.due_date < todayStr;
        });
      } else if (dueDateFilter === 'today') {
        result = result.filter(i => i.due_date === todayStr);
      } else if (dueDateFilter === 'this_week') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        result = result.filter(i => i.due_date && i.due_date >= todayStr && i.due_date <= weekEndStr);
      }
    }

    // High priority filter
    if (priorityOnly) {
      result = result.filter(i => i.is_high_priority);
    }

    // Auto-hide stale completed (done > 7 days ago) unless showing archived
    if (!showArchived) {
      result = result.filter(i => !isStaleCompleted(i));
    }

    return result;
  }, [items, showDone, statusFilter, myTasksOnly, searchQuery, user?.id, dueDateFilter, priorityOnly, showArchived]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || myTasksOnly || !showDone || dueDateFilter !== 'all' || priorityOnly || showArchived;

  // Count stale completed items for "Show archived" link
  const staleCount = useMemo(() => (items || []).filter(isStaleCompleted).length, [items]);

  // Group filtered items by section
  const itemsBySection = useMemo(() => {
    const map: Record<string, TodoItem[]> = {};
    (sections || []).forEach(s => { map[s.id] = []; });
    filteredItems.forEach(item => {
      if (map[item.section_id]) {
        map[item.section_id].push(item);
      }
    });
    // Sort each section's items: done items last, then by sort_order within each group
    Object.values(map).forEach(arr => arr.sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.sort_order - b.sort_order;
    }));
    return map;
  }, [filteredItems, sections]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleItemDragEnd = useCallback((event: DragEndEvent, sectionId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionItems = itemsBySection[sectionId] || [];
    const oldIndex = sectionItems.findIndex(i => i.id === active.id);
    const newIndex = sectionItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionItems, oldIndex, newIndex);
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      sort_order: idx,
    }));

    reorderItems.mutate({ listId, items: updates });
  }, [itemsBySection, listId, reorderItems]);

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    const updates = reordered.map((s, idx) => ({
      id: s.id,
      sort_order: idx,
    }));

    reorderSections.mutate({ listId, sections: updates });
  }, [sections, listId, reorderSections]);

  const handleStatusChange = useCallback(async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status, listId });
  }, [updateStatus, listId]);

  const handleUpdateField = useCallback(async (params: { id: string; field: string; value: any }) => {
    await updateItem.mutateAsync({
      id: params.id,
      listId,
      [params.field]: params.value,
    });
  }, [updateItem, listId]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteItem.mutateAsync({ id: taskId, listId });
  }, [deleteItem, listId]);

  const handleAddSection = async () => {
    if (!addingSectionTitle.trim()) {
      setShowAddSection(false);
      return;
    }
    await createSection.mutateAsync({
      listId,
      title: addingSectionTitle.trim(),
    });
    setAddingSectionTitle('');
    setShowAddSection(false);
  };

  const handleDeleteSection = async (sectionId: string, sectionTitle: string) => {
    const sectionItems = itemsBySection[sectionId] || [];
    if (sectionItems.length > 0) {
      if (!window.confirm(`Delete "${sectionTitle}" and its ${sectionItems.length} task(s)?`)) return;
    }
    await deleteSection.mutateAsync({ id: sectionId, listId });
  };

  if (!list) {
    return <div className="p-8 text-center text-gray-500">List not found</div>;
  }

  return (
    <div className="p-4 md:p-6">
      {/* List Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
          {list.description && <p className="text-sm text-gray-500 mt-1">{list.description}</p>}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowListMenu(!showListMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
          {showListMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowListMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <button
                  onClick={() => { setShowListMenu(false); onEditList(); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> Edit List
                </button>
                {list.visibility === 'private' && (
                  <button
                    onClick={() => { setShowListMenu(false); onManageMembers(); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" /> Manage Members
                  </button>
                )}
                <button
                  onClick={() => { setShowListMenu(false); onArchiveList(); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" /> Archive List
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar — Desktop */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TodoItemStatus | 'all')}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {statusOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* @Me toggle */}
        <button
          onClick={() => setMyTasksOnly(!myTasksOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            myTasksOnly
              ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <UserCircle className="w-4 h-4" />
          @Me
        </button>

        {/* Show done toggle */}
        <button
          onClick={() => setShowDone(!showDone)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !showDone
              ? 'bg-gray-100 border-gray-300 text-gray-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {showDone ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showDone ? 'Done visible' : 'Done hidden'}
        </button>

        {/* Overdue pill */}
        <button
          onClick={() => setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            dueDateFilter === 'overdue'
              ? 'bg-red-50 border-red-300 text-red-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Overdue
        </button>

        {/* Due Today pill */}
        <button
          onClick={() => setDueDateFilter(dueDateFilter === 'today' ? 'all' : 'today')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            dueDateFilter === 'today'
              ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Due Today
        </button>

        {/* Due This Week pill */}
        <button
          onClick={() => setDueDateFilter(dueDateFilter === 'this_week' ? 'all' : 'this_week')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            dueDateFilter === 'this_week'
              ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          This Week
        </button>

        {/* High Priority pill */}
        <button
          onClick={() => setPriorityOnly(!priorityOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            priorityOnly
              ? 'bg-red-50 border-red-300 text-red-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Priority
        </button>

        {/* Saved Views */}
        <div className="relative">
          <button
            onClick={() => setShowViewsDropdown(!showViewsDropdown)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Views
          </button>
          {showViewsDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowViewsDropdown(false)} />
              <div className="absolute top-full mt-1 right-0 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {/* Presets */}
                <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">Presets</div>
                {PRESET_VIEWS.map(view => (
                  <button
                    key={view.id}
                    onClick={() => handleLoadView(view)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    {view.name}
                  </button>
                ))}

                {/* Saved */}
                {savedViews.length > 0 && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">Saved</div>
                    {savedViews.map(view => (
                      <div key={view.id} className="flex items-center px-3 py-2 hover:bg-gray-50 group">
                        <button
                          onClick={() => handleLoadView(view)}
                          className="flex-1 text-left text-sm text-gray-700"
                        >
                          {view.name}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                          className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* Save current */}
                <div className="border-t border-gray-100 my-1" />
                {showSaveInput ? (
                  <div className="px-3 py-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={savingViewName}
                      onChange={(e) => setSavingViewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveView();
                        if (e.key === 'Escape') setShowSaveInput(false);
                      }}
                      placeholder="View name..."
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveView}
                      disabled={!savingViewName.trim()}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Save current view
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setMyTasksOnly(false);
              setShowDone(true);
              setDueDateFilter('all');
              setPriorityOnly(false);
              setShowArchived(false);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear filters
          </button>
        )}

        {/* Show archived link */}
        {staleCount > 0 && !showArchived && (
          <button
            onClick={() => setShowArchived(true)}
            className="text-xs text-gray-500 hover:text-blue-600 hover:underline ml-2"
          >
            Show {staleCount} archived
          </button>
        )}

        {/* Keyboard shortcuts help */}
        <button
          onClick={() => setShowHelp(true)}
          className="hidden md:inline-flex items-center justify-center w-7 h-7 text-xs font-mono text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      </div>

      {/* Filter Bar — Mobile: horizontal scrolling pills */}
      <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {/* @Me pill */}
        <button
          onClick={() => setMyTasksOnly(!myTasksOnly)}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            myTasksOnly
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          <UserCircle className="w-3.5 h-3.5" />
          @Me
        </button>

        {/* Status pills */}
        {statusOptions.filter(s => s.value !== 'done').map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value as TodoItemStatus)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === s.value
                ? `${s.bg} ${s.text} border-current`
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            {s.label}
          </button>
        ))}

        {/* Hide done pill */}
        <button
          onClick={() => setShowDone(!showDone)}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            !showDone
              ? 'bg-gray-200 border-gray-400 text-gray-700'
              : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          {showDone ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Done
        </button>

        {/* Overdue pill */}
        <button
          onClick={() => setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')}
          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            dueDateFilter === 'overdue'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          Overdue
        </button>

        {/* Priority pill */}
        <button
          onClick={() => setPriorityOnly(!priorityOnly)}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            priorityOnly
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Priority
        </button>

        {/* Search pill — opens search input */}
        <div className="flex-shrink-0 relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-24 focus:w-40 transition-all pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        </div>

        {/* Clear all — only when filters active */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setMyTasksOnly(false);
              setShowDone(true);
              setDueDateFilter('all');
              setPriorityOnly(false);
              setShowArchived(false);
            }}
            className="flex-shrink-0 px-2 py-1.5 text-xs text-red-500 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Active filter count banner */}
      {hasActiveFilters && (
        <div className="mb-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center justify-between">
          <span>
            Showing {filteredItems.length} of {(items || []).length} tasks
            {myTasksOnly ? ' (assigned to you)' : ''}
            {statusFilter !== 'all' ? ` · ${statusOptions.find(s => s.value === statusFilter)?.label}` : ''}
          </span>
        </div>
      )}

      {/* Sections + Tasks */}
      <div className="space-y-4">
        {(!sections || sections.length === 0) ? (
          <EmptyState message="No sections yet. Add a section to get started." />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {sections.map(section => (
                  <SortableSectionBlock
                    key={section.id}
                    section={section}
                    sectionItems={itemsBySection[section.id] || []}
                    isCollapsed={collapsedSections.has(section.id)}
                    listId={listId}
                    allSections={sections}
                    lastComments={lastComments}
                    addingTaskInSection={addingTaskInSection}
                    sensors={sensors}
                    onToggleSection={toggleSection}
                    onDragEnd={handleItemDragEnd}
                    onStatusChange={handleStatusChange}
                    onUpdateField={handleUpdateField}
                    onDeleteTask={handleDeleteTask}
                    onDeleteSection={handleDeleteSection}
                    onSetAddingTask={setAddingTaskInSection}
                    onOpenTask={(itemId) => {
                      setTaskViewed(itemId);
                      setSelectedTaskId(itemId);
                    }}
                    onOpenCommentPopup={(taskId, taskTitle, position) => {
                      setCommentPopup({ taskId, taskTitle, position });
                    }}
                    updateSection={updateSection}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add Section — always visible */}
        {showAddSection ? (
          <div className="flex items-center gap-2 p-3 border border-dashed border-gray-300 rounded-lg">
            <input
              type="text"
              value={addingSectionTitle}
              onChange={(e) => setAddingSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSection();
                if (e.key === 'Escape') { setShowAddSection(false); setAddingSectionTitle(''); }
              }}
              placeholder="Section title..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAddSection}
              disabled={createSection.isPending}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddSection(false); setAddingSectionTitle(''); }}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddSection(true)}
            className="w-full px-4 py-3 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          listId={listId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Comment Popup */}
      {/* Keyboard Shortcuts Help */}
      {showHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />
      )}

      {commentPopup && (
        <InlineCommentPopup
          taskId={commentPopup.taskId}
          taskTitle={commentPopup.taskTitle}
          lastComment={lastComments?.[commentPopup.taskId] || null}
          onClose={() => setCommentPopup(null)}
          position={commentPopup.position}
        />
      )}
    </div>
  );
}

// Sortable wrapper for SectionBlock
function SortableSectionBlock(props: SectionBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <SectionBlock {...props} dragListeners={listeners} />
    </div>
  );
}

// Props type shared between SortableSectionBlock and SectionBlock
interface SectionBlockProps {
  section: TodoSection;
  sectionItems: TodoItem[];
  isCollapsed: boolean;
  listId: string;
  allSections: TodoSection[];
  lastComments: Record<string, any> | undefined;
  addingTaskInSection: string | null;
  sensors: ReturnType<typeof useSensors>;
  onToggleSection: (sectionId: string) => void;
  onDragEnd: (event: DragEndEvent, sectionId: string) => void;
  onStatusChange: (taskId: string, status: string) => Promise<void>;
  onUpdateField: (params: { id: string; field: string; value: any }) => Promise<any>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteSection: (sectionId: string, title: string) => Promise<void>;
  onSetAddingTask: Dispatch<SetStateAction<string | null>>;
  onOpenTask: (itemId: string) => void;
  onOpenCommentPopup: (taskId: string, taskTitle: string, position: { top: number; left: number }) => void;
  updateSection: ReturnType<typeof useUpdateTodoSection>;
  dragListeners?: Record<string, any>;
}

// Extracted section component to avoid useState in .map()
function SectionBlock({
  section,
  sectionItems,
  isCollapsed,
  listId,
  allSections,
  lastComments,
  addingTaskInSection,
  sensors,
  onToggleSection,
  onDragEnd,
  onStatusChange,
  onUpdateField,
  onDeleteTask,
  onDeleteSection,
  onSetAddingTask,
  onOpenTask,
  onOpenCommentPopup,
  updateSection,
  dragListeners,
}: SectionBlockProps) {
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const sectionColor = getSectionColor(section.color);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      {/* Section Header */}
      <div
        className={`${sectionColor.bg} px-4 py-3 flex items-center gap-3 cursor-pointer`}
        onClick={() => onToggleSection(section.id)}
      >
        {/* Drag handle for section reorder */}
        <div
          className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white/90 -ml-1"
          onClick={(e) => e.stopPropagation()}
          {...dragListeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-white/80" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/80" />
        )}

        {editingSectionName !== null ? (
          <input
            type="text"
            value={editingSectionName}
            onChange={(e) => setEditingSectionName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={async () => {
              if (editingSectionName.trim() && editingSectionName !== section.title) {
                await updateSection.mutateAsync({ id: section.id, listId, title: editingSectionName.trim() });
              }
              setEditingSectionName(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingSectionName(null);
            }}
            className="bg-white/20 text-white placeholder-white/60 px-2 py-0.5 rounded text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50"
            autoFocus
          />
        ) : (
          <span className="text-white font-semibold text-sm flex-1">
            {section.title}
            <span className="ml-2 text-white/70 font-normal">({sectionItems.length})</span>
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <SectionColorPicker
            sectionId={section.id}
            listId={listId}
            currentColor={section.color}
          />
          <button
            onClick={() => setEditingSectionName(section.title)}
            className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
            title="Rename section"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteSection(section.id, section.title)}
            className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Items */}
      {!isCollapsed && (
        <div className="bg-white">
          {sectionItems.length > 0 ? (
            <>
              {/* Desktop: Table layout */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                      <th className="px-4 py-2 text-left font-medium">Task</th>
                      <th className="px-4 py-2 text-left font-medium w-24">Assigned</th>
                      <th className="px-4 py-2 text-left font-medium w-28">Status</th>
                      <th className="px-4 py-2 text-left font-medium w-24">Due</th>
                      <th className="px-4 py-2 text-left font-medium w-40">Comment</th>
                      <th className="px-4 py-2 text-center font-medium w-20">Actions</th>
                    </tr>
                  </thead>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => onDragEnd(e, section.id)}
                  >
                    <SortableContext
                      items={sectionItems.map(i => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody>
                        {sectionItems.map((item, idx) => (
                          <SortableTaskRow
                            key={item.id}
                            task={item}
                            idx={idx}
                            listId={listId}
                            sections={allSections}
                            lastComment={lastComments?.[item.id] || null}
                            onOpenTask={() => onOpenTask(item.id)}
                            onOpenCommentPopup={onOpenCommentPopup}
                            onStatusChange={onStatusChange}
                            onUpdateField={onUpdateField}
                            onDeleteTask={onDeleteTask}
                          />
                        ))}
                      </tbody>
                    </SortableContext>
                  </DndContext>
                </table>
              </div>

              {/* Mobile: Card layout */}
              <div className="md:hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => onDragEnd(e, section.id)}
                >
                  <SortableContext
                    items={sectionItems.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y divide-gray-100">
                      {sectionItems.map((item, idx) => (
                        <MobileTaskCard
                          key={item.id}
                          task={item}
                          idx={idx}
                          listId={listId}
                          sections={allSections}
                          lastComment={lastComments?.[item.id] || null}
                          onOpenTask={() => onOpenTask(item.id)}
                          onOpenCommentPopup={onOpenCommentPopup}
                          onStatusChange={onStatusChange}
                          onUpdateField={onUpdateField}
                          onDeleteTask={onDeleteTask}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </>
          ) : null}

          {/* Quick Add Task */}
          {addingTaskInSection === section.id ? (
            <>
              {/* Desktop quick-add */}
              <div className="hidden md:block">
                <table className="w-full">
                  <tbody>
                    <QuickAddTask
                      sectionId={section.id}
                      listId={listId}
                      onCancel={() => onSetAddingTask(null)}
                      onSuccess={() => onSetAddingTask(null)}
                    />
                  </tbody>
                </table>
              </div>
              {/* Mobile quick-add */}
              <div className="md:hidden">
                <MobileQuickAddTask
                  sectionId={section.id}
                  listId={listId}
                  onCancel={() => onSetAddingTask(null)}
                  onSuccess={() => onSetAddingTask(null)}
                />
              </div>
            </>
          ) : (
            <button
              onClick={() => onSetAddingTask(section.id)}
              className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
