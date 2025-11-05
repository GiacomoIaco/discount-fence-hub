import { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, User, Flag, TrendingUp } from 'lucide-react';
import { useInitiativeQuery, useCreateInitiative, useUpdateInitiative } from '../hooks/useLeadershipQuery';
import { useAuth } from '../../../contexts/AuthContext';
import type { CreateInitiativeInput, UpdateInitiativeInput } from '../lib/leadership';

interface InitiativeDetailModalProps {
  initiativeId?: string;
  bucketId?: string;
  onClose: () => void;
}

export default function InitiativeDetailModal({ initiativeId, bucketId, onClose }: InitiativeDetailModalProps) {
  const { user } = useAuth();
  const isCreating = !initiativeId;

  const { data: initiative, isLoading } = useInitiativeQuery(initiativeId);
  const createInitiative = useCreateInitiative();
  const updateInitiative = useUpdateInitiative();

  const [formData, setFormData] = useState<Partial<CreateInitiativeInput>>({
    bucket_id: bucketId || '',
    title: '',
    description: '',
    success_criteria: '',
    assigned_to: user?.id || '',
    status: 'not_started',
    priority: 'medium',
    target_type: 'date',
    target_date: '',
    target_week: '',
    target_quarter: '',
    progress_percent: 0,
  });

  const [isEditing, setIsEditing] = useState(isCreating);

  useEffect(() => {
    if (initiative && !isCreating) {
      setFormData({
        bucket_id: initiative.bucket_id,
        title: initiative.title,
        description: initiative.description || '',
        success_criteria: initiative.success_criteria || '',
        assigned_to: initiative.assigned_to || '',
        status: initiative.status,
        priority: initiative.priority,
        target_type: initiative.target_type || 'date',
        target_date: initiative.target_date || '',
        target_week: initiative.target_week || '',
        target_quarter: initiative.target_quarter || '',
        progress_percent: initiative.progress_percent,
      });
    }
  }, [initiative, isCreating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isCreating) {
        await createInitiative.mutateAsync(formData as CreateInitiativeInput);
        onClose();
      } else if (initiativeId) {
        await updateInitiative.mutateAsync({
          id: initiativeId,
          ...formData,
        } as UpdateInitiativeInput);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save initiative:', error);
    }
  };

  const handleArchive = async () => {
    if (!initiativeId || !window.confirm('Are you sure you want to archive this initiative?')) return;

    try {
      await updateInitiative.mutateAsync({
        id: initiativeId,
        archived_at: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to archive initiative:', error);
    }
  };

  if (isLoading && !isCreating) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading initiative...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isCreating ? 'Create Initiative' : isEditing ? 'Edit Initiative' : 'Initiative Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isCreating && !isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleArchive}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Archive initiative"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={!isEditing}
              />
            ) : (
              <p className="text-gray-900 text-lg">{formData.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            {isEditing ? (
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                disabled={!isEditing}
              />
            ) : (
              <p className="text-gray-700">{formData.description || 'No description'}</p>
            )}
          </div>

          {/* Success Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Success Criteria
            </label>
            {isEditing ? (
              <textarea
                value={formData.success_criteria}
                onChange={(e) => setFormData({ ...formData, success_criteria: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="What defines success for this initiative?"
                disabled={!isEditing}
              />
            ) : (
              <p className="text-gray-700">{formData.success_criteria || 'No criteria defined'}</p>
            )}
          </div>

          {/* Status, Priority, Progress in a grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Status
              </label>
              {isEditing ? (
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEditing}
                >
                  <option value="not_started">Not Started</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="at_risk">At Risk</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <p className="text-gray-900 capitalize">{formData.status?.replace('_', ' ')}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Flag className="w-4 h-4 inline mr-1" />
                Priority
              </label>
              {isEditing ? (
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEditing}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              ) : (
                <p className="text-gray-900 capitalize">{formData.priority}</p>
              )}
            </div>

            {/* Progress */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Progress %
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.progress_percent}
                  onChange={(e) => setFormData({ ...formData, progress_percent: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEditing}
                />
              ) : (
                <p className="text-gray-900">{formData.progress_percent}%</p>
              )}
            </div>
          </div>

          {/* Target Type and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Type
              </label>
              {isEditing ? (
                <select
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEditing}
                >
                  <option value="date">Specific Date</option>
                  <option value="week">Week</option>
                  <option value="quarter">Quarter</option>
                  <option value="ongoing">Ongoing</option>
                </select>
              ) : (
                <p className="text-gray-900 capitalize">{formData.target_type?.replace('_', ' ')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Target
              </label>
              {isEditing ? (
                <>
                  {formData.target_type === 'date' && (
                    <input
                      type="date"
                      value={formData.target_date}
                      onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!isEditing}
                    />
                  )}
                  {formData.target_type === 'week' && (
                    <input
                      type="text"
                      value={formData.target_week}
                      onChange={(e) => setFormData({ ...formData, target_week: e.target.value })}
                      placeholder="e.g., Week 24"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!isEditing}
                    />
                  )}
                  {formData.target_type === 'quarter' && (
                    <input
                      type="text"
                      value={formData.target_quarter}
                      onChange={(e) => setFormData({ ...formData, target_quarter: e.target.value })}
                      placeholder="e.g., Q1 2025"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!isEditing}
                    />
                  )}
                  {formData.target_type === 'ongoing' && (
                    <p className="text-gray-500 px-3 py-2">No specific target date</p>
                  )}
                </>
              ) : (
                <p className="text-gray-900">
                  {formData.target_date && new Date(formData.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {formData.target_week && formData.target_week}
                  {formData.target_quarter && formData.target_quarter}
                  {formData.target_type === 'ongoing' && 'Ongoing'}
                  {!formData.target_date && !formData.target_week && !formData.target_quarter && formData.target_type !== 'ongoing' && 'Not set'}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={createInitiative.isPending || updateInitiative.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {createInitiative.isPending || updateInitiative.isPending ? 'Saving...' : 'Save'}
              </button>
              {!isCreating && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
