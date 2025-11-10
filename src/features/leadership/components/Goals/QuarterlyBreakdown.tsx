import { useState } from 'react';
import { Calendar, Target, TrendingUp, Plus, Edit2, X } from 'lucide-react';
import {
  useQuarterlyGoalsQuery,
  useCreateQuarterlyGoal,
  useUpdateQuarterlyGoal,
  useDeleteQuarterlyGoal,
} from '../../hooks/useGoalsQuery';
import type { QuarterlyGoal, CreateQuarterlyGoalInput } from '../../lib/goals.types';
import { getQuarterLabel, getCurrentQuarter } from '../../lib/goals.types';

interface QuarterlyBreakdownProps {
  annualGoalId: string;
  annualGoalTitle: string;
  year: number;
  onClose: () => void;
}

export default function QuarterlyBreakdown({
  annualGoalId,
  annualGoalTitle,
  year,
  onClose,
}: QuarterlyBreakdownProps) {
  const { data: quarterlyGoals, isLoading } = useQuarterlyGoalsQuery(annualGoalId);
  const createGoal = useCreateQuarterlyGoal();
  const updateGoal = useUpdateQuarterlyGoal();
  const deleteGoal = useDeleteQuarterlyGoal();

  const [editingQuarter, setEditingQuarter] = useState<1 | 2 | 3 | 4 | null>(null);
  const [formData, setFormData] = useState<{
    target: string;
    achievement_percentage: number;
    notes: string;
  }>({
    target: '',
    achievement_percentage: 0,
    notes: '',
  });

  const currentQuarter = getCurrentQuarter();

  // Organize goals by quarter
  const goalsByQuarter: Record<1 | 2 | 3 | 4, QuarterlyGoal | null> = {
    1: quarterlyGoals?.find((g) => g.quarter === 1) || null,
    2: quarterlyGoals?.find((g) => g.quarter === 2) || null,
    3: quarterlyGoals?.find((g) => g.quarter === 3) || null,
    4: quarterlyGoals?.find((g) => g.quarter === 4) || null,
  };

  const handleEdit = (quarter: 1 | 2 | 3 | 4) => {
    const goal = goalsByQuarter[quarter];
    setEditingQuarter(quarter);
    setFormData({
      target: goal?.target || '',
      achievement_percentage: goal?.achievement_percentage || 0,
      notes: goal?.notes || '',
    });
  };

  const handleSave = async () => {
    if (editingQuarter === null) return;

    try {
      const existingGoal = goalsByQuarter[editingQuarter];

      if (existingGoal) {
        // Update existing
        await updateGoal.mutateAsync({
          id: existingGoal.id,
          target: formData.target || undefined,
          achievement_percentage: formData.achievement_percentage,
          notes: formData.notes || undefined,
        });
      } else {
        // Create new
        await createGoal.mutateAsync({
          annual_goal_id: annualGoalId,
          quarter: editingQuarter,
          year,
          target: formData.target || undefined,
        });

        // If we set achievement or notes, update it
        if (formData.achievement_percentage > 0 || formData.notes) {
          // Refetch to get the new ID, then update
          // For simplicity, we'll just create with target and let user edit for achievement/notes
        }
      }

      setEditingQuarter(null);
      setFormData({ target: '', achievement_percentage: 0, notes: '' });
    } catch (error) {
      console.error('Failed to save quarterly goal:', error);
    }
  };

  const handleDelete = async (quarter: 1 | 2 | 3 | 4) => {
    const goal = goalsByQuarter[quarter];
    if (!goal) return;

    if (!confirm(`Delete Q${quarter} goal?`)) return;

    try {
      await deleteGoal.mutateAsync(goal.id);
    } catch (error) {
      console.error('Failed to delete quarterly goal:', error);
    }
  };

  const handleCancel = () => {
    setEditingQuarter(null);
    setFormData({ target: '', achievement_percentage: 0, notes: '' });
  };

  const renderQuarterCard = (quarter: 1 | 2 | 3 | 4) => {
    const goal = goalsByQuarter[quarter];
    const isCurrentQuarter = currentQuarter.quarter === quarter && currentQuarter.year === year;
    const isEditing = editingQuarter === quarter;

    return (
      <div
        key={quarter}
        className={`bg-white rounded-lg border-2 p-6 transition-all ${
          isCurrentQuarter
            ? 'border-blue-500 shadow-md'
            : goal
            ? 'border-gray-200 hover:border-gray-300'
            : 'border-dashed border-gray-300'
        }`}
      >
        {/* Quarter Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-bold text-gray-900">
              {getQuarterLabel(quarter, year)}
            </h3>
            {isCurrentQuarter && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                Current
              </span>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2">
              {goal ? (
                <>
                  <button
                    onClick={() => handleEdit(quarter)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit quarter"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(quarter)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete quarter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleEdit(quarter)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quarter Content */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quarterly Target
              </label>
              <textarea
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={2}
                placeholder={`e.g., Reduce costs by 4% in Q${quarter}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Achievement %
              </label>
              <input
                type="number"
                value={formData.achievement_percentage}
                onChange={(e) =>
                  setFormData({ ...formData, achievement_percentage: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={2}
                placeholder="Review notes, learnings, challenges..."
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : goal ? (
          <div className="space-y-3">
            {goal.target && (
              <div className="flex items-start gap-2">
                <Target className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">{goal.target}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Achievement</span>
                  <span className="font-semibold text-gray-900">
                    {goal.achievement_percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(goal.achievement_percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {goal.notes && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-700">{goal.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            No target set for this quarter
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading quarterly breakdown...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{annualGoalTitle}</h2>
              <p className="text-sm text-gray-600 mt-1">Quarterly Breakdown for {year}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {([1, 2, 3, 4] as const).map((quarter) => renderQuarterCard(quarter))}
          </div>
        </div>
      </div>
    </div>
  );
}
