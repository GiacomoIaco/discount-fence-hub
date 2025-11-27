import { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, MessageSquare, Clock, Crown, UserCheck, Building2, User, Loader2, Edit3, Save, AlertTriangle } from 'lucide-react';
import { useUpdateTaskStatus, useUpdateTaskField, useMyTodosQuery } from '../hooks/useMyTodos';
import TaskCommentsPanel from './TaskCommentsPanel';

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
}

// Helper to get initials
const getInitials = (fullName: string): string => {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get avatar color from user ID
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

// Status badge config
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'To Do' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Done' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked' },
};

export default function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { data } = useMyTodosQuery();
  const updateStatus = useUpdateTaskStatus();
  const updateField = useUpdateTaskField();

  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Find the task from the data
  const task = data?.tasks.find(t => t.id === taskId);

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
    await updateStatus.mutateAsync({ id: task.id, status });
  };

  const handleSaveTitle = async () => {
    if (editTitle.trim() && editTitle !== task.title) {
      await updateField.mutateAsync({ id: task.id, field: 'title', value: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (editDescription !== (task.description || '')) {
      await updateField.mutateAsync({ id: task.id, field: 'description', value: editDescription || null });
    }
    setIsEditingDescription(false);
  };

  const handleSaveNotes = async () => {
    if (editNotes !== (task.notes || '')) {
      await updateField.mutateAsync({ id: task.id, field: 'notes', value: editNotes || null });
    }
    setIsEditingNotes(false);
  };

  const handleSaveDueDate = async (date: string | null) => {
    await updateField.mutateAsync({ id: task.id, field: 'due_date', value: date });
  };

  // Check user permissions
  const canEdit = task.isOwner || task.isCreator;

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
              {isEditingTitle && canEdit ? (
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
                      if (e.key === 'Escape') {
                        setEditTitle(task.title);
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                </div>
              ) : (
                <h2
                  className={`text-xl font-bold text-gray-900 ${canEdit ? 'cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2' : ''}`}
                  onClick={() => canEdit && setIsEditingTitle(true)}
                >
                  {task.title}
                  {canEdit && <Edit3 className="w-4 h-4 inline ml-2 text-gray-400" />}
                </h2>
              )}

              {/* Initiative/Function breadcrumb */}
              <p className="text-sm text-gray-500 mt-1">
                {task.initiative?.area?.function?.name && `${task.initiative.area.function.name} / `}
                {task.initiative?.area?.name && `${task.initiative.area.name} / `}
                {task.initiative?.title || 'Personal Initiative'}
              </p>

              {/* Role badges */}
              <div className="flex items-center gap-2 mt-2">
                {task.isOwner && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                    <Crown className="w-3 h-3" />
                    Owner
                  </span>
                )}
                {task.isAssignee && !task.isOwner && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                    <UserCheck className="w-3 h-3" />
                    Assignee
                  </span>
                )}
                {task.isInMyFunction && !task.isOwner && !task.isAssignee && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                    <Building2 className="w-3 h-3" />
                    My Function
                  </span>
                )}
              </div>
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
              <Clock className="w-4 h-4" />
              Details
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1 ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comments
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Status, Due Date & Priority Row */}
              <div className="flex flex-wrap gap-4 items-start">
                {/* Status Selector */}
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

                {/* Due Date */}
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
                      disabled={!canEdit}
                    />
                  </div>
                  {isOverdue && (
                    <p className="text-xs text-red-600 mt-1">This task is overdue!</p>
                  )}
                </div>

                {/* High Priority Toggle */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
                  <button
                    onClick={async () => {
                      if (canEdit) {
                        await updateField.mutateAsync({
                          id: task.id,
                          field: 'is_high_priority',
                          value: !task.is_high_priority,
                        });
                      }
                    }}
                    disabled={!canEdit || updateField.isPending}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      task.is_high_priority
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    } ${!canEdit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${task.is_high_priority ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <span className="text-sm font-medium">
                      {task.is_high_priority ? 'High Priority' : 'Normal'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Owner */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Owner</label>
                {task.owner ? (
                  <div className="flex items-center gap-2">
                    {task.owner.avatar_url ? (
                      <img
                        src={task.owner.avatar_url}
                        alt={task.owner.full_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${getAvatarColor(task.owner.id)} flex items-center justify-center`}>
                        <span className="text-xs font-medium text-white">
                          {getInitials(task.owner.full_name)}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{task.owner.full_name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No owner assigned</p>
                )}
              </div>

              {/* Assignees */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Assignee(s)</label>
                {(task.assignees?.length || task.assigned_user) ? (
                  <div className="flex flex-wrap gap-2">
                    {task.assignees?.length ? (
                      task.assignees.map((assignee) => (
                        <div key={assignee.user_id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                          {assignee.user?.avatar_url ? (
                            <img
                              src={assignee.user.avatar_url}
                              alt={assignee.user.full_name || 'User'}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className={`w-6 h-6 rounded-full ${getAvatarColor(assignee.user_id)} flex items-center justify-center`}>
                              <span className="text-xs font-medium text-white">
                                {getInitials(assignee.user?.full_name || 'U')}
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-gray-700">{assignee.user?.full_name || 'Unknown'}</span>
                        </div>
                      ))
                    ) : task.assigned_user ? (
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                        {task.assigned_user.avatar_url ? (
                          <img
                            src={task.assigned_user.avatar_url}
                            alt={task.assigned_user.full_name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${getAvatarColor(task.assigned_user.id)} flex items-center justify-center`}>
                            <span className="text-xs font-medium text-white">
                              {getInitials(task.assigned_user.full_name)}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-gray-700">{task.assigned_user.full_name}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <User className="w-4 h-4" />
                    <span>No assignees</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase">Description</label>
                  {canEdit && !isEditingDescription && (
                    <button
                      onClick={() => setIsEditingDescription(true)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {isEditingDescription && canEdit ? (
                  <div>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Add a description for this task..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditDescription(task.description || '');
                          setIsEditingDescription(false);
                        }}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveDescription}
                        disabled={updateField.isPending}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {updateField.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
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
                  {canEdit && !isEditingNotes && (
                    <button
                      onClick={() => setIsEditingNotes(true)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {isEditingNotes && canEdit ? (
                  <div>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Add notes about this task..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditNotes(task.notes || '');
                          setIsEditingNotes(false);
                        }}
                        className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNotes}
                        disabled={updateField.isPending}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {updateField.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
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
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Complete
                    </button>
                  )}
                  {task.status === 'todo' && (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Start Working
                    </button>
                  )}
                  {task.status === 'done' && (
                    <button
                      onClick={() => handleStatusChange('todo')}
                      disabled={updateStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Reopen Task
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
