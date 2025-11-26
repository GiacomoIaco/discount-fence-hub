import { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, User, Users, Send, ChevronDown, ChevronRight, Search, X, Trash2, Edit3, Check, Loader2, Plus } from 'lucide-react';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus, useUpdateTaskField, useDeleteTask, useCreateTask, useCreatePersonalInitiative, type TaskWithDetails } from '../hooks/useMyTodos';
import { useAuth } from '../../../contexts/AuthContext';

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

// Generate consistent color from user ID
const getAvatarColor = (userId: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
  ];
  const hash = userId.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
  return colors[hash % colors.length];
};

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if task is overdue
function isOverdue(task: TaskWithDetails): boolean {
  if (!task.due_date) return false;
  if (task.status === 'done') return false;
  return new Date(task.due_date) < new Date();
}

// Status options for tasks
const statusOptions = [
  { value: 'todo', label: 'To Do', bg: 'bg-gray-100', text: 'text-gray-700' },
  { value: 'in_progress', label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  { value: 'done', label: 'Done', bg: 'bg-green-100', text: 'text-green-700' },
  { value: 'blocked', label: 'Blocked', bg: 'bg-red-100', text: 'text-red-700' },
];

// Inline editable text component
function InlineEditableText({
  value,
  onSave,
  placeholder = 'Click to add...',
  className = '',
}: {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue !== (value || '')) {
      setIsSaving(true);
      try {
        await onSave(editValue);
      } catch (err) {
        console.error('Failed to save:', err);
        setEditValue(value || '');
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setEditValue(value || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
          disabled={isSaving}
        />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`group cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-1 transition-colors ${className}`}
    >
      {value ? (
        <span className="text-sm text-gray-700">{value}</span>
      ) : (
        <span className="text-sm text-gray-400 italic">{placeholder}</span>
      )}
      <Edit3 className="w-3 h-3 text-gray-400 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Inline date picker component
function InlineDatePicker({
  value,
  onSave,
  isOverdue = false,
}: {
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
  isOverdue?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [isEditing]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value || null;
    setIsSaving(true);
    try {
      await onSave(newValue);
    } catch (err) {
      console.error('Failed to save date:', err);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="date"
          defaultValue={value || ''}
          onChange={handleChange}
          onBlur={() => setIsEditing(false)}
          className="px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={isSaving}
        />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`group cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-1 transition-colors ${
        isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'
      }`}
    >
      {value ? (
        <span className="text-sm">{formatDate(value)}</span>
      ) : (
        <span className="text-sm text-gray-400">-</span>
      )}
      <Edit3 className="w-3 h-3 text-gray-400 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Inline status dropdown component
function InlineStatusDropdown({
  status,
  onSave,
}: {
  status: string;
  onSave: (status: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentOption = statusOptions.find(o => o.value === status) || statusOptions[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Check if dropdown should open upward
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 160; // Approximate height of dropdown
      setOpenUpward(spaceBelow < dropdownHeight);
    }
  }, [isOpen]);

  const handleSelect = async (value: string) => {
    if (value !== status) {
      setIsSaving(true);
      try {
        await onSave(value);
      } catch (err) {
        console.error('Failed to save status:', err);
      } finally {
        setIsSaving(false);
      }
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={isSaving}
        className={`px-2 py-1 text-xs font-medium rounded-full ${currentOption.bg} ${currentOption.text} hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        {isSaving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {currentOption.label}
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
      {isOpen && (
        <div className={`absolute z-50 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 ${
          openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option.value);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                option.value === status ? 'bg-gray-50' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${option.bg.replace('100', '500')}`} />
              {option.label}
              {option.value === status && <Check className="w-3 h-3 ml-auto text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Assignees display component
function AssigneesDisplay({ task }: { task: TaskWithDetails }) {
  // Use assignees array if available, otherwise fall back to assigned_user
  const assignees = task.assignees?.length
    ? task.assignees
    : task.assigned_user
      ? [{ user_id: task.assigned_user.id, user: task.assigned_user }]
      : [];

  if (assignees.length === 0) {
    return (
      <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
        <User className="w-3 h-3 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex -space-x-2">
      {assignees.slice(0, 3).map((assignee, idx) => (
        <div
          key={assignee.user_id || idx}
          className={`w-7 h-7 rounded-full ${getAvatarColor(assignee.user_id || '')} text-white text-xs font-medium flex items-center justify-center ring-2 ring-white`}
          title={assignee.user?.full_name || 'Unknown'}
        >
          {assignee.user?.avatar_url ? (
            <img
              src={assignee.user.avatar_url}
              alt={assignee.user.full_name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(assignee.user?.full_name || 'U')
          )}
        </div>
      ))}
      {assignees.length > 3 && (
        <div className="w-7 h-7 rounded-full bg-gray-400 text-white text-xs font-medium flex items-center justify-center ring-2 ring-white">
          +{assignees.length - 3}
        </div>
      )}
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

// Quick add task row component
function QuickAddTask({
  initiativeId,
  onCancel,
  onSuccess,
}: {
  initiativeId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const createTask = useCreateTask();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      onCancel();
      return;
    }
    try {
      await createTask.mutateAsync({
        initiative_id: initiativeId,
        title: title.trim(),
        assignees: user ? [user.id] : [], // Auto-assign to self
      });
      setTitle('');
      onSuccess();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td className="px-4 py-2" colSpan={6}>
        <div className="flex items-center gap-3 pl-6">
          <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onCancel();
            }}
            onBlur={() => {
              if (!title.trim()) onCancel();
            }}
            placeholder="Enter task title and press Enter..."
            className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={createTask.isPending}
          />
          {createTask.isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          <button
            onClick={handleSubmit}
            disabled={createTask.isPending || !title.trim()}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// New initiative modal
function NewInitiativeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const createInitiative = useCreatePersonalInitiative();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await createInitiative.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create initiative:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Personal Initiative</h2>
          <p className="text-sm text-gray-500 mt-1">Create an initiative for your personal to-dos</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q4 Personal Goals"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInitiative.isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {createInitiative.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Initiative
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MyTodos({ onBack }: MyTodosProps) {
  const [activeTab, setActiveTab] = useState<TabId>('assigned-to-me');
  const [collapsedInitiatives, setCollapsedInitiatives] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingTaskToInitiative, setAddingTaskToInitiative] = useState<string | null>(null);
  const [showNewInitiativeModal, setShowNewInitiativeModal] = useState(false);

  const { data, isLoading, error, refetch } = useMyTodosQuery();
  const stats = useMyTodosStats();
  const updateStatus = useUpdateTaskStatus();
  const updateField = useUpdateTaskField();
  const deleteTask = useDeleteTask();

  const handleStatusChange = async (taskId: string, status: string) => {
    await updateStatus.mutateAsync({ id: taskId, status });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    await deleteTask.mutateAsync(taskId);
  };

  const toggleInitiativeCollapse = (initiativeId: string) => {
    setCollapsedInitiatives(prev => {
      const next = new Set(prev);
      if (next.has(initiativeId)) {
        next.delete(initiativeId);
      } else {
        next.add(initiativeId);
      }
      return next;
    });
  };

  const tabs = [
    { id: 'assigned-to-me' as TabId, label: 'Assigned to Me', icon: User, count: stats.totalAssigned },
    { id: 'created-by-me' as TabId, label: 'Created by Me', icon: Users, count: stats.totalCreated },
    { id: 'assigned-by-me' as TabId, label: 'Assigned to Others', icon: Send, count: stats.totalAssignedByMe },
  ];

  // Get tasks for current tab
  const getCurrentTasks = (): TaskWithDetails[] => {
    if (!data) return [];
    switch (activeTab) {
      case 'assigned-to-me': return data.assignedToMe;
      case 'created-by-me': return data.createdByMe;
      case 'assigned-by-me': return data.assignedByMe;
      default: return [];
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
        t.initiative?.title?.toLowerCase().includes(query)
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

    return tasks;
  }, [data, activeTab, searchQuery, filterStatus, showCompleted]);

  // Group tasks by initiative
  const tasksByInitiative = useMemo(() => {
    const grouped = new Map<string, {
      initiativeId: string;
      initiativeTitle: string;
      functionName: string;
      areaName: string;
      tasks: TaskWithDetails[];
    }>();

    filteredTasks.forEach(task => {
      const initiativeId = task.initiative_id || 'no-initiative';
      const initiativeTitle = task.initiative?.title || 'No Initiative';
      const areaName = task.initiative?.area?.name || '';
      const functionName = task.initiative?.area?.function?.name || 'Uncategorized';

      if (!grouped.has(initiativeId)) {
        grouped.set(initiativeId, {
          initiativeId,
          initiativeTitle,
          functionName,
          areaName,
          tasks: [],
        });
      }
      grouped.get(initiativeId)!.tasks.push(task);
    });

    // Sort by function name then initiative title
    return Array.from(grouped.values()).sort((a, b) => {
      const funcCompare = a.functionName.localeCompare(b.functionName);
      if (funcCompare !== 0) return funcCompare;
      return a.initiativeTitle.localeCompare(b.initiativeTitle);
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
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
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
                    Task
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasksByInitiative.map(({ initiativeId, initiativeTitle, functionName, areaName, tasks }) => {
                  const isCollapsed = collapsedInitiatives.has(initiativeId);

                  return (
                    <>
                      {/* Initiative Header Row (like Area header in Initiatives tab) */}
                      <tr
                        key={`initiative-${initiativeId}`}
                        className="bg-blue-900 border-t-2 border-blue-700 cursor-pointer hover:bg-blue-800 transition-colors"
                        onClick={() => toggleInitiativeCollapse(initiativeId)}
                      >
                        <td colSpan={6} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-white" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-white" />
                              )}
                              <span className="font-semibold text-white">{initiativeTitle}</span>
                              {areaName && (
                                <>
                                  <span className="text-blue-300">•</span>
                                  <span className="text-blue-200 text-sm">{functionName} / {areaName}</span>
                                </>
                              )}
                              <span className="text-sm text-blue-200 ml-2">
                                ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingTaskToInitiative(initiativeId);
                                if (isCollapsed) {
                                  toggleInitiativeCollapse(initiativeId);
                                }
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-100 hover:text-white hover:bg-blue-700 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Add Task
                            </button>
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

                      {/* Task Rows */}
                      {!isCollapsed && tasks.map((task, idx) => {
                        const taskOverdue = isOverdue(task);

                        return (
                          <tr
                            key={task.id}
                            className={`border-b border-gray-200 hover:bg-gray-50 transition-colors group ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                            } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''}`}
                          >
                            {/* Task Title with checkbox indicator */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 pl-6">
                                {/* Status circle */}
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 cursor-pointer transition-colors ${
                                    task.status === 'done'
                                      ? 'bg-green-500 border-green-500'
                                      : task.status === 'in_progress'
                                      ? 'bg-blue-500 border-blue-500'
                                      : task.status === 'blocked'
                                      ? 'bg-red-500 border-red-500'
                                      : 'border-gray-400 hover:border-green-500'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (task.status !== 'done') {
                                      handleStatusChange(task.id, 'done');
                                    }
                                  }}
                                  title={task.status === 'done' ? 'Completed' : 'Click to complete'}
                                >
                                  {task.status === 'done' && (
                                    <Check className="w-3 h-3 text-white m-auto" />
                                  )}
                                </div>

                                <InlineEditableText
                                  value={task.title}
                                  onSave={async (value) => {
                                    await updateField.mutateAsync({ id: task.id, field: 'title', value });
                                  }}
                                  placeholder="Enter task..."
                                  className={task.status === 'done' ? 'line-through text-gray-500' : 'font-medium'}
                                />
                              </div>
                            </td>

                            {/* Assignees */}
                            <td className="px-4 py-3">
                              <AssigneesDisplay task={task} />
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <InlineStatusDropdown
                                status={task.status}
                                onSave={async (value) => {
                                  await handleStatusChange(task.id, value);
                                }}
                              />
                            </td>

                            {/* Due Date */}
                            <td className="px-4 py-3">
                              <InlineDatePicker
                                value={task.due_date}
                                onSave={async (value) => {
                                  await updateField.mutateAsync({ id: task.id, field: 'due_date', value });
                                }}
                                isOverdue={taskOverdue}
                              />
                            </td>

                            {/* Notes */}
                            <td className="px-4 py-3">
                              <InlineEditableText
                                value={task.notes || task.description}
                                onSave={async (value) => {
                                  await updateField.mutateAsync({ id: task.id, field: 'notes', value });
                                }}
                                placeholder="Add notes..."
                              />
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
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

      {/* New Initiative Modal */}
      {showNewInitiativeModal && (
        <NewInitiativeModal
          onClose={() => setShowNewInitiativeModal(false)}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
