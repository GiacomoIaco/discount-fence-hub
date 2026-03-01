import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Loader2, Calendar, Check } from 'lucide-react';
import { useMyWorkQuery, setTaskViewed } from '../hooks/useMyTodos';
import TaskDetailModal from './TaskDetailModal';
import { EmptyState } from './InlineEditors';
import { formatDate, isOverdue, statusOptions, getSectionColor, getAvatarColor } from '../utils/todoHelpers';
import { getInitials } from '../../../lib/stringUtils';
import type { TodoItem } from '../types';

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done' | 'blocked';
type SortOption = 'updated' | 'due-date' | 'created';

export default function MyWorkView() {
  const { data: items, isLoading } = useMyWorkQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('updated');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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
  }, [items, statusFilter, showCompleted, searchQuery, sortOption]);

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

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="updated">Recently Updated</option>
          <option value="due-date">Due Date</option>
          <option value="created">Recently Created</option>
        </select>

        {/* Show Completed */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show completed
        </label>
      </div>

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

function MyWorkItem({ item, onOpen }: { item: TodoItem; onOpen: () => void }) {
  const overdue = isOverdue(item);
  const statusInfo = statusOptions.find(s => s.value === item.status) || statusOptions[0];

  return (
    <div
      className={`cursor-pointer transition-colors active:bg-gray-50 hover:bg-blue-50 ${
        overdue ? 'bg-red-50' : ''
      }`}
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
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${
            item.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
          }`}>
            {item.title}
          </span>
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
