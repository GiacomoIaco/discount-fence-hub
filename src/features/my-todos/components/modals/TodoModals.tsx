import { useState, useRef, useEffect, useMemo } from 'react';
import { Lock, Globe, User, Loader2, Search, X, Check } from 'lucide-react';
import { useCreateTodoList, useUpdateTodoList, useTodoListMembersQuery, useAddTodoListMember, useRemoveTodoListMember } from '../../hooks/useTodoLists';
import { useUsers } from '../../../requests/hooks/useRequests';
import { headerColorOptions } from '../../utils/todoHelpers';
import { getInitials } from '../../../../lib/stringUtils';
import { getAvatarColor } from '../../utils/todoHelpers';
import type { TodoVisibility } from '../../types';

// ============================================
// New List Modal
// ============================================

interface NewListModalProps {
  onClose: () => void;
  onSuccess: (listId?: string) => void;
}

export function NewListModal({ onClose, onSuccess }: NewListModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<TodoVisibility>('personal');
  const [color, setColor] = useState('blue-900');
  const createList = useCreateTodoList();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const list = await createList.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        color,
      });
      onSuccess(list?.id);
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New List</h2>
          <p className="text-sm text-gray-500 mt-1">Create a new todo list</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Operations, Personal Goals"
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

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div className="flex gap-2">
              {[
                { value: 'personal' as const, label: 'Personal', icon: User, desc: 'Only you' },
                { value: 'private' as const, label: 'Private', icon: Lock, desc: 'Members only' },
                { value: 'open' as const, label: 'Open', icon: Globe, desc: 'All users' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 transition-all ${
                    visibility === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-gray-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {headerColorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-lg ${c.bg} ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title={c.label}
                />
              ))}
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
              disabled={createList.isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {createList.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Edit List Modal
// ============================================

interface EditListModalProps {
  list: { id: string; title: string; description: string | null; visibility: string; color: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function EditListModal({ list, onClose, onSuccess }: EditListModalProps) {
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description || '');
  const [visibility, setVisibility] = useState(list.visibility as TodoVisibility);
  const [color, setColor] = useState(list.color);
  const updateList = useUpdateTodoList();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateList.mutateAsync({
        id: list.id,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        color,
      });
      onSuccess();
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit List</h2>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div className="flex gap-2">
              {[
                { value: 'personal' as const, label: 'Personal', icon: User },
                { value: 'private' as const, label: 'Private', icon: Lock },
                { value: 'open' as const, label: 'Open', icon: Globe },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    visibility === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <opt.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {headerColorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-lg ${c.bg} ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateList.isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {updateList.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Manage List Members Modal
// ============================================

interface ManageListMembersModalProps {
  listId: string;
  onClose: () => void;
}

export function ManageListMembersModal({ listId, onClose }: ManageListMembersModalProps) {
  const { data: members, isLoading: membersLoading } = useTodoListMembersQuery(listId);
  const { users, loading: usersLoading } = useUsers();
  const addMember = useAddTodoListMember();
  const removeMember = useRemoveTodoListMember();
  const [searchQuery, setSearchQuery] = useState('');

  const memberIds = useMemo(() => new Set((members || []).map(m => m.user_id)), [members]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, searchQuery]);

  const handleToggleMember = async (userId: string) => {
    if (memberIds.has(userId)) {
      // Check if they're the owner
      const member = members?.find(m => m.user_id === userId);
      if (member?.role === 'owner') return; // Can't remove owner
      await removeMember.mutateAsync({ listId, userId });
    } else {
      await addMember.mutateAsync({ listId, userId });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Manage Members</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Current Members */}
        {!searchQuery && members && members.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Current Members ({members.length})</div>
            <div className="space-y-1">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                  <div className={`w-7 h-7 rounded-full ${getAvatarColor(m.user_id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                    {m.user?.avatar_url ? (
                      <img src={m.user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(m.user?.full_name || 'U')
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{m.user?.full_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{m.role}</div>
                  </div>
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => handleToggleMember(m.user_id)}
                      disabled={removeMember.isPending}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Users */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="text-xs font-medium text-gray-500 uppercase mb-2">
            {searchQuery ? 'Search Results' : 'All Users'}
          </div>
          {usersLoading || membersLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map(user => {
                const isMember = memberIds.has(user.id);
                const isOwner = members?.find(m => m.user_id === user.id)?.role === 'owner';
                return (
                  <button
                    key={user.id}
                    onClick={() => handleToggleMember(user.id)}
                    disabled={isOwner || addMember.isPending || removeMember.isPending}
                    className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-gray-50 transition-colors ${
                      isMember ? 'bg-blue-50' : ''
                    } ${isOwner ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(user.id)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}>
                      {getInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    {isMember && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
