import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle, User, Building2, ChevronDown, ChevronRight, Search, X, Trash2, Edit3, Check, Loader2, Plus, Lock, MoreVertical, Archive, Pencil, Crown, UserCheck, Eye, UserPlus } from 'lucide-react';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus, useUpdateTaskField, useDeleteTask, useCreateTask, useCreatePersonalInitiative, usePersonalInitiativesQuery, useUpdatePersonalInitiative, useArchivePersonalInitiative, useAddTaskAssignee, useRemoveTaskAssignee, type TaskWithDetails } from '../hooks/useMyTodos';
import { useAuth } from '../../../contexts/AuthContext';
import { useUsers } from '../../requests/hooks/useRequests';
import TaskDetailModal from './TaskDetailModal';

interface MyTodosProps {
  onBack: () => void;
}

// Filter type for the single list view
type FilterId = 'all' | 'i-own' | 'assigned-to-me' | 'my-functions';

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

// Header color options for initiatives
const headerColorOptions = [
  { value: 'blue-900', label: 'Blue', bg: 'bg-blue-900', hover: 'hover:bg-blue-800' },
  { value: 'green-800', label: 'Green', bg: 'bg-green-800', hover: 'hover:bg-green-700' },
  { value: 'purple-800', label: 'Purple', bg: 'bg-purple-800', hover: 'hover:bg-purple-700' },
  { value: 'orange-700', label: 'Orange', bg: 'bg-orange-700', hover: 'hover:bg-orange-600' },
  { value: 'red-800', label: 'Red', bg: 'bg-red-800', hover: 'hover:bg-red-700' },
  { value: 'teal-800', label: 'Teal', bg: 'bg-teal-800', hover: 'hover:bg-teal-700' },
  { value: 'indigo-800', label: 'Indigo', bg: 'bg-indigo-800', hover: 'hover:bg-indigo-700' },
  { value: 'gray-700', label: 'Gray', bg: 'bg-gray-700', hover: 'hover:bg-gray-600' },
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

// Inline status dropdown component with portal for proper positioning
function InlineStatusDropdown({
  status,
  onSave,
}: {
  status: string;
  onSave: (status: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = statusOptions.find(o => o.value === status) || statusOptions[0];

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Calculate dropdown position when opening
  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 180; // Approximate height of dropdown
      const openUpward = spaceBelow < dropdownHeight;

      setDropdownPosition({
        top: openUpward ? rect.top - dropdownHeight : rect.bottom + 4,
        left: rect.left,
        openUpward,
      });
    }
    setIsOpen(!isOpen);
  };

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
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          toggleDropdown();
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
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}

// Inline owner picker component - click to change owner (only if user can edit)
function InlineOwnerPicker({ task }: { task: TaskWithDetails }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { users, loading: usersLoading } = useUsers();
  const updateField = useUpdateTaskField();

  // Allow editing if user is owner, creator, assignee, or has function access
  const canEdit = task.isOwner || task.isCreator || task.isAssignee || task.isInMyFunction;
  const owner = task.owner;

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!canEdit) return;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;
      const openUpward = spaceBelow < dropdownHeight;

      setPosition({
        top: openUpward ? rect.top - dropdownHeight : rect.bottom + 4,
        left: Math.max(8, rect.left - 100),
      });
    }
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  const handleSelectOwner = async (userId: string) => {
    try {
      await updateField.mutateAsync({ id: task.id, field: 'owner_id', value: userId });
      setIsOpen(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to update owner:', error);
      alert(`Failed to update owner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const ownerName = owner?.full_name || 'Unknown';

  return (
    <>
      <div
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          toggleDropdown();
        }}
        className={`flex items-center gap-1 ${canEdit ? 'cursor-pointer group' : 'cursor-help'}`}
      >
        {owner ? (
          <div
            className={`w-7 h-7 rounded-full ${getAvatarColor(owner.id)} text-white text-xs font-medium flex items-center justify-center`}
            title={ownerName}
          >
            {owner.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt={ownerName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(ownerName)
            )}
          </div>
        ) : (
          <div
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center"
            title="No owner - click to assign"
          >
            <Crown className="w-3 h-3 text-gray-400" />
          </div>
        )}
        {/* Edit indicator on hover */}
        {canEdit && (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100">
            <Pencil className="w-2.5 h-2.5 text-gray-500" />
          </div>
        )}
      </div>

      {/* Dropdown Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-700">Change Owner</span>
          </div>

          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* User List */}
          <div className="max-h-52 overflow-y-auto">
            {usersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                No users found
              </div>
            ) : (
              filteredUsers.map(user => {
                const isCurrentOwner = owner?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectOwner(user.id)}
                    disabled={updateField.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isCurrentOwner ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(user.id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isCurrentOwner && (
                      <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Inline assignee picker component - click to add/remove assignees
function InlineAssigneePicker({ task }: { task: TaskWithDetails }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { users, loading: usersLoading } = useUsers();
  const addAssignee = useAddTaskAssignee();
  const removeAssignee = useRemoveTaskAssignee();

  // Get current assignee IDs
  const currentAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    task.assignees?.forEach(a => ids.add(a.user_id));
    if (task.assigned_user) ids.add(task.assigned_user.id);
    return ids;
  }, [task.assignees, task.assigned_user]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 280;
      const openUpward = spaceBelow < dropdownHeight;

      setPosition({
        top: openUpward ? rect.top - dropdownHeight : rect.bottom + 4,
        left: Math.max(8, rect.left - 100), // Offset left to give more room
      });
    }
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  const handleToggleAssignee = async (userId: string) => {
    try {
      if (currentAssigneeIds.has(userId)) {
        await removeAssignee.mutateAsync({ taskId: task.id, userId });
      } else {
        await addAssignee.mutateAsync({ taskId: task.id, userId });
      }
    } catch (error) {
      console.error('Failed to toggle assignee:', error);
      // Alert user of the error
      alert(`Failed to update assignee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Current assignees for display
  const assignees = task.assignees?.length
    ? task.assignees
    : task.assigned_user
      ? [{ user_id: task.assigned_user.id, user: task.assigned_user }]
      : [];

  const allNames = assignees.map(a => a.user?.full_name || 'Unknown').join(', ');

  return (
    <>
      <div
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          toggleDropdown();
        }}
        className="flex items-center gap-1 cursor-pointer group"
      >
        {/* Show existing assignees */}
        {assignees.length > 0 ? (
          <div className="flex -space-x-2" title={allNames}>
            {assignees.slice(0, 3).map((assignee, idx) => (
              <div
                key={assignee.user_id || idx}
                className={`w-7 h-7 rounded-full ${getAvatarColor(assignee.user_id || '')} text-white text-xs font-medium flex items-center justify-center ring-2 ring-white`}
              >
                {assignee.user?.avatar_url ? (
                  <img
                    src={assignee.user.avatar_url}
                    alt={assignee.user?.full_name || 'User'}
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
        ) : (
          <div
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center"
            title="Click to assign"
          >
            <User className="w-3 h-3 text-gray-400" />
          </div>
        )}
        {/* Add button - visible on hover */}
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100">
          <UserPlus className="w-3 h-3 text-gray-500" />
        </div>
      </div>

      {/* Dropdown Portal */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* User List */}
          <div className="max-h-52 overflow-y-auto">
            {usersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                No users found
              </div>
            ) : (
              filteredUsers.map(user => {
                const isAssigned = currentAssigneeIds.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggleAssignee(user.id)}
                    disabled={addAssignee.isPending || removeAssignee.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isAssigned ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(user.id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isAssigned && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
            Click to assign/unassign
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Role badges component
function RoleBadges({ task }: { task: TaskWithDetails }) {
  const badges = [];

  if (task.isOwner) {
    badges.push(
      <span
        key="owner"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded"
        title="You own this task"
      >
        <Crown className="w-3 h-3" />
        Owner
      </span>
    );
  }

  if (task.isAssignee && !task.isOwner) {
    badges.push(
      <span
        key="assignee"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded"
        title="Assigned to you"
      >
        <UserCheck className="w-3 h-3" />
        Assignee
      </span>
    );
  }

  if (task.isInMyFunction && !task.isOwner && !task.isAssignee) {
    badges.push(
      <span
        key="function"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded"
        title="In your function"
      >
        <Building2 className="w-3 h-3" />
        My Function
      </span>
    );
  }

  if (badges.length === 0) return null;

  return <div className="flex items-center gap-1 mt-1">{badges}</div>;
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
      <td className="px-4 py-2" colSpan={7}>
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [headerColor, setHeaderColor] = useState('blue-900');
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
        is_private: isPrivate,
        header_color: headerColor,
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
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Header Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Header Color</label>
            <div className="flex flex-wrap gap-2">
              {headerColorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setHeaderColor(color.value)}
                  className={`w-8 h-8 rounded-lg ${color.bg} ${
                    headerColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Private Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPrivate ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isPrivate ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-700">Private initiative</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2 ml-14">
            Private initiatives are only visible to you
          </p>

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

// Initiative settings menu (edit, color, archive) - using portal for proper positioning
function InitiativeSettingsMenu({
  onEdit,
  onArchive,
}: {
  initiativeId: string;
  initiativeTitle: string;
  isPrivate: boolean;
  headerColor: string | null;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 160, // Align right edge
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="Initiative settings"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          style={{ top: position.top, left: position.left }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Initiative
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onArchive();
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// Edit initiative modal
function EditInitiativeModal({
  initiative,
  onClose,
  onSuccess,
}: {
  initiative: { id: string; title: string; isPrivate: boolean; headerColor: string | null };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(initiative.title);
  const [isPrivate, setIsPrivate] = useState(initiative.isPrivate);
  const [headerColor, setHeaderColor] = useState(initiative.headerColor || 'blue-900');
  const updateInitiative = useUpdatePersonalInitiative();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateInitiative.mutateAsync({
        id: initiative.id,
        title: title.trim(),
        is_private: isPrivate,
        header_color: headerColor,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update initiative:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Initiative</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Header Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Header Color</label>
            <div className="flex flex-wrap gap-2">
              {headerColorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setHeaderColor(color.value)}
                  className={`w-8 h-8 rounded-lg ${color.bg} ${
                    headerColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Private Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPrivate ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isPrivate ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-700">Private initiative</span>
            </div>
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
              disabled={updateInitiative.isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {updateInitiative.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Due date filter type
type DueDateFilter = 'all' | 'overdue' | 'due-today' | 'due-this-week' | 'high-priority';

// Sort option type
type SortOption = 'default' | 'due-date-asc' | 'due-date-desc' | 'updated-desc' | 'created-desc';

export default function MyTodos({ onBack }: MyTodosProps) {
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [collapsedInitiatives, setCollapsedInitiatives] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingTaskToInitiative, setAddingTaskToInitiative] = useState<string | null>(null);
  const [showNewInitiativeModal, setShowNewInitiativeModal] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<{ id: string; title: string; isPrivate: boolean; headerColor: string | null } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useMyTodosQuery();
  const { data: personalInitiatives = [], refetch: refetchPersonal } = usePersonalInitiativesQuery();
  const archiveInitiative = useArchivePersonalInitiative();
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

  const handleArchiveInitiative = async (initiativeId: string, title: string) => {
    if (!confirm(`Are you sure you want to archive "${title}"? This will hide it from your To-Dos.`)) return;
    try {
      await archiveInitiative.mutateAsync(initiativeId);
      refetchPersonal();
    } catch (err) {
      console.error('Failed to archive initiative:', err);
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
      return next;
    });
  };

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
      areaName: string;
      tasks: TaskWithDetails[];
      isPersonal: boolean;
      isPrivate: boolean;
      headerColor: string | null;
      sortOrder: number;
    }>();

    // Add personal initiatives first (even if they have no tasks)
    personalInitiatives.forEach(initiative => {
      grouped.set(initiative.id, {
        initiativeId: initiative.id,
        initiativeTitle: initiative.title,
        functionName: 'Personal',
        areaName: '',
        tasks: [],
        isPersonal: true,
        isPrivate: initiative.is_private,
        headerColor: initiative.header_color,
        sortOrder: initiative.sort_order,
      });
    });

    // Add tasks to their initiatives
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
          isPersonal: false,
          isPrivate: false,
          headerColor: null,
          sortOrder: 999, // Non-personal at the end
        });
      }
      grouped.get(initiativeId)!.tasks.push(task);
    });

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
  }, [filteredTasks, personalInitiatives]);

  // Count active filters
  const hasActiveFilters = searchQuery !== '' || filterStatus !== 'all' || showCompleted || activeFilter !== 'all' || dueDateFilter !== 'all' || sortOption !== 'default';

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-sm">I Own</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.totalOwned}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <UserCheck className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Assigned to Me</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.totalAssigned}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-gray-700">{stats.inProgressCount}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm">Done This Week</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.completedThisWeek}</p>
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

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => {
          const Icon = chip.icon;
          const isActive = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{chip.label}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {chip.count}
              </span>
            </button>
          );
        })}
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

          {/* Due Date Quick Filters */}
          <div className="flex items-center gap-1 border-l border-gray-300 pl-4 ml-2">
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'overdue' ? 'all' : 'overdue')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dueDateFilter === 'overdue'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              Overdue
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'due-today' ? 'all' : 'due-today')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dueDateFilter === 'due-today'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              Due Today
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'due-this-week' ? 'all' : 'due-this-week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dueDateFilter === 'due-this-week'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setDueDateFilter(dueDateFilter === 'high-priority' ? 'all' : 'high-priority')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                dueDateFilter === 'high-priority'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-red-500" />
              High Priority
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="default">Default Order</option>
            <option value="due-date-asc">Due Date (Earliest First)</option>
            <option value="due-date-desc">Due Date (Latest First)</option>
            <option value="updated-desc">Recently Updated</option>
            <option value="created-desc">Recently Created</option>
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
      {filteredTasks.length === 0 && tasksByInitiative.length === 0 ? (
        <EmptyState
          message={
            hasActiveFilters
              ? "No tasks match your filters"
              : "No tasks yet. Create an initiative and add tasks!"
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[80px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasksByInitiative.map(({ initiativeId, initiativeTitle, functionName, areaName, tasks, isPersonal, isPrivate, headerColor }) => {
                  const isCollapsed = collapsedInitiatives.has(initiativeId);
                  // Get color classes based on headerColor or default to blue
                  const colorOption = headerColorOptions.find(c => c.value === headerColor) || headerColorOptions[0];
                  const bgClass = headerColor ? `bg-${headerColor}` : 'bg-blue-900';
                  const hoverClass = headerColor ? colorOption.hover : 'hover:bg-blue-800';
                  const borderClass = headerColor ? `border-${headerColor.replace('900', '700').replace('800', '600').replace('700', '500')}` : 'border-blue-700';

                  return (
                    <>
                      {/* Initiative Header Row (like Area header in Initiatives tab) */}
                      <tr
                        key={`initiative-${initiativeId}`}
                        className={`${bgClass} border-t-2 ${borderClass} cursor-pointer ${hoverClass} transition-colors`}
                        onClick={() => toggleInitiativeCollapse(initiativeId)}
                      >
                        <td colSpan={7} className="px-4 py-2">
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
                            <div className="flex items-center gap-1">
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

                      {/* Empty Initiative Message */}
                      {!isCollapsed && tasks.length === 0 && addingTaskToInitiative !== initiativeId && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">
                            <div className="flex flex-col items-center gap-2">
                              <span>No tasks yet. Click "+ Add Task" to create one.</span>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Task Rows */}
                      {!isCollapsed && tasks.map((task, idx) => {
                        const taskOverdue = isOverdue(task);

                        return (
                          <tr
                            key={task.id}
                            className={`border-b border-gray-200 hover:bg-blue-50 transition-colors group cursor-pointer ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                            } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''}`}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            {/* Task Title with checkbox indicator, description tooltip, and role badges */}
                            <td className="px-4 py-3">
                              <div className="pl-6">
                                <div className="flex items-center gap-3">
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

                                  {/* High priority indicator */}
                                  {task.is_high_priority && (
                                    <div
                                      className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                                      title="High Priority"
                                    />
                                  )}

                                  {/* Title with description tooltip on hover */}
                                  <div className="relative group/title flex-1" onClick={(e) => e.stopPropagation()}>
                                    <InlineEditableText
                                      value={task.title}
                                      onSave={async (value) => {
                                        await updateField.mutateAsync({ id: task.id, field: 'title', value });
                                      }}
                                      placeholder="Enter task..."
                                      className={task.status === 'done' ? 'line-through text-gray-500' : 'font-medium'}
                                    />
                                    {/* Description tooltip - shows on hover if description exists */}
                                    {task.description && (
                                      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/title:block">
                                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg">
                                          <div className="font-medium text-gray-300 mb-1">Description:</div>
                                          <div className="whitespace-pre-wrap">{task.description}</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="ml-7">
                                  <RoleBadges task={task} />
                                </div>
                              </div>
                            </td>

                            {/* Owner - inline picker */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <InlineOwnerPicker task={task} />
                            </td>

                            {/* Assignees - inline picker */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <InlineAssigneePicker task={task} />
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <InlineStatusDropdown
                                status={task.status}
                                onSave={async (value) => {
                                  await handleStatusChange(task.id, value);
                                }}
                              />
                            </td>

                            {/* Due Date */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <InlineDatePicker
                                value={task.due_date}
                                onSave={async (value) => {
                                  await updateField.mutateAsync({ id: task.id, field: 'due_date', value });
                                }}
                                isOverdue={taskOverdue}
                              />
                            </td>

                            {/* Notes */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskId(task.id);
                                  }}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
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
          onSuccess={() => {
            refetch();
            refetchPersonal();
          }}
        />
      )}

      {/* Edit Initiative Modal */}
      {editingInitiative && (
        <EditInitiativeModal
          initiative={editingInitiative}
          onClose={() => setEditingInitiative(null)}
          onSuccess={() => {
            refetch();
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
    </div>
  );
}
