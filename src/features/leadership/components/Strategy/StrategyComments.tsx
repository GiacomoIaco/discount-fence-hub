import { useState } from 'react';
import { MessageSquare, Trash2, Check, X } from 'lucide-react';
import { useStrategyCommentsQuery, useCreateComment, useUpdateComment, useDeleteComment } from '../../hooks/useLeadershipQuery';
import { StrategySection } from '../../lib/leadership';
import { useAuth } from '../../../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface StrategyCommentsProps {
  functionId: string;
}

const sectionLabels: Record<StrategySection, string> = {
  description: 'Function Description',
  objectives: 'Core Objectives',
  current_situation: 'Current Situation',
  challenges: 'Key Challenges',
  opportunities: 'Key Opportunities',
  operating_plan: 'Operating Plan',
  general: 'General',
};

export default function StrategyComments({ functionId }: StrategyCommentsProps) {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useStrategyCommentsQuery(functionId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [newComment, setNewComment] = useState('');
  const [selectedSection, setSelectedSection] = useState<StrategySection>('general');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({
        function_id: functionId,
        section: selectedSection,
        comment: newComment,
      });
      setNewComment('');
      setSelectedSection('general');
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await deleteComment.mutateAsync({ id: commentId, function_id: functionId });
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleToggleResolve = async (commentId: string, isResolved: boolean) => {
    try {
      await updateComment.mutateAsync({
        id: commentId,
        function_id: functionId,
        is_resolved: !isResolved,
      });
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  // Separate resolved and unresolved comments
  const unresolvedComments = comments.filter(c => !c.is_resolved);
  const resolvedComments = comments.filter(c => c.is_resolved);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading comments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Comment Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Add Comment or Feedback
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value as StrategySection)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {Object.entries(sectionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add your feedback or comment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || createComment.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {createComment.isPending ? 'Adding...' : 'Add Comment'}
          </button>
        </form>
      </div>

      {/* Unresolved Comments */}
      {unresolvedComments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Open Comments ({unresolvedComments.length})
          </h3>
          {unresolvedComments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {comment.author?.avatar_url ? (
                    <img
                      src={comment.author.avatar_url}
                      alt={comment.author.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {comment.author?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {comment.author?.full_name || 'Unknown User'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      {comment.section && comment.section !== 'general' && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {sectionLabels[comment.section]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleResolve(comment.id, comment.is_resolved)}
                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Mark as resolved"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  {user?.id === comment.created_by && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {comment.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Resolved Comments */}
      {resolvedComments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Resolved ({resolvedComments.length})
          </h3>
          {resolvedComments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 rounded-lg border border-gray-200 p-4 opacity-75"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {comment.author?.avatar_url ? (
                    <img
                      src={comment.author.avatar_url}
                      alt={comment.author.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {comment.author?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {comment.author?.full_name || 'Unknown User'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      {comment.section && comment.section !== 'general' && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {sectionLabels[comment.section]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleResolve(comment.id, comment.is_resolved)}
                    className="p-1 text-green-600 hover:text-gray-400 transition-colors"
                    title="Mark as unresolved"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {user?.id === comment.created_by && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-through">
                {comment.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {comments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm">No comments yet. Add feedback to start the conversation.</p>
        </div>
      )}
    </div>
  );
}
