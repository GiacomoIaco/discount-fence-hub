import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, User, Building2, ChevronDown, ChevronRight, ChevronsUpDown, Search, X, Trash2, Edit3, Check, Loader2, Plus, Lock, MoreVertical, Archive, Pencil, Crown, UserCheck, Eye, UserPlus, Folder, Globe, GripVertical, MessageCircle, Send, Palette } from 'lucide-react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMyTodosQuery, useMyTodosStats, useUpdateTaskStatus, useUpdateTaskField, useDeleteTask, useCreateTask, useCreatePersonalInitiative, usePersonalInitiativesQuery, useUpdatePersonalInitiative, useArchivePersonalInitiative, useAddTaskAssignee, useRemoveTaskAssignee, useReorderTasks, useLastCommentsQuery, useAddTaskComment, setTaskViewed, isCommentUnread, type TaskWithDetails } from '../hooks/useMyTodos';
import { useAuth } from '../../../contexts/AuthContext';
import { useUsers } from '../../requests/hooks/useRequests';
import TaskDetailModal from './TaskDetailModal';
import { useFunctionsQuery, useAreasQuery, useCreateInitiative } from '../../leadership/hooks/useLeadershipQuery';

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

// Default blue color for all initiatives (user can customize per-initiative)
const DEFAULT_INITIATIVE_COLOR = { bg: 'bg-blue-900', hover: 'hover:bg-blue-800', border: 'border-blue-700' };

// User initiative color preferences (stored in localStorage)
const INITIATIVE_COLORS_KEY = 'myTodosInitiativeColors';

