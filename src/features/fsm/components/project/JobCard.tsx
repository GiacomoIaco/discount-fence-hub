/**
 * JobCard - Unified Create/View component for Jobs
 *
 * CRITICAL UX REQUIREMENT: This component must look IDENTICAL when creating vs viewing.
 * Visits are ALWAYS visible (not on a separate page).
 *
 * Props:
 * - isEditing: true = editable fields, false = read-only
 * - job: existing job data (null for new job)
 * - onSave: callback when job is saved
 */

import { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Trash2,
  Save,
  X,
  Calendar,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import type { Job, JobVisitType, Crew, VisitStatus } from '../../types';
import { BudgetActualDisplay } from '../shared/BudgetActualDisplay';

// Visit form data
interface VisitFormData {
  id?: string;
  tempId?: string;
  visit_number: number;
  visit_type: JobVisitType;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  assigned_crew_id?: string;
  labor_hours?: number;
  labor_rate?: number;
  labor_cost?: number;
  notes?: string;
  status: VisitStatus;
}

// Job form data
interface JobFormData {
  name?: string;
  phase_number: number;
  phase_name?: string;
  scheduled_date?: string;
  assigned_crew_id?: string;
  budgeted_labor_hours?: number;
  budgeted_labor_cost?: number;
  budgeted_material_cost?: number;
  budgeted_total_cost?: number;
  notes?: string;
  internal_notes?: string;
  visits: VisitFormData[];
}

const VISIT_TYPE_OPTIONS: { value: JobVisitType; label: string }[] = [
  { value: 'initial', label: 'Initial' },
  { value: 'continuation', label: 'Continuation' },
  { value: 'rework', label: 'Rework' },
  { value: 'callback', label: 'Callback' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'warranty', label: 'Warranty' },
];

const VISIT_TYPE_COLORS: Record<JobVisitType, string> = {
  initial: 'bg-blue-100 text-blue-700',
  continuation: 'bg-gray-100 text-gray-700',
  rework: 'bg-red-100 text-red-700',
  callback: 'bg-orange-100 text-orange-700',
  inspection: 'bg-purple-100 text-purple-700',
  warranty: 'bg-yellow-100 text-yellow-700',
};

interface JobCardProps {
  /** When true, fields are editable */
  isEditing: boolean;
  /** Existing job data (null for new job) */
  job?: Job | null;
  /** Available crews for assignment */
  crews?: Crew[];
  /** Project ID for new jobs */
  projectId?: string;
  /** Callback when save is clicked */
  onSave?: (data: JobFormData) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Toggle edit mode */
  onToggleEdit?: () => void;
  /** Show compact view */
  compact?: boolean;
}

export function JobCard({
  isEditing,
  job,
  crews = [],
  projectId: _projectId,
  onSave,
  onCancel,
  onToggleEdit,
  compact = false,
}: JobCardProps) {
  const [formData, setFormData] = useState<JobFormData>({
    phase_number: 1,
    visits: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Initialize form data from job
  useEffect(() => {
    if (job) {
      setFormData({
        name: job.name || '',
        phase_number: job.phase_number || 1,
        phase_name: job.phase_name || '',
        scheduled_date: job.scheduled_date || '',
        assigned_crew_id: job.assigned_crew_id || undefined,
        budgeted_labor_hours: job.budgeted_labor_hours || undefined,
        budgeted_labor_cost: job.budgeted_labor_cost || undefined,
        budgeted_material_cost: job.budgeted_material_cost || undefined,
        budgeted_total_cost: job.budgeted_total_cost || undefined,
        notes: job.notes || '',
        internal_notes: job.internal_notes || '',
        visits: (job.visits || []).map((v) => ({
          id: v.id,
          visit_number: v.visit_number,
          visit_type: v.visit_type as JobVisitType,
          scheduled_date: v.scheduled_date || '',
          scheduled_start_time: v.scheduled_start_time || undefined,
          scheduled_end_time: v.scheduled_end_time || undefined,
          assigned_crew_id: v.assigned_crew_id || undefined,
          labor_hours: v.labor_hours || undefined,
          labor_rate: v.labor_rate || undefined,
          labor_cost: v.labor_cost || undefined,
          notes: v.notes || '',
          status: v.status as VisitStatus,
        })),
      });
    }
  }, [job]);

  // Add new visit
  const addVisit = () => {
    const nextNumber = formData.visits.length + 1;
    setFormData({
      ...formData,
      visits: [
        ...formData.visits,
        {
          tempId: `new-${Date.now()}`,
          visit_number: nextNumber,
          visit_type: nextNumber === 1 ? 'initial' : 'continuation',
          scheduled_date: formData.scheduled_date || '',
          assigned_crew_id: formData.assigned_crew_id,
          status: 'scheduled',
        },
      ],
    });
  };

  // Update visit
  const updateVisit = (
    index: number,
    field: keyof VisitFormData,
    value: string | number | undefined
  ) => {
    const updated = [...formData.visits];
    (updated[index] as Record<string, unknown>)[field] = value;

    // Auto-calculate labor_cost
    if (field === 'labor_hours' || field === 'labor_rate') {
      const hours = updated[index].labor_hours || 0;
      const rate = updated[index].labor_rate || 0;
      updated[index].labor_cost = hours * rate;
    }

    setFormData({ ...formData, visits: updated });
  };

  // Remove visit
  const removeVisit = (index: number) => {
    const updated = formData.visits.filter((_, i) => i !== index);
    // Renumber visits
    updated.forEach((v, i) => {
      v.visit_number = i + 1;
    });
    setFormData({ ...formData, visits: updated });
  };

  // Handle save
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Find crew name by ID
  const getCrewName = (crewId: string | undefined) => {
    if (!crewId) return '-';
    const crew = crews.find((c) => c.id === crewId);
    return crew?.name || '-';
  };

  // Check for rework visits
  const hasRework = formData.visits.some((v) =>
    ['rework', 'callback', 'warranty'].includes(v.visit_type)
  );

  // Calculate actual totals from visits
  const actualLaborHours = formData.visits.reduce(
    (sum, v) => sum + (v.labor_hours || 0),
    0
  );
  const actualLaborCost = formData.visits.reduce(
    (sum, v) => sum + (v.labor_cost || 0),
    0
  );

  // Compact collapsed view
  if (compact && !isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className={`bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 transition-colors ${
          hasRework ? 'border-red-200' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                job?.status === 'completed' ? 'bg-green-100' : 'bg-orange-100'
              }`}
            >
              <Wrench
                className={`w-5 h-5 ${
                  job?.status === 'completed' ? 'text-green-600' : 'text-orange-600'
                }`}
              />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {job?.job_number || 'New Job'}
              </p>
              <p className="text-sm text-gray-500">
                {formData.visits.length} visit(s)
                {formData.phase_name && ` • ${formData.phase_name}`}
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            {hasRework && (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${
        hasRework ? 'border-red-200' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              job?.status === 'completed' ? 'bg-green-100' : 'bg-orange-100'
            }`}
          >
            <Wrench
              className={`w-5 h-5 ${
                job?.status === 'completed' ? 'text-green-600' : 'text-orange-600'
              }`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {job?.job_number || 'New Job'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {job?.status && (
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                  {job.status}
                </span>
              )}
              {hasRework && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Has Rework
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {onToggleEdit && (
                <button
                  onClick={onToggleEdit}
                  className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  Edit
                </button>
              )}
              {compact && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 hover:bg-gray-200 rounded"
                >
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Job Details */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Phase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phase
            </label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formData.phase_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phase_number: Number(e.target.value) })
                  }
                  className="w-16 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
                <input
                  type="text"
                  value={formData.phase_name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phase_name: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Phase name"
                />
              </div>
            ) : (
              <p className="text-gray-900">
                Phase {formData.phase_number}
                {formData.phase_name && ` - ${formData.phase_name}`}
              </p>
            )}
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={formData.scheduled_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_date: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                {formatDate(formData.scheduled_date)}
              </p>
            )}
          </div>

          {/* Assigned Crew */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Crew
            </label>
            {isEditing ? (
              <select
                value={formData.assigned_crew_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assigned_crew_id: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select crew...</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-900 flex items-center gap-1">
                <Users className="w-4 h-4 text-gray-400" />
                {getCrewName(formData.assigned_crew_id)}
              </p>
            )}
          </div>

          {/* Budgeted Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budgeted Hours
            </label>
            {isEditing ? (
              <input
                type="number"
                value={formData.budgeted_labor_hours || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    budgeted_labor_hours: Number(e.target.value) || undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.5"
              />
            ) : (
              <p className="text-gray-900 flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                {formData.budgeted_labor_hours || 0}h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Budget vs Actual */}
      {(job?.budgeted_total_cost || job?.actual_total_cost) && !isEditing && (
        <div className="p-4 bg-gray-50 border-t">
          <BudgetActualDisplay
            labor={{
              budgetedHours: job.budgeted_labor_hours || 0,
              actualHours: job.actual_labor_hours || actualLaborHours,
              budgetedCost: job.budgeted_labor_cost || 0,
              actualCost: job.actual_labor_cost || actualLaborCost,
            }}
            materials={{
              budgeted: job.budgeted_material_cost || 0,
              actual: job.actual_material_cost || 0,
            }}
            total={{
              budgeted: job.budgeted_total_cost || 0,
              actual: job.actual_total_cost || actualLaborCost,
            }}
            hasRework={hasRework}
          />
        </div>
      )}

      {/* Visits - ALWAYS VISIBLE */}
      <div className="border-t">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              Visits ({formData.visits.length})
            </h4>
            {isEditing && (
              <button
                onClick={addVisit}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Visit
              </button>
            )}
          </div>

          {/* Visits List */}
          <div className="space-y-3">
            {formData.visits.map((visit, idx) => (
              <div
                key={visit.id || visit.tempId}
                className={`p-3 rounded-lg border ${
                  ['rework', 'callback', 'warranty'].includes(visit.visit_type)
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Visit Number */}
                  <span className="text-sm font-medium text-gray-500 w-8">
                    #{visit.visit_number}
                  </span>

                  {/* Visit Details */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Type */}
                    <div>
                      {isEditing ? (
                        <select
                          value={visit.visit_type}
                          onChange={(e) =>
                            updateVisit(idx, 'visit_type', e.target.value)
                          }
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          {VISIT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            VISIT_TYPE_COLORS[visit.visit_type]
                          }`}
                        >
                          {visit.visit_type}
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      {isEditing ? (
                        <input
                          type="date"
                          value={visit.scheduled_date || ''}
                          onChange={(e) =>
                            updateVisit(idx, 'scheduled_date', e.target.value)
                          }
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(visit.scheduled_date)}
                        </span>
                      )}
                    </div>

                    {/* Hours */}
                    <div>
                      {isEditing ? (
                        <input
                          type="number"
                          value={visit.labor_hours || ''}
                          onChange={(e) =>
                            updateVisit(idx, 'labor_hours', Number(e.target.value))
                          }
                          placeholder="Hours"
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.5"
                        />
                      ) : (
                        visit.labor_hours && (
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {visit.labor_hours}h
                          </span>
                        )
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          visit.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {visit.status}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  {isEditing && (
                    <button
                      onClick={() => removeVisit(idx)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Empty state */}
            {formData.visits.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {isEditing ? (
                  <button
                    onClick={addVisit}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    + Add first visit
                  </button>
                ) : (
                  'No visits scheduled'
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="p-4 border-t space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          {isEditing ? (
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes..."
            />
          ) : (
            <p className="text-gray-600">{formData.notes || '-'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default JobCard;
