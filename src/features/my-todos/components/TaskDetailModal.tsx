import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, MessageSquare, Clock, User, Loader2, Edit3, Save, AlertTriangle } from 'lucide-react';
import { useTodoItemsQuery, useUpdateTodoItemStatus, useUpdateTodoItem } from '../hooks/useTodoItems';
import { useTodoSectionsQuery } from '../hooks/useTodoSections';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import TaskCommentsPanel from './TaskCommentsPanel';
import { InlineFollowersPicker } from './InlineEditors';
import { getInitials } from '../../../lib/stringUtils';
import { getAvatarColor } from '../utils/todoHelpers';

interface TaskDetailModalProps {
  taskId: string;
  listId: string;
  onClose: () => void;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'To Do' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked' },
};

export default function TaskDetailModal({ taskId, listId, onClose }: TaskDetailModalProps) {
  const { data: items } = useTodoItemsQuery(listId);
  const { data: sections } = useTodoSectionsQuery(listId);
  const { data: lists } = useTodoListsQuery();
  const updateStatus = useUpdateTodoItemStatus();
  const updateItem = useUpdateTodoItem();

  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const task = items?.find(t => t.id === taskId);
  const section = sections?.find(s => s.id === task?.section_id);
  const list = lists?.find(l => l.id === listId);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditNotes(task.notes || '');
    }
  }, [task]);

  if (!task) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading task...</p>
        </div>
      </div>
    );
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const statusInfo = statusConfig[task.status] || statusConfig.todo;

  const handleStatusChange = async (status: string) => {
    await updateStatus.mutateAsync({ id: task.id, status, listId });
  };

  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle !== task.title) {
      await updateItem.mutateAsync({ id: task.id, listId, title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (editDescription !== (task.description || '')) {
      await updateItem.mutateAsync({ id: task.id, listId, description: editDescription || null });
    }
    setIsEditingDescription(false);
  };

  const handleSaveNotes = async () => {
    if (editNotes !== (task.notes || '')) {
      await updateItem.mutateAsync({ id: task.id, listId, notes: editNotes || null });
    }
    setIsEditingNotes(false);
  };

  const handleSaveDueDate = async (date: string | null) => {
    await updateItem.mutateAsync({ id: task.id, listId, due_date: date });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold text-gray-900 w-full px-2 py-1 border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') { setEditTitle(task.title); setIsEditingTitle(false); }
                    }}
                  />
                </div>
              ) : (
                <h2
                  className="text-xl font-bold text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {task.title}
                  <Edit3 className="w-4 h-4 inline ml-2 text-gray-400" />
                </h2>
              )}

              {/* Breadcrumb: list > section */}
              <p className="text-sm text-gray-500 mt-1">
                {list?.title || 'List'} / {section?.title || 'Section'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1 ${
                activeTab === 'details'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" /> Details
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1 ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Comments
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Status, Due Date & Priority */}
              <div className="flex flex-wrap gap-4 items-start">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Status</label>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updateStatus.isPending}
                    className={`px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Due Date</label>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isOverdue ? 'bg-red-50' : 'bg-gray-50'}`}>
                    {isOverdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    <Calendar className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-gray-500'}`} />
                    <input
                      type="date"
                      value={task.due_date || ''}
                      onChange={(e) => handleSaveDueDate(e.target.value || null)}
                      className={`text-sm font-medium bg-transparent border-none focus:ring-0 ${isOverdue ? 'text-red-700' : 'text-gray-700'}`}
                    />
                  </div>
                  {isOverdue && <p className="text-xs text-red-600 mt-1">This task is overdue!</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
                  <button
                    onClick={async () => {
                      await updateItem.mutateAsync({
                        id: task.id,
                        listId,
                        is_high_priority: !task.is_high_priority,
                      });
                    }}
                    disabled={updateItem.isPending}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      task.is_high_priority
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    } cursor-pointer`}
                  >
                    <div className={`w-2 h-2 rounded-full ${task.is_high_priority ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <span className="text-sm font-medium">
                      {task.is_high_priority ? 'High Priority' : 'Normal'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Assigned To</label>
                {task.assigned_user ? (
                  <div className="flex items-center gap-2">
                    {task.assigned_user.avatar_url ? (
                      <img src={task.assigned_user.avatar_url} alt={task.assigned_user.full_name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(task.assigned_user.id)} flex items-center justify-center`}>
                        <span className="text-xs font-medium text-white">{getInitials(task.assigned_user.full_name)}</span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{task.assigned_user.full_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <User className="w-4 h-4" />
                    <span>No one assigned</span>
                  </div>
                )}
              </div>

              {/* Followers */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Followers</label>
                <div onClick={(e) => e.stopPropagation()}>
                  <InlineFollowersPicker task={task} listId={listId} />
                </div>
                {task.followers && task.followers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.followers.map(f => (
                      <div key={f.user_id} className="flex items-center gap-1.5 bg-purple-50 px-2 py-1 rounded text-sm">
                        <div className={`w-5 h-5 rounded-full ${getAvatarColor(f.user_id)} text-white text-[10px] flex items-center justify-center`}>
                          {getInitials(f.user?.full_name || 'U')}
                        </div>
                        <span className="text-purple-800">{f.user?.full_name || 'User'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase">Description</label>
                  {!isEditingDescription && (
                    <button onClick={() => setIsEditingDescription(true)} className="text-xs text-blue-600 hover:text-blue-700">
                      Edit
                    </button>
                  )}
                </div>
                {isEditingDescription ? (
                  <div>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Add a description..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => { setEditDescription(task.description || ''); setIsEditingDescription(false); }}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >Cancel</button>
                      <button
                        onClick={handleSaveDescription}
                        disabled={updateItem.isPending}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {updateItem.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`text-sm whitespace-pre-wrap ${task.description ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {task.description || 'No description'}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase">Notes</label>
                  {!isEditingNotes && (
                    <button onClick={() => setIsEditingNotes(true)} className="text-xs text-blue-600 hover:text-blue-700">
                      Edit
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Add notes..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => { setEditNotes(task.notes || ''); setIsEditingNotes(false); }}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >Cancel</button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={updateItem.isPending}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {updateItem.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`text-sm whitespace-pre-wrap ${task.notes ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                    {task.notes || 'No notes yet'}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  {task.status !== 'done' && (
                    <button
                      onClick={() => handleStatusChange('done')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark Complete
                    </button>
                  )}
                  {task.status === 'todo' && (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" /> Start Working
                    </button>
                  )}
                  {task.status === 'done' && (
                    <button
                      onClick={() => handleStatusChange('todo')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" /> Reopen Task
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <TaskCommentsPanel taskId={taskId} />
          )}
        </div>
      </div>
    </div>
  );
}
