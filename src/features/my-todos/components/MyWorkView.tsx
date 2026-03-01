import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Loader2, Calendar, Check, Bookmark, X, Plus, ListChecks, Eye, EyeOff } from 'lucide-react';
import { useMyWorkQuery, setTaskViewed } from '../hooks/useMyTodos';
import { useChecklistProgressQuery } from '../hooks/useTodoChecklist';
import TaskDetailModal from './TaskDetailModal';
import { EmptyState } from './InlineEditors';
import { formatDate, isOverdue, statusOptions, getSectionColor, getAvatarColor } from '../utils/todoHelpers';
import { getInitials } from '../../../lib/stringUtils';
import type { TodoItem } from '../types';

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done' | 'blocked';
type SortOption = 'updated' | 'due-date' | 'created';

// Auto-hide tasks completed more than 7 days ago
function isStaleCompleted(task: TodoItem): boolean {
  if (task.status !== 'done' || !task.completed_at) return false;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(task.completed_at) < sevenDaysAgo;
}

// === Saved Views ===

interface MyWorkSavedView {
  id: string;
  name: string;
  filters: {
    searchQuery: string;
    statusFilter: string;
    showCompleted: boolean;
    dueDateFilter: string;
    priorityOnly: boolean;
  };
}

const MY_WORK_SAVED_VIEWS_KEY = 'mywork-saved-views';

