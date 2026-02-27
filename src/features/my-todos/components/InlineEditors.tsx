import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronDown, Search, Edit3, Check, Loader2, User, UserPlus, MessageCircle, Send, Palette, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUsers } from '../../requests/hooks/useRequests';
import { useUpdateTodoItem, useCreateTodoItem, useAddTodoItemComment, useAddTodoItemFollower, useRemoveTodoItemFollower, setTaskViewed } from '../hooks/useMyTodos';
import { useUpdateTodoSection } from '../hooks/useTodoSections';
import { getInitials } from '../../../lib/stringUtils';
import {
  getAvatarColor,
  formatDate,
  statusOptions,
  headerColorOptions,
} from '../utils/todoHelpers';
import type { TodoItem } from '../types';

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

// Inline comment popup component
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
  const addComment = useAddTodoItemComment();
  const { user } = useAuth();
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

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
        itemId: taskId,
        content: newComment.trim(),
      });
      setNewComment('');
      setTaskViewed(taskId);
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

  const adjustedTop = Math.min(position.top, window.innerHeight - 350);
  const adjustedLeft = Math.min(position.left, window.innerWidth - 350);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-80 bg-white border border-gray-200 rounded-lg shadow-xl"
      style={{ top: adjustedTop, left: adjustedLeft }}
    >
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{taskTitle}</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {lastComment && (
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-start gap-2">
            <div className={`w-7 h-7 rounded-full ${getAvatarColor(lastComment.user?.id || 'unknown')} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
              {getInitials(lastComment.user?.full_name || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">{lastComment.user?.full_name || 'Unknown'}</span>
                <span>·</span>
                <span>{formatDate(lastComment.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{lastComment.content}</p>
            </div>
          </div>
        </div>
      )}

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
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Section color picker dropdown (renamed from InitiativeColorPicker)
export function SectionColorPicker({
  sectionId,
  listId,
  currentColor,
}: {
  sectionId: string;
  listId: string;
  currentColor: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const updateSection = useUpdateTodoSection();

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
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  const handleSelectColor = async (colorValue: string) => {
    await updateSection.mutateAsync({ id: sectionId, listId, color: colorValue });
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded transition-colors"
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

// Inline status dropdown component with portal
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

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 180;
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

// Inline single-person assigned-to picker
export function InlineAssignedToPicker({ task, listId }: { task: TodoItem; listId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { users, loading: usersLoading } = useUsers();
  const updateItem = useUpdateTodoItem();

  const assignedUser = task.assigned_user;

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
        left: Math.max(8, rect.left - 100),
      });
    }
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  const handleSelectUser = async (userId: string | null) => {
    try {
      await updateItem.mutateAsync({ id: task.id, listId, assigned_to: userId });
      setIsOpen(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to update assignee:', error);
    }
  };

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
        {assignedUser ? (
          <div
            className={`w-7 h-7 rounded-full ${getAvatarColor(assignedUser.id)} text-white text-xs font-medium flex items-center justify-center`}
            title={assignedUser.full_name}
          >
            {assignedUser.avatar_url ? (
              <img src={assignedUser.avatar_url} alt={assignedUser.full_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(assignedUser.full_name)
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
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100">
          <Edit3 className="w-2.5 h-2.5 text-gray-500" />
        </div>
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">Assign To</span>
          </div>

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

          <div className="max-h-52 overflow-y-auto">
            {/* Unassign option */}
            {assignedUser && (
              <button
                onClick={() => handleSelectUser(null)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors text-gray-500 border-b border-gray-100"
              >
                <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                  <X className="w-3 h-3 text-gray-400" />
                </div>
                <span className="text-sm">Unassign</span>
              </button>
            )}

            {usersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">No users found</div>
            ) : (
              filteredUsers.map(user => {
                const isCurrentAssignee = assignedUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    disabled={updateItem.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isCurrentAssignee ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(user.id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isCurrentAssignee && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
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

// Inline followers picker — multi-person picker
export function InlineFollowersPicker({ task, listId }: { task: TodoItem; listId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { users, loading: usersLoading } = useUsers();
  const addFollower = useAddTodoItemFollower();
  const removeFollower = useRemoveTodoItemFollower();

  const currentFollowerIds = useMemo(() => {
    return new Set((task.followers || []).map(f => f.user_id));
  }, [task.followers]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
        left: Math.max(8, rect.left - 100),
      });
    }
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  const handleToggleFollower = async (userId: string) => {
    try {
      if (currentFollowerIds.has(userId)) {
        await removeFollower.mutateAsync({ itemId: task.id, userId, listId });
      } else {
        await addFollower.mutateAsync({ itemId: task.id, userId, listId });
      }
    } catch (error) {
      console.error('Failed to toggle follower:', error);
    }
  };

  const followers = task.followers || [];

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
        {followers.length > 0 ? (
          <div className="flex -space-x-2" title={followers.map(f => f.user?.full_name || 'User').join(', ')}>
            {followers.slice(0, 3).map((f, idx) => (
              <div
                key={f.user_id || idx}
                className={`w-6 h-6 rounded-full ${getAvatarColor(f.user_id || '')} text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white`}
              >
                {f.user?.avatar_url ? (
                  <img src={f.user.avatar_url} alt={f.user.full_name || 'User'} className="w-full h-full rounded-full object-cover" />
                ) : (
                  getInitials(f.user?.full_name || 'U')
                )}
              </div>
            ))}
            {followers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-400 text-white text-[10px] font-medium flex items-center justify-center ring-2 ring-white">
                +{followers.length - 3}
              </div>
            )}
          </div>
        ) : null}
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-purple-100">
          <UserPlus className="w-3 h-3 text-gray-500" />
        </div>
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] w-64 bg-white border border-gray-200 rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">Followers</span>
          </div>

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

          <div className="max-h-52 overflow-y-auto">
            {usersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">No users found</div>
            ) : (
              filteredUsers.map(user => {
                const isFollower = currentFollowerIds.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggleFollower(user.id)}
                    disabled={addFollower.isPending || removeFollower.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isFollower ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(user.id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isFollower && <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-500">
            Click to follow/unfollow
          </div>
        </div>,
        document.body
      )}
    </>
  );
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

// Quick add task row component (updated for todo_items)
export function QuickAddTask({
  sectionId,
  listId,
  onCancel,
  onSuccess,
}: {
  sectionId: string;
  listId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const createItem = useCreateTodoItem();
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
      await createItem.mutateAsync({
        sectionId,
        listId,
        title: title.trim(),
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
            placeholder="Enter task title and press Enter..."
            className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={createItem.isPending}
          />
          {createItem.isPending && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSubmit}
            disabled={createItem.isPending || !title.trim()}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={onCancel} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}