function getUserInitiativeColors(): Record<string, string> {
  try {
    const stored = localStorage.getItem(INITIATIVE_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setUserInitiativeColor(initiativeId: string, colorValue: string) {
  const colors = getUserInitiativeColors();
  colors[initiativeId] = colorValue;
  localStorage.setItem(INITIATIVE_COLORS_KEY, JSON.stringify(colors));
}

function getInitiativeColor(initiativeId: string): { bg: string; hover: string; border: string } {
  const userColors = getUserInitiativeColors();
  const userColor = userColors[initiativeId];

  if (userColor) {
    // Find the color option that matches
    const colorOption = headerColorOptions.find(c => c.value === userColor);
    if (colorOption) {
      return {
        bg: colorOption.bg,
        hover: colorOption.hover,
        border: `border-${userColor.replace('900', '700').replace('800', '600').replace('700', '500')}`,
      };
    }
  }

  // Default to blue
  return DEFAULT_INITIATIVE_COLOR;
}

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

// Inline text editor component for title and notes
function InlineTextEditor({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className = '',
  multiline = false,
}: {
  value: string | null | undefined;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue);
    } catch (err) {
      console.error('Failed to save:', err);
      setEditValue(value || '');
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value || '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const inputProps = {
      ref: inputRef as any,
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: handleSave,
      onKeyDown: handleKeyDown,
      className: `w-full px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`,
      disabled: isSaving,
    };

    return multiline ? (
      <div className="flex items-center gap-1">
        <textarea {...inputProps} rows={2} />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <input type="text" {...inputProps} />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setEditValue(value || '');
        setIsEditing(true);
      }}
      className={`group cursor-text hover:bg-blue-50 rounded px-2 py-1 -mx-1 transition-colors ${className}`}
    >
      {value ? (
        <span className="text-sm">{value}</span>
      ) : (
        <span className="text-sm text-gray-400 italic">{placeholder}</span>
      )}
      <Edit3 className="w-3 h-3 text-gray-400 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

// Inline comment popup component (like ClickUp)
function InlineCommentPopup({
  taskId,
  taskTitle,
  lastComment,
  onClose,
  position,
}: {
  taskId: string;
  taskTitle: string;
  lastComment: {
    id: string;
    content: string;
    created_at: string;
    user: { id: string; full_name: string } | null;
  } | null;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const addComment = useAddTaskComment();
  const { user } = useAuth();
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !user) return;
    setIsSending(true);
    try {
      await addComment.mutateAsync({
        taskId,
        content: newComment.trim(),
      });
      setNewComment('');
      setTaskViewed(taskId); // Mark as read after adding comment
      onClose();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  // Calculate position to ensure popup stays in viewport
  const adjustedTop = Math.min(position.top, window.innerHeight - 350);
  const adjustedLeft = Math.min(position.left, window.innerWidth - 350);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-80 bg-white border border-gray-200 rounded-lg shadow-xl"
      style={{ top: adjustedTop, left: adjustedLeft }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{taskTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Last Comment */}
      {lastComment && (
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-start gap-2">
            <div className={`w-7 h-7 rounded-full ${getAvatarColor(lastComment.user?.id || 'unknown')} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
              {getInitials(lastComment.user?.full_name || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{lastComment.user?.full_name || 'Unknown'}</span>
                <span>•</span>
                <span>{formatDate(lastComment.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                {lastComment.content}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comment Input */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... (Enter to send)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            disabled={isSending}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">Press Enter to send, Shift+Enter for new line</span>
          <button
            onClick={handleSendComment}
            disabled={!newComment.trim() || isSending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Initiative color picker dropdown
function InitiativeColorPicker({
  initiativeId,
  currentColor,
  onColorChange,
}: {
  initiativeId: string;
  currentColor: string;
  onColorChange: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setIsOpen(!isOpen);
  };

  const handleSelectColor = (colorValue: string) => {
    setUserInitiativeColor(initiativeId, colorValue);
    onColorChange();
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors opacity-0 group-hover:opacity-100"
        title="Change color"
      >
        <Palette className="w-4 h-4" />
      </button>
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg p-2"
          style={{ top: position.top, left: position.left }}
        >
          <div className="grid grid-cols-4 gap-1">
            {headerColorOptions.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectColor(option.value);
                }}
                className={`w-8 h-8 rounded-lg ${option.bg} ${option.hover} transition-transform hover:scale-110 ${
                  currentColor === option.value ? 'ring-2 ring-white ring-offset-2' : ''
                }`}
                title={option.label}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
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
      <td className="px-4 py-2" colSpan={8}>
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

// Initiative type for the modal
type InitiativeType = 'personal' | 'organizational';

// New initiative modal - supports both personal and organizational initiatives
function NewInitiativeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [headerColor, setHeaderColor] = useState('blue-900');
  const [initiativeType, setInitiativeType] = useState<InitiativeType>('personal');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const createPersonalInitiative = useCreatePersonalInitiative();
  const createOrgInitiative = useCreateInitiative();
  const { data: functions = [], isLoading: functionsLoading } = useFunctionsQuery();
  const { data: areas = [], isLoading: areasLoading } = useAreasQuery(selectedFunctionId || undefined);

  const inputRef = useRef<HTMLInputElement>(null);

  const isCreating = createPersonalInitiative.isPending || createOrgInitiative.isPending;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset area when function changes
  useEffect(() => {
    setSelectedAreaId('');
  }, [selectedFunctionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (initiativeType === 'personal') {
        await createPersonalInitiative.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          is_private: true, // Personal initiatives are always private
          header_color: headerColor,
        });
      } else {
        // Organizational initiative - requires area_id
        if (!selectedAreaId) {
          alert('Please select an area');
          return;
        }
        await createOrgInitiative.mutateAsync({
          area_id: selectedAreaId,
          title: title.trim(),
          description: description.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create initiative:', err);
      alert('Failed to create initiative');
    }
  };

  const selectedFunction = functions.find(f => f.id === selectedFunctionId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Initiative</h2>
          <p className="text-sm text-gray-500 mt-1">Create a personal or organizational initiative</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Initiative Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initiative Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setInitiativeType('personal')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  initiativeType === 'personal'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="font-medium">Personal</span>
              </button>
              <button
                type="button"
                onClick={() => setInitiativeType('organizational')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  initiativeType === 'organizational'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">Organizational</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {initiativeType === 'personal'
                ? 'Personal initiatives are private and only visible to you'
                : 'Organizational initiatives are linked to a Function > Area and visible to team members'}
            </p>
          </div>

          {/* Function & Area Selection (only for organizational) */}
          {initiativeType === 'organizational' && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
                {functionsLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading functions...
                  </div>
                ) : functions.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No functions available. You need access to at least one function.</p>
                ) : (
                  <select
                    value={selectedFunctionId}
                    onChange={(e) => setSelectedFunctionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select a function...</option>
                    {functions.map((func) => (
                      <option key={func.id} value={func.id}>
                        {func.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFunctionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  {areasLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading areas...
                    </div>
                  ) : areas.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">
                      No areas in this function. Create areas in the Leadership Hub first.
                    </p>
                  ) : (
                    <select
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Select an area...</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedAreaId && selectedFunction && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {selectedFunction.name} / {areas.find(a => a.id === selectedAreaId)?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={initiativeType === 'personal' ? 'e.g., Q4 Personal Goals' : 'e.g., Improve Customer Onboarding'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Description */}
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

          {/* Header Color (only for personal initiatives) */}
          {initiativeType === 'personal' && (
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
          )}

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
              disabled={
                isCreating ||
                !title.trim() ||
                (initiativeType === 'organizational' && !selectedAreaId)
              }
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
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

// Sortable Task Row Component
interface SortableTaskRowProps {
  task: TaskWithDetails;
  idx: number;
  lastComment: {
    id: string;
    content: string;
    created_at: string;
    user: { id: string; full_name: string } | null;
  } | null;
  onOpenTask: () => void;
  onOpenCommentPopup: (taskId: string, taskTitle: string, position: { top: number; left: number }) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onUpdateField: (params: { id: string; field: string; value: any }) => Promise<any>;
  onDeleteTask: (taskId: string) => void;
}

function SortableTaskRow({ task, idx, lastComment, onOpenTask, onOpenCommentPopup, onStatusChange, onUpdateField, onDeleteTask }: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const taskOverdue = isOverdue(task);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-200 hover:bg-blue-50 transition-colors group cursor-pointer ${
        idx % 2 === 0 ? 'bg-white' : 'bg-gray-25'
      } ${taskOverdue ? 'bg-red-50 border-l-4 border-l-red-400' : ''} ${isDragging ? 'shadow-lg ring-2 ring-blue-500 z-50' : ''}`}
      onClick={onOpenTask}
    >
      {/* Task Title with drag handle, checkbox indicator, description tooltip, and role badges */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="pl-2">
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
                    onStatusChange(task.id, 'done');
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

              {/* Title - inline editable */}
              <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                <InlineTextEditor
                  value={task.title}
                  onSave={async (value) => {
                    await onUpdateField({ id: task.id, field: 'title', value });
                  }}
                  placeholder="Add title..."
                  className={task.status === 'done' ? 'line-through text-gray-500' : 'font-medium'}
                />
              </div>
            </div>
            <div className="ml-7">
              <RoleBadges task={task} />
            </div>
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
            await onStatusChange(task.id, value);
          }}
        />
      </td>

      {/* Due Date */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineDatePicker
          value={task.due_date}
          onSave={async (value) => {
            await onUpdateField({ id: task.id, field: 'due_date', value });
          }}
          isOverdue={!!taskOverdue}
        />
      </td>

      {/* Notes - inline editable */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <InlineTextEditor
          value={task.notes}
          onSave={async (value) => {
            await onUpdateField({ id: task.id, field: 'notes', value });
          }}
          placeholder="Add notes..."
          className="text-gray-600 max-w-[120px]"
        />
      </td>

      {/* Last Comment - click to open inline comment popup */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div
          className={`text-xs rounded px-2 py-1 cursor-pointer hover:bg-blue-50 transition-colors ${
            lastComment && isCommentUnread(task.id, lastComment.created_at)
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-gray-50 border border-transparent'
          }`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenCommentPopup(task.id, task.title, { top: rect.bottom + 4, left: rect.left });
          }}
          title="Click to add comment"
        >
          {lastComment ? (
            <>
              <div className="flex items-center gap-1 text-gray-500 mb-0.5">
                <span className="font-medium truncate max-w-[80px]">
                  {lastComment.user?.full_name?.split(' ')[0] || 'Unknown'}
                </span>
                <span>•</span>
                <span>{formatDate(lastComment.created_at)}</span>
                {isCommentUnread(task.id, lastComment.created_at) && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 ml-1" title="New comment" />
                )}
              </div>
              <div className="text-gray-700 truncate max-w-[150px]">
                {lastComment.content}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <MessageCircle className="w-3 h-3" />
              <span>Add comment</span>
            </div>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTask();
            }}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
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
}