function getMyWorkSavedViews(): MyWorkSavedView[] {
  try {
    const stored = localStorage.getItem(MY_WORK_SAVED_VIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMyWorkSavedViews(views: MyWorkSavedView[]) {
  localStorage.setItem(MY_WORK_SAVED_VIEWS_KEY, JSON.stringify(views));
}

const MY_WORK_PRESETS: MyWorkSavedView[] = [
  {
    id: 'preset-overdue',
    name: 'My Overdue',
    filters: { searchQuery: '', statusFilter: 'all', showCompleted: false, dueDateFilter: 'overdue', priorityOnly: false },
  },
  {
    id: 'preset-today',
    name: 'Due Today',
    filters: { searchQuery: '', statusFilter: 'all', showCompleted: false, dueDateFilter: 'today', priorityOnly: false },
  },
  {
    id: 'preset-priority',
    name: 'High Priority',
    filters: { searchQuery: '', statusFilter: 'all', showCompleted: false, dueDateFilter: 'all', priorityOnly: true },
  },
];

export default function MyWorkView() {
  const { data: items, isLoading } = useMyWorkQuery();

  // Fetch checklist progress for all items
  const allItemIds = useMemo(() => (items || []).map(i => i.id), [items]);
  const { data: checklistProgressMap } = useChecklistProgressQuery(allItemIds);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('updated');
  const [showCompleted, setShowCompleted] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'overdue' | 'today' | 'this_week'>('all');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Saved views state
  const [savedViews, setSavedViews] = useState<MyWorkSavedView[]>(getMyWorkSavedViews);
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const [savingViewName, setSavingViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handleSaveView = () => {
    if (!savingViewName.trim()) return;
    const newView: MyWorkSavedView = {
      id: `custom-${Date.now()}`,
      name: savingViewName.trim(),
      filters: {
        searchQuery,
        statusFilter: statusFilter as string,
        showCompleted,
        dueDateFilter,
        priorityOnly,
      },
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    saveMyWorkSavedViews(updated);
    setSavingViewName('');
    setShowSaveInput(false);
  };

  const handleLoadView = (view: MyWorkSavedView) => {
    setSearchQuery(view.filters.searchQuery);
    setStatusFilter(view.filters.statusFilter as any);
    setShowCompleted(view.filters.showCompleted);
    setDueDateFilter(view.filters.dueDateFilter as any);
    setPriorityOnly(view.filters.priorityOnly);
    setShowViewsDropdown(false);
  };

  const handleDeleteView = (viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updated);
    saveMyWorkSavedViews(updated);
  };

  // Filter & sort
  const filteredItems = useMemo(() => {
    let result = items || [];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }

    // Hide completed
    if (!showCompleted) {
      result = result.filter(i => i.status !== 'done');
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q) ||
        i.list?.title.toLowerCase().includes(q)
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

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'due-date': {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: // updated
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [items, statusFilter, showCompleted, searchQuery, sortOption, dueDateFilter, priorityOnly, showArchived]);

  // Group by list > section
  const groupedItems = useMemo(() => {
    const groups: { key: string; listTitle: string; sectionTitle: string; sectionColor: string; listId: string; items: TodoItem[] }[] = [];
    const groupMap = new Map<string, typeof groups[0]>();

    filteredItems.forEach(item => {
      const key = `${item.list_id}:${item.section_id}`;
      if (!groupMap.has(key)) {
        const group = {
          key,
          listTitle: item.list?.title || 'Unknown List',
          sectionTitle: item.section?.title || 'Unknown Section',
          sectionColor: item.section?.color || 'blue-900',
          listId: item.list_id,
          items: [],
        };
        groupMap.set(key, group);
        groups.push(group);
      }
      groupMap.get(key)!.items.push(item);
    });

    return groups;
  }, [filteredItems]);

  // Count stale completed items for "Show archived" link
  const staleCount = useMemo(() => (items || []).filter(isStaleCompleted).length, [items]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || showCompleted || dueDateFilter !== 'all' || priorityOnly || showArchived;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setShowCompleted(false);
    setDueDateFilter('all');
    setPriorityOnly(false);
    setShowArchived(false);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Work</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tasks assigned to you, created by you, or that you follow
        </p>
      </div>

      {/* Filter Bar — Desktop */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
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
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {statusOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="updated">Recently Updated</option>
          <option value="due-date">Due Date</option>
          <option value="created">Recently Created</option>
        </select>

        {/* Show done toggle */}
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            showCompleted
              ? 'bg-gray-100 border-gray-300 text-gray-700 font-medium'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showCompleted ? 'Done visible' : 'Done hidden'}
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

        {/* This Week pill */}
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

        {/* Priority pill */}
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
                {MY_WORK_PRESETS.map(view => (
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
            onClick={clearAllFilters}
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
      </div>

      {/* Filter Bar — Mobile: horizontal scrolling pills */}
      <div className="md:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {/* Status pills */}
        {statusOptions.filter(s => s.value !== 'done').map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value as StatusFilter)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === s.value
                ? `${s.bg} ${s.text} border-current`
                : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            {s.label}
          </button>
        ))}

        {/* Show done pill */}
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            showCompleted
              ? 'bg-gray-200 border-gray-400 text-gray-700'
              : 'bg-white border-gray-300 text-gray-600'
          }`}
        >
          {showCompleted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
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

        {/* Search pill */}
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

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex-shrink-0 px-2 py-1.5 text-xs text-red-500 font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* Active filter count banner — mobile only */}
      {hasActiveFilters && (
        <div className="md:hidden mb-3 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center justify-between">
          <span>
            Showing {filteredItems.length} of {(items || []).length} tasks
            {statusFilter !== 'all' ? ` · ${statusOptions.find(s => s.value === statusFilter)?.label}` : ''}
          </span>
        </div>
      )}

      {/* Results */}
      {filteredItems.length === 0 ? (
        <EmptyState message={searchQuery ? "No tasks match your search" : "You're all caught up!"} />
      ) : (
        <div className="space-y-4">
          {groupedItems.map(group => {
            const isCollapsed = collapsedGroups.has(group.key);
            const sectionColor = getSectionColor(group.sectionColor);

            return (
              <div key={group.key} className="rounded-lg overflow-hidden border border-gray-200">
                {/* Group Header */}
                <div
                  className={`${sectionColor.bg} px-4 py-2.5 flex items-center gap-2 cursor-pointer`}
                  onClick={() => toggleGroup(group.key)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-white/80" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/80" />
                  )}
                  <span className="text-white/70 text-xs font-medium">{group.listTitle}</span>
                  <span className="text-white/50">/</span>
                  <span className="text-white font-semibold text-sm">{group.sectionTitle}</span>
                  <span className="text-white/70 text-xs ml-1">({group.items.length})</span>
                </div>

                {/* Items */}
                {!isCollapsed && (
                  <div className="bg-white divide-y divide-gray-100">
                    {group.items.map(item => (
                      <MyWorkItem
                        key={item.id}
                        item={item}
                        checklistProgress={checklistProgressMap?.[item.id] || null}
                        onOpen={() => {
                          setTaskViewed(item.id);
                          setSelectedTaskId(item.id);
                          setSelectedTaskListId(item.list_id);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && selectedTaskListId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          listId={selectedTaskListId}
          onClose={() => { setSelectedTaskId(null); setSelectedTaskListId(null); }}
        />
      )}
    </div>
  );
}

// ============================================
// Responsive item: mobile card + desktop row
// ============================================

const statusBorderColor: Record<string, string> = {
  todo: 'border-l-gray-300',
  in_progress: 'border-l-blue-500',
  done: 'border-l-green-500',
  blocked: 'border-l-red-500',
};

function MyWorkItem({ item, checklistProgress, onOpen }: { item: TodoItem; checklistProgress?: { total: number; completed: number } | null; onOpen: () => void }) {
  const overdue = isOverdue(item);
  const statusInfo = statusOptions.find(s => s.value === item.status) || statusOptions[0];

  return (
    <div
      className={`cursor-pointer transition-colors active:bg-gray-50 hover:bg-blue-50 ${
        overdue ? 'bg-red-50' : ''
      } ${item.status === 'done' ? 'opacity-50' : ''}`}
      onClick={onOpen}
    >
      {/* Mobile card (<md) */}
      <div className={`md:hidden border-l-4 ${statusBorderColor[item.status] || 'border-l-gray-300'} py-3 px-4`}>
        {/* Row 1: status circle + title + priority */}
        <div className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              item.status === 'done'
                ? 'bg-green-500 border-green-500'
                : item.status === 'in_progress'
                ? 'bg-blue-500 border-blue-500'
                : item.status === 'blocked'
                ? 'bg-red-500 border-red-500'
                : 'border-gray-400'
            }`}
          >
            {item.status === 'done' && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className={`flex-1 text-sm leading-snug truncate ${
            item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 font-medium'
          }`}>
            {item.title}
          </span>
          {item.is_high_priority && (
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
          )}
        </div>

        {/* Row 2: assignee + status badge + due date */}
        <div className="flex items-center gap-2 mt-2 ml-7 flex-wrap">
          {item.assigned_user && (
            <div
              className={`w-6 h-6 rounded-full ${getAvatarColor(item.assigned_user.id)} text-white text-[10px] font-medium flex items-center justify-center flex-shrink-0`}
              title={item.assigned_user.full_name}
            >
              {item.assigned_user.avatar_url ? (
                <img src={item.assigned_user.avatar_url} alt={item.assigned_user.full_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(item.assigned_user.full_name)
              )}
            </div>
          )}
          <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${statusInfo.bg} ${statusInfo.text} flex-shrink-0`}>
            {statusInfo.label}
          </span>
          {item.due_date && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full flex-shrink-0 ${
              overdue ? 'bg-red-100 text-red-700 font-medium' : 'bg-gray-100 text-gray-600'
            }`}>
              <Calendar className="w-3 h-3" />
              {formatDate(item.due_date)}
            </span>
          )}
          {/* Checklist progress pill */}
          {checklistProgress && checklistProgress.total > 0 && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full flex-shrink-0 ${
              checklistProgress.completed === checklistProgress.total
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              <ListChecks className="w-3 h-3" />
              {checklistProgress.completed}/{checklistProgress.total}
            </span>
          )}
        </div>
      </div>

      {/* Desktop row (>=md) */}
      <div className={`hidden md:flex items-center gap-4 px-4 py-3 ${
        overdue ? 'border-l-4 border-l-red-400' : ''
      }`}>
        <div
          className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
            item.status === 'done'
              ? 'bg-green-500 border-green-500'
              : item.status === 'in_progress'
              ? 'bg-blue-500 border-blue-500'
              : item.status === 'blocked'
              ? 'bg-red-500 border-red-500'
              : 'border-gray-400'
          }`}
        />
        {item.is_high_priority && (
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="High Priority" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm font-medium ${
            item.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
          }`}>
            {item.title}
          </span>
          {/* Checklist progress */}
          {checklistProgress && checklistProgress.total > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0" title={`${checklistProgress.completed} of ${checklistProgress.total} subtasks completed`}>
              <ListChecks className="w-3.5 h-3.5 text-gray-400" />
              <span className={`text-xs font-medium ${checklistProgress.completed === checklistProgress.total ? 'text-green-600' : 'text-gray-500'}`}>
                {checklistProgress.completed}/{checklistProgress.total}
              </span>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${checklistProgress.completed === checklistProgress.total ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.round((checklistProgress.completed / checklistProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
          {statusInfo.label}
        </span>
        <span className={`text-xs w-16 text-right ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {formatDate(item.due_date)}
        </span>
        {item.assigned_user && (
          <div
            className={`w-6 h-6 rounded-full ${getAvatarColor(item.assigned_user.id)} text-white text-xs flex items-center justify-center flex-shrink-0`}
            title={item.assigned_user.full_name}
          >
            {item.assigned_user.avatar_url ? (
              <img src={item.assigned_user.avatar_url} alt={item.assigned_user.full_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(item.assigned_user.full_name)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
