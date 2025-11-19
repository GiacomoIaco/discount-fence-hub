import { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, TrendingUp, Plus, FileDown } from 'lucide-react';
import { useInitiativeQuery, useCreateInitiative, useUpdateInitiative } from '../hooks/useLeadershipQuery';
import { exportInitiativePDF } from '../lib/pdfExport';
import {
  useQuarterlyObjectivesQuery,
  useCreateQuarterlyObjective,
  useDeleteQuarterlyObjective,
} from '../hooks/useOperatingPlanQuery';
import { useAuth } from '../../../contexts/AuthContext';
import type { CreateInitiativeInput, UpdateInitiativeInput } from '../lib/leadership';

interface InitiativeDetailModalProps {
  initiativeId?: string;
  areaId?: string;
  onClose: () => void;
}

export default function InitiativeDetailModal({ initiativeId, areaId, onClose }: InitiativeDetailModalProps) {
  const { user } = useAuth();
  const isCreating = !initiativeId;

  const { data: initiative, isLoading } = useInitiativeQuery(initiativeId);
  const createInitiative = useCreateInitiative();
  const updateInitiative = useUpdateInitiative();

  // Quarterly objectives hooks
  const currentYear = new Date().getFullYear();
  const { data: quarterlyObjectives } = useQuarterlyObjectivesQuery(initiativeId || '', currentYear);
  const createObjective = useCreateQuarterlyObjective();
  const deleteObjective = useDeleteQuarterlyObjective();

  const [formData, setFormData] = useState<Partial<CreateInitiativeInput>>({
    area_id: areaId || '',
    title: '',
    description: '',
    success_criteria: '',
    annual_target: '',
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
  const [newObjective, setNewObjective] = useState({ quarter: 1, objective_text: '' });

  useEffect(() => {
    if (initiative && !isCreating) {
      setFormData({
        area_id: initiative.area_id,
        title: initiative.title,
        description: initiative.description || '',
        success_criteria: initiative.success_criteria || '',
        annual_target: initiative.annual_target || '',
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
      // Clean up form data - convert empty strings to undefined
      const cleanedData = {
        ...formData,
        target_date: formData.target_date || undefined,
        target_week: formData.target_week || undefined,
        target_quarter: formData.target_quarter || undefined,
        description: formData.description || undefined,
        success_criteria: formData.success_criteria || undefined,
        annual_target: formData.annual_target || undefined,
        assigned_to: formData.assigned_to || undefined,
      };

      if (isCreating) {
        await createInitiative.mutateAsync(cleanedData as CreateInitiativeInput);
        onClose();
      } else if (initiativeId) {
        await updateInitiative.mutateAsync({
          id: initiativeId,
          ...cleanedData,
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

  const handleExportPDF = () => {
    if (initiative) {
      exportInitiativePDF(initiative);
    }
  };

  const handleAddObjective = async () => {
    if (!initiativeId || !newObjective.objective_text.trim()) return;

    try {
      await createObjective.mutateAsync({
        initiative_id: initiativeId,
        year: currentYear,
        quarter: newObjective.quarter,
        objective_text: newObjective.objective_text,
      });
      setNewObjective({ quarter: 1, objective_text: '' });
    } catch (error) {
      console.error('Failed to add quarterly objective:', error);
    }
  };

  const handleDeleteObjective = async (objectiveId: string) => {
    try {
      await deleteObjective.mutateAsync(objectiveId);
    } catch (error) {
      console.error('Failed to delete quarterly objective:', error);
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
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Export to PDF"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="text-sm">Export</span>
                </button>
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

          {/* Hidden fields - now managed through Annual Plan tab
          Success Criteria - managed through annual actions
          Annual Target - managed through annual targets table
          */}

          {/* Status and Target Date in a grid */}
          <div className="grid grid-cols-2 gap-4">
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

            {/* Target Date (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Target Date (optional)
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!isEditing}
                />
              ) : (
                <p className="text-gray-900">
                  {formData.target_date
                    ? new Date(formData.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No target date set'}
                </p>
              )}
            </div>
          </div>

          {/* Quarterly Objectives Section */}
          {!isCreating && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Quarterly Objectives ({currentYear})</h3>
              </div>

              {/* Existing Quarterly Objectives */}
              {quarterlyObjectives && quarterlyObjectives.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {[1, 2, 3, 4].map((quarter) => {
                    const objective = quarterlyObjectives.find(o => o.quarter === quarter);
                    return objective ? (
                      <div
                        key={objective.id}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-blue-600 mb-1">
                            Q{quarter} {currentYear}
                          </div>
                          <div className="text-sm text-gray-900">
                            {objective.objective_text}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteObjective(objective.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Delete objective"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-3">No quarterly objectives defined yet</p>
              )}

              {/* Add New Quarterly Objective */}
              <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-700">Quarter:</label>
                  <select
                    value={newObjective.quarter}
                    onChange={(e) => setNewObjective({ ...newObjective, quarter: Number(e.target.value) })}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </div>
                <textarea
                  value={newObjective.objective_text}
                  onChange={(e) => setNewObjective({ ...newObjective, objective_text: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="What should be achieved in this quarter?"
                />
                <button
                  onClick={handleAddObjective}
                  disabled={!newObjective.objective_text.trim()}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Quarterly Objective
                </button>
              </div>
            </div>
          )}

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
