import { useState } from 'react';
import { Plus, Target, TrendingUp, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { useFunctionsQuery } from '../../hooks/useLeadershipQuery';
import {
  useAnnualGoalsWithQuarterlyQuery,
  useCreateAnnualGoal,
  useUpdateAnnualGoal,
  useDeleteAnnualGoal
} from '../../hooks/useGoalsQuery';
import type { CreateAnnualGoalInput, AnnualGoal } from '../../lib/goals.types';
import { validateWeights, isHighWeightGoal } from '../../lib/goals.types';

export default function AnnualGoalPlanning() {
  const currentYear = new Date().getFullYear();
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<AnnualGoal | null>(null);

  const { data: functions } = useFunctionsQuery();
  const { data: goals, isLoading } = useAnnualGoalsWithQuarterlyQuery(selectedFunctionId || undefined, selectedYear);
  const createGoal = useCreateAnnualGoal();
  const updateGoal = useUpdateAnnualGoal();
  const deleteGoal = useDeleteAnnualGoal();

  const [formData, setFormData] = useState<CreateAnnualGoalInput>({
    function_id: '',
    year: currentYear,
    title: '',
    description: '',
    target: '',
    weight: 0,
    sort_order: 0,
  });

  const totalWeight = goals?.filter(g => g.status === 'active').reduce((sum, g) => sum + g.weight, 0) || 0;
  const isWeightValid = totalWeight === 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFunctionId) return;

    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          ...formData,
        });
        setEditingGoal(null);
      } else {
        await createGoal.mutateAsync({
          ...formData,
          function_id: selectedFunctionId,
          year: selectedYear,
        });
      }

      setIsCreating(false);
      setFormData({
        function_id: '',
        year: currentYear,
        title: '',
        description: '',
        target: '',
        weight: 0,
        sort_order: 0,
      });
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  const handleEdit = (goal: AnnualGoal) => {
    setEditingGoal(goal);
    setFormData({
      function_id: goal.function_id,
      year: goal.year,
      title: goal.title,
      description: goal.description || '',
      target: goal.target || '',
      weight: goal.weight,
      sort_order: goal.sort_order,
    });
    setIsCreating(true);
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal? This will also delete all quarterly goals.')) return;

    try {
      await deleteGoal.mutateAsync(goalId);
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingGoal(null);
    setFormData({
      function_id: '',
      year: currentYear,
      title: '',
      description: '',
      target: '',
      weight: 0,
      sort_order: 0,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Annual Goal Planning</h1>
        <p className="text-gray-600">
          Set strategic goals for each function with priority weights (must total 100%)
        </p>
      </div>

      {/* Function and Year Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Function
            </label>
            <select
              value={selectedFunctionId || ''}
              onChange={(e) => setSelectedFunctionId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a function...</option>
              {functions?.map((func) => (
                <option key={func.id} value={func.id}>
                  {func.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedFunctionId ? (
        <>
          {/* Weight Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Weight Summary</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Total weight must equal 100% to ensure balanced focus
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-3xl font-bold" style={{ color: isWeightValid ? '#10b981' : '#ef4444' }}>
                    {totalWeight}%
                  </div>
                  <div className="text-sm text-gray-500">of 100%</div>
                </div>
                {isWeightValid ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(totalWeight, 100)}%`,
                    backgroundColor: isWeightValid ? '#10b981' : totalWeight > 100 ? '#ef4444' : '#3b82f6',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Goals List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading goals...</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {goals && goals.length > 0 ? (
                goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* Weight Badge */}
                      <div className="flex-shrink-0">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                            isHighWeightGoal(goal.weight)
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {goal.weight}%
                        </div>
                      </div>

                      {/* Goal Content */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">{goal.title}</h3>
                            {isHighWeightGoal(goal.weight) && (
                              <span className="text-orange-500" title="High Priority Goal">
                                🔥
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(goal)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit goal"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(goal.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete goal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {goal.description && (
                          <p className="text-gray-600 mb-3">{goal.description}</p>
                        )}

                        <div className="flex items-center gap-6 text-sm">
                          {goal.target && (
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-700">Target: {goal.target}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">
                              Achievement: {goal.achievement_percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Quarterly Goals Preview */}
                        {goal.quarterly_goals && goal.quarterly_goals.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              <span className="font-medium">Quarterly Breakdown:</span>
                              <span>{goal.quarterly_goals.length} quarters planned</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
                  <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No goals yet</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first annual goal for {selectedYear}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Create/Edit Form */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Annual Goal
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingGoal ? 'Edit Goal' : 'Create New Goal'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Reduce operational costs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Describe the goal and its importance..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target
                    </label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., -15% cost reduction"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight % *
                    </label>
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="100"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Remaining: {100 - (totalWeight - (editingGoal?.weight || 0))}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {editingGoal ? 'Update Goal' : 'Create Goal'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
          <Target className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Function</h3>
          <p className="text-gray-600">
            Choose a function above to view and manage its annual goals
          </p>
        </div>
      )}
    </div>
  );
}
