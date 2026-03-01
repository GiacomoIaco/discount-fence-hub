import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Calendar, CheckCircle2, MessageSquare, Clock, User, Loader2, Edit3,
  Save, AlertTriangle, Send, Paperclip, Camera, Image, FileText, Trash2,
  Play, Video, Download,
} from 'lucide-react';
import {
  useTodoItemsQuery, useUpdateTodoItemStatus, useUpdateTodoItem,
  useTodoItemCommentsQuery, useAddTodoItemComment, useDeleteTodoItemComment,
  useTodoItemAttachmentsQuery, useUploadTodoAttachment, useDeleteTodoAttachment,
  useAddTodoItemFollower,
  useUpdateTodoRecurrence, useCreateNextRecurrence,
} from '../hooks/useTodoItems';
import { useUsers } from '../../requests/hooks/useRequests';
import { useTodoSectionsQuery } from '../hooks/useTodoSections';
import { useTodoListsQuery } from '../hooks/useTodoLists';
import { InlineFollowersPicker } from './InlineEditors';
import { useAuth } from '../../../contexts/AuthContext';
import { getInitials } from '../../../lib/stringUtils';
import { getAvatarColor } from '../utils/todoHelpers';
import type { TodoItemAttachment } from '../types';

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

function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function renderCommentContent(content: string) {
  // Split on @Name patterns
  const parts = content.split(/(@[A-Za-z\s]+?)(?=\s@|\s*$|[.,!?\s])/g);
  return parts.map((part, i) => {
    if (part.startsWith('@') && part.length > 1) {
      return (
        <span key={i} className="text-blue-600 font-medium">{part}</span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Inline video player for chat
function InlineVideoPlayer({ src, className }: { src: string; className?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 rounded ${className}`}>
        <span className="text-gray-400 text-xs">Video unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-900 rounded overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls={isPlaying}
        playsInline
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />
      {!isPlaying && (
        <button
          onClick={() => {
            videoRef.current?.play();
            setIsPlaying(true);
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
        >
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-gray-800 ml-0.5" />
          </div>
        </button>
      )}
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-white text-[10px] flex items-center gap-1">
        <Video className="w-3 h-3" />
        Video
      </div>
    </div>
  );
}

export default function TaskDetailModal({ taskId, listId, onClose }: TaskDetailModalProps) {
  const { user } = useAuth();
  const { data: items } = useTodoItemsQuery(listId);
  const { data: sections } = useTodoSectionsQuery(listId);
  const { data: lists } = useTodoListsQuery();
  const { data: comments, isLoading: commentsLoading } = useTodoItemCommentsQuery(taskId);
  const { data: attachments } = useTodoItemAttachmentsQuery(taskId);
  const updateStatus = useUpdateTodoItemStatus();
  const updateItem = useUpdateTodoItem();
  const addComment = useAddTodoItemComment();
  const deleteComment = useDeleteTodoItemComment();
  const uploadAttachment = useUploadTodoAttachment();
  const deleteAttachment = useDeleteTodoAttachment();
  const addFollower = useAddTodoItemFollower();
  const updateRecurrence = useUpdateTodoRecurrence();
  const createNextRecurrence = useCreateNextRecurrence();
  const { users } = useUsers();

  const [activeTab, setActiveTab] = useState<'chat' | 'details' | 'files'>('chat');
  const [newMessage, setNewMessage] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; isVideo: boolean } | null>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Detail editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const filteredUsers = useMemo(() => {
    if (!mentionActive || !users) return [];
    return users
      .filter(u => u.name.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [mentionActive, mentionQuery, users]);

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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab]);

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

  // Handlers
  const handleStatusChange = async (status: string) => {
    await updateStatus.mutateAsync({ id: task.id, status, listId });
    // If completing a recurring task, create the next instance
    if (status === 'done' && task.recurrence_rule) {
      try {
        await createNextRecurrence.mutateAsync({ itemId: task.id, listId });
      } catch (err) {
        console.warn('Failed to create next recurring instance:', err);
      }
    }
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

  const handleMessageTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewMessage(value);

    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' ';
      if ((charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) && !textAfterAt.includes('\n')) {
        setMentionQuery(textAfterAt.toLowerCase());
        setMentionStart(lastAtIndex);
        setMentionActive(true);
        setMentionIndex(0);
        return;
      }
    }

    setMentionActive(false);
  };

  const selectMention = (selectedUser: { id: string; name: string }) => {
    if (!messageTextareaRef.current) return;
    const before = newMessage.substring(0, mentionStart);
    const after = newMessage.substring(messageTextareaRef.current.selectionStart);
    const newValue = `${before}@${selectedUser.name} ${after}`;
    setNewMessage(newValue);
    setMentionActive(false);

    setTimeout(() => {
      if (messageTextareaRef.current) {
        const newPos = mentionStart + selectedUser.name.length + 2;
        messageTextareaRef.current.focus();
        messageTextareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Parse @mentions
    const mentionPattern = /@([A-Za-z\s]+?)(?=\s@|\s*$|[.,!?])/g;
    const mentionedNames: string[] = [];
    let match;
    while ((match = mentionPattern.exec(newMessage)) !== null) {
      mentionedNames.push(match[1].trim());
    }

    await addComment.mutateAsync({ itemId: taskId, content: newMessage.trim() });

    // Auto-follow mentioned users
    if (users && mentionedNames.length > 0) {
      for (const name of mentionedNames) {
        const mentionedUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        if (mentionedUser && mentionedUser.id !== user?.id) {
          try {
            await addFollower.mutateAsync({ itemId: taskId, userId: mentionedUser.id, listId });
          } catch {
            // Ignore if already a follower
          }
        }
      }
    }

    setNewMessage('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    await deleteComment.mutateAsync({ commentId, itemId: taskId });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    setShowFilePickerModal(false);
    try {
      for (const file of Array.from(files)) {
        await uploadAttachment.mutateAsync({ itemId: taskId, file });
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setUploadingFile(false);
      event.target.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionActive && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => Math.min(i + 1, filteredUsers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(filteredUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionActive(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Split attachments into media and documents
  const mediaAttachments = (attachments || []).filter(a => a.file_type === 'image' || a.file_type === 'video');
  const docAttachments = (attachments || []).filter(a => a.file_type !== 'image' && a.file_type !== 'video');

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
        <div
          className="bg-white w-full sm:rounded-xl sm:max-w-2xl sm:w-full h-[95vh] sm:h-[85vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-bold text-gray-900 w-full px-2 py-1 border border-blue-400 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') { setEditTitle(task.title); setIsEditingTitle(false); }
                    }}
                  />
                ) : (
                  <h2
                    className="text-lg font-bold text-gray-900 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {task.title}
                    <Edit3 className="w-3.5 h-3.5 inline ml-2 text-gray-400" />
                  </h2>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {list?.title} / {section?.title}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 flex flex-shrink-0">
            {(['chat', 'details', 'files'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab === 'chat' && <MessageSquare className="w-4 h-4" />}
                {tab === 'details' && <Clock className="w-4 h-4" />}
                {tab === 'files' && <Paperclip className="w-4 h-4" />}
                <span className="capitalize">{tab}</span>
                {tab === 'files' && (attachments?.length || 0) > 0 && (
                  <span className="bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">{attachments?.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ===== CHAT TAB ===== */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {commentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : comments && comments.length > 0 ? (
                    comments.map(comment => (
                      <div key={comment.id} className="group">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {comment.user?.avatar_url ? (
                                <img src={comment.user.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className={`w-6 h-6 rounded-full ${getAvatarColor(comment.user_id)} flex items-center justify-center`}>
                                  <span className="text-[10px] font-medium text-white">
                                    {getInitials(comment.user?.full_name || null)}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {comment.user?.full_name || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            {user?.id === comment.user_id && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Inline image */}
                          {comment.file_url && comment.file_type === 'image' && (
                            <button
                              onClick={() => setLightboxMedia({ url: comment.file_url!, isVideo: false })}
                              className="mb-2 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer max-w-xs block"
                            >
                              <img src={comment.file_url} alt={comment.file_name || 'Image'} className="w-full h-auto max-h-48 object-cover" />
                            </button>
                          )}

                          {/* Inline video */}
                          {comment.file_url && comment.file_type === 'video' && (
                            <div className="mb-2 max-w-sm">
                              <InlineVideoPlayer src={comment.file_url} className="w-full aspect-video" />
                            </div>
                          )}

                          {/* File link */}
                          {comment.file_url && comment.file_type !== 'image' && comment.file_type !== 'video' && (
                            <a
                              href={comment.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mb-2 flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-blue-50 transition-colors max-w-xs"
                            >
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="text-sm text-blue-700 truncate">{comment.file_name || 'Download file'}</span>
                            </a>
                          )}

                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderCommentContent(comment.content)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <MessageSquare className="w-10 h-10 mb-3" />
                      <p className="text-sm font-medium">No messages yet</p>
                      <p className="text-xs">Start the conversation below</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Sticky message composer */}
                <div className="border-t border-gray-200 p-3 bg-white flex-shrink-0">
                  {/* Hidden file inputs */}
                  <input ref={cameraInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*" capture="environment" />
                  <input ref={photoInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
                  <input ref={documentInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.xls,.xlsx" />

                  {uploadingFile && (
                    <div className="mb-2 text-xs text-blue-600 flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Uploading file...
                    </div>
                  )}

                  <div className="flex gap-1.5 items-end">
                    <button
                      onClick={() => setShowFilePickerModal(true)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                      title="Attach file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 relative">
                      <textarea
                        ref={messageTextareaRef}
                        value={newMessage}
                        onChange={handleMessageTextChange}
                        placeholder="Type a message... (use @ to mention)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                        rows={1}
                        onKeyDown={handleKeyDown}
                        style={{ minHeight: '38px', maxHeight: '100px' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                        }}
                      />
                      {mentionActive && filteredUsers.length > 0 && (
                        <div className="absolute bottom-full mb-1 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
                          {filteredUsers.map((filteredUser, idx) => (
                            <button
                              key={filteredUser.id}
                              type="button"
                              onClick={() => selectMention(filteredUser)}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                                idx === mentionIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-blue-700">
                                  {filteredUser.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="truncate">{filteredUser.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={addComment.isPending || !newMessage.trim()}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {addComment.isPending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== DETAILS TAB ===== */}
            {activeTab === 'details' && (
              <div className="p-4 sm:p-6 space-y-6">
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
                        onChange={(e) => updateItem.mutateAsync({ id: task.id, listId, due_date: e.target.value || null })}
                        className={`text-sm font-medium bg-transparent border-none focus:ring-0 ${isOverdue ? 'text-red-700' : 'text-gray-700'}`}
                      />
                    </div>
                    {isOverdue && <p className="text-xs text-red-600 mt-1">This task is overdue!</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Priority</label>
                    <button
                      onClick={() => updateItem.mutateAsync({ id: task.id, listId, is_high_priority: !task.is_high_priority })}
                      disabled={updateItem.isPending}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                        task.is_high_priority
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${task.is_high_priority ? 'bg-red-500' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium">{task.is_high_priority ? 'High Priority' : 'Normal'}</span>
                    </button>
                  </div>
                </div>

                {/* Repeat / Recurrence */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Repeat</label>
                  <select
                    value={task.recurrence_rule || 'none'}
                    onChange={async (e) => {
                      const rule = e.target.value === 'none' ? null : e.target.value;
                      await updateRecurrence.mutateAsync({
                        id: task.id,
                        listId,
                        recurrence_rule: rule,
                        recurrence_interval: rule ? 1 : null,
                        recurrence_days: null,
                        recurrence_end_date: task.recurrence_end_date || null,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>

                  {task.recurrence_rule === 'custom' && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                        <button
                          key={day}
                          onClick={async () => {
                            const currentDays = task.recurrence_days || [];
                            const newDays = currentDays.includes(day)
                              ? currentDays.filter(d => d !== day)
                              : [...currentDays, day];
                            await updateRecurrence.mutateAsync({
                              id: task.id,
                              listId,
                              recurrence_rule: 'custom',
                              recurrence_interval: task.recurrence_interval,
                              recurrence_days: newDays.length > 0 ? newDays : null,
                              recurrence_end_date: task.recurrence_end_date || null,
                            });
                          }}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            (task.recurrence_days || []).includes(day)
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {day.charAt(0).toUpperCase() + day.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}

                  {task.recurrence_rule && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-500">End date (optional)</label>
                      <input
                        type="date"
                        value={task.recurrence_end_date || ''}
                        onChange={async (e) => {
                          await updateRecurrence.mutateAsync({
                            id: task.id,
                            listId,
                            recurrence_rule: task.recurrence_rule,
                            recurrence_interval: task.recurrence_interval,
                            recurrence_days: task.recurrence_days,
                            recurrence_end_date: e.target.value || null,
                          });
                        }}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                      />
                    </div>
                  )}

                  {task.recurrence_parent_id && (
                    <p className="text-xs text-gray-400 mt-1">
                      This is a recurring instance
                    </p>
                  )}
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
                      <button onClick={() => setIsEditingDescription(true)} className="text-xs text-blue-600 hover:text-blue-700">Edit</button>
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
                        <button onClick={() => { setEditDescription(task.description || ''); setIsEditingDescription(false); }} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button onClick={handleSaveDescription} disabled={updateItem.isPending} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
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
                      <button onClick={() => setIsEditingNotes(true)} className="text-xs text-blue-600 hover:text-blue-700">Edit</button>
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
                        <button onClick={() => { setEditNotes(task.notes || ''); setIsEditingNotes(false); }} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                        <button onClick={handleSaveNotes} disabled={updateItem.isPending} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
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
                  <div className="flex flex-wrap gap-2">
                    {task.status !== 'done' && (
                      <button onClick={() => handleStatusChange('done')} disabled={updateStatus.isPending} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> Mark Complete
                      </button>
                    )}
                    {task.status === 'todo' && (
                      <button onClick={() => handleStatusChange('in_progress')} disabled={updateStatus.isPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        <Clock className="w-4 h-4" /> Start Working
                      </button>
                    )}
                    {task.status === 'done' && (
                      <button onClick={() => handleStatusChange('todo')} disabled={updateStatus.isPending} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
                        <Clock className="w-4 h-4" /> Reopen Task
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===== FILES TAB ===== */}
            {activeTab === 'files' && (
              <div className="p-4 sm:p-6">
                {/* Upload button */}
                <div className="mb-4">
                  <input ref={cameraInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*" capture="environment" />
                  <input ref={photoInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*" />
                  <input ref={documentInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.xls,.xlsx" />

                  <div className="flex gap-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
                    >
                      <Camera className="w-4 h-4" /> Camera
                    </button>
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                    >
                      <Image className="w-4 h-4" /> Gallery
                    </button>
                    <button
                      onClick={() => documentInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                    >
                      <FileText className="w-4 h-4" /> Document
                    </button>
                  </div>

                  {uploadingFile && (
                    <div className="mt-2 text-xs text-blue-600 flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Uploading...
                    </div>
                  )}
                </div>

                {(!attachments || attachments.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Paperclip className="w-10 h-10 mb-3" />
                    <p className="text-sm font-medium">No files attached</p>
                    <p className="text-xs">Use the buttons above to add photos or documents</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Media grid */}
                    {mediaAttachments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Photos & Videos</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {mediaAttachments.map((att) => (
                            <MediaThumbnail
                              key={att.id}
                              attachment={att}
                              onClick={() => setLightboxMedia({ url: att.file_url, isVideo: att.file_type === 'video' })}
                              onDelete={() => deleteAttachment.mutate({ attachmentId: att.id, itemId: taskId })}
                              canDelete={att.uploaded_by === user?.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document list */}
                    {docAttachments.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Documents</h4>
                        <div className="space-y-2">
                          {docAttachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                              <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block">
                                  {att.file_name}
                                </a>
                                <span className="text-xs text-gray-500">{formatFileSize(att.file_size)}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors">
                                  <Download className="w-4 h-4" />
                                </a>
                                {att.uploaded_by === user?.id && (
                                  <button
                                    onClick={() => deleteAttachment.mutate({ attachmentId: att.id, itemId: taskId })}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File picker bottom sheet (mobile) */}
      {showFilePickerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-[60]" onClick={() => setShowFilePickerModal(false)}>
          <div className="bg-white rounded-t-xl shadow-xl w-full max-w-lg p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Attach File</h3>
              <button onClick={() => setShowFilePickerModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setShowFilePickerModal(false); cameraInputRef.current?.click(); }}
                className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors border-2 border-purple-200"
              >
                <Camera className="w-7 h-7 text-purple-600" />
                <span className="text-xs font-medium text-purple-900">Camera</span>
              </button>
              <button
                onClick={() => { setShowFilePickerModal(false); photoInputRef.current?.click(); }}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border-2 border-blue-200"
              >
                <Image className="w-7 h-7 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Gallery</span>
              </button>
              <button
                onClick={() => { setShowFilePickerModal(false); documentInputRef.current?.click(); }}
                className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border-2 border-green-200"
              >
                <FileText className="w-7 h-7 text-green-600" />
                <span className="text-xs font-medium text-green-900">Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[70] p-4" onClick={() => setLightboxMedia(null)}>
          <button onClick={() => setLightboxMedia(null)} className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors z-10">
            <X className="w-8 h-8" />
          </button>
          {lightboxMedia.isVideo ? (
            <video src={lightboxMedia.url} className="max-w-full max-h-full object-contain rounded-lg" controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={lightboxMedia.url} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  );
}

// Media thumbnail component for files tab
function MediaThumbnail({ attachment, onClick, onDelete, canDelete }: {
  attachment: TodoItemAttachment;
  onClick: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const isVideo = attachment.file_type === 'video' || isVideoUrl(attachment.file_url);

  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer bg-gray-100">
      {isVideo ? (
        <div className="w-full h-full relative bg-gray-900" onClick={onClick}>
          <video src={attachment.file_url} className="w-full h-full object-cover" muted preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center">
              <Play className="w-5 h-5 text-gray-800 ml-0.5" />
            </div>
          </div>
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px] flex items-center gap-1">
            <Video className="w-3 h-3" /> Video
          </div>
        </div>
      ) : (
        <button onClick={onClick} className="w-full h-full">
          <img src={attachment.file_url} alt={attachment.file_name} className="w-full h-full object-cover" />
        </button>
      )}
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
