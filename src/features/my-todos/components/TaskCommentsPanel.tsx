import { useState, useRef, useMemo } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { useTodoItemCommentsQuery, useAddTodoItemComment, useDeleteTodoItemComment, useAddTodoItemFollower } from '../hooks/useTodoItems';
import { useAuth } from '../../../contexts/AuthContext';
import { getInitials } from '../../../lib/stringUtils';
import { useUsers } from '../../requests/hooks/useRequests';

interface TaskCommentsPanelProps {
  taskId: string;
  listId: string;
}

const formatRelativeTime = (dateString: string): string => {
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
};

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

export default function TaskCommentsPanel({ taskId, listId }: TaskCommentsPanelProps) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useTodoItemCommentsQuery(taskId);
  const addComment = useAddTodoItemComment();
  const deleteComment = useDeleteTodoItemComment();
  const addFollower = useAddTodoItemFollower();
  const { users } = useUsers();
  const [newComment, setNewComment] = useState('');

  // Mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredUsers = useMemo(() => {
    if (!mentionActive || !users) return [];
    return users
      .filter(u => u.name.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [mentionActive, mentionQuery, users]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setNewComment(value);

    // Check if we're in a mention context
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Only activate if no space before the @ (or it's at start) and no newline in query
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
    if (!textareaRef.current) return;
    const before = newComment.substring(0, mentionStart);
    const after = newComment.substring(textareaRef.current.selectionStart);
    const newValue = `${before}@${selectedUser.name} ${after}`;
    setNewComment(newValue);
    setMentionActive(false);

    // Focus and set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionStart + selectedUser.name.length + 2; // @name + space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Parse @mentions
    const mentionPattern = /@([A-Za-z\s]+?)(?=\s@|\s*$|[.,!?])/g;
    const mentionedNames: string[] = [];
    let match;
    while ((match = mentionPattern.exec(newComment)) !== null) {
      mentionedNames.push(match[1].trim());
    }

    await addComment.mutateAsync({
      itemId: taskId,
      content: newComment.trim(),
    });

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

    setNewComment('');
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    await deleteComment.mutateAsync({ commentId, itemId: taskId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments && comments.length > 0 ? (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-3 group">
              {comment.user?.avatar_url ? (
                <img
                  src={comment.user.avatar_url}
                  alt={comment.user.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-blue-700">
                    {getInitials(comment.user?.full_name || null)}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">
                    {comment.user?.full_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                  {user?.id === comment.user_id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete comment"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderCommentContent(comment.content)}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-4 text-sm">
            No comments yet. Start the discussion!
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleTextChange}
            placeholder="Add a comment... (use @ to mention)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={2}
            onKeyDown={(e) => {
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
              // Existing Ctrl+Enter submit
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
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
          <p className="text-xs text-gray-400 mt-1">Press Ctrl+Enter to send</p>
        </div>
        <button
          type="submit"
          disabled={!newComment.trim() || addComment.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
        >
          {addComment.isPending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
