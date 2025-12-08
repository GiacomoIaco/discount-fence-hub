import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, Search, Edit3, Check, Loader2, Crown, UserCheck, User, Building2, UserPlus, MessageCircle, Send, Palette, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUsers } from '../../requests/hooks/useRequests';
import { useUpdateTaskField, useAddTaskAssignee, useRemoveTaskAssignee, useCreateTask, useAddTaskComment, setTaskViewed, type TaskWithDetails } from '../hooks/useMyTodos';
import { getInitials } from '../../../lib/stringUtils';
import {
  getAvatarColor,
  formatDate,
  statusOptions,
  headerColorOptions,
  setUserInitiativeColor,
} from '../utils/todoHelpers';

// Inline date picker component
export function InlineDatePicker({
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
export function InlineTextEditor({
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
export function InlineCommentPopup({
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
export function InitiativeColorPicker({
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
export function InlineStatusDropdown({
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
export function InlineOwnerPicker({ task }: { task: TaskWithDetails }) {
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
            <Edit3 className="w-2.5 h-2.5 text-gray-500" />
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
export function InlineAssigneePicker({ task }: { task: TaskWithDetails }) {
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
export function RoleBadges({ task }: { task: TaskWithDetails }) {
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
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
      <p>{message}</p>
    </div>
  );
}

// Quick add task row component
export function QuickAddTask({
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
