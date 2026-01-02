/**
 * WorkTab - Jobs and Visits management within a Project
 *
 * Features:
 * - List all jobs by phase
 * - Show job visits inline
 * - Budget vs Actual display
 * - Phase dependencies visualization
 */

import { useState } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit2,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Job, JobVisit, JobVisitType, JobStatus } from '../../../types';
import { BudgetActualDisplay } from '../../shared/BudgetActualDisplay';

const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  won: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-purple-100 text-purple-700',
  ready_for_yard: 'bg-yellow-100 text-yellow-700',
  picking: 'bg-orange-100 text-orange-700',
  staged: 'bg-orange-100 text-orange-700',
  loaded: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  requires_invoicing: 'bg-purple-100 text-purple-700',
};

const VISIT_TYPE_COLORS: Record<JobVisitType, string> = {
  initial: 'bg-blue-100 text-blue-700',
  continuation: 'bg-gray-100 text-gray-700',
  rework: 'bg-red-100 text-red-700',
  callback: 'bg-orange-100 text-orange-700',
  inspection: 'bg-purple-100 text-purple-700',
  warranty: 'bg-yellow-100 text-yellow-700',
};

interface WorkTabProps {
  jobs: Job[];
  projectId: string;
  onCreateJob?: () => void;
  onEditJob?: (jobId: string) => void;
  onViewJob?: (jobId: string) => void;
  onScheduleJob?: (jobId: string) => void;
  onAddVisit?: (jobId: string) => void;
}

export function WorkTab({
  jobs,
  projectId: _projectId,
  onCreateJob,
  onEditJob,
  onViewJob,
  onScheduleJob,
  onAddVisit,
}: WorkTabProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Sort jobs by phase number
  const sortedJobs = [...jobs].sort((a, b) => {
    const phaseA = a.phase_number || 1;
    const phaseB = b.phase_number || 1;
    return phaseA - phaseB;
  });

  // Group jobs by phase
  const jobsByPhase = sortedJobs.reduce((acc, job) => {
    const phase = job.phase_number || 1;
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(job);
    return acc;
  }, {} as Record<number, Job[]>);

  const toggleExpand = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate totals
  const totalBudgetedCost = jobs.reduce(
    (sum, j) => sum + (j.budgeted_total_cost || 0),
    0
  );
  const totalActualCost = jobs.reduce(
    (sum, j) => sum + (j.actual_total_cost || 0),
    0
  );
  const hasRework = jobs.some((j) => j.has_rework);
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-900 mb-2">No Jobs Yet</h3>
        <p className="text-gray-500 mb-4">
          Accept a quote to create jobs, or add jobs manually
        </p>
        {onCreateJob && (
          <button
            onClick={onCreateJob}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{jobs.length}</div>
          <div className="text-sm text-gray-500">Total Jobs</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{completedJobs}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div
            className={`text-2xl font-bold ${
              totalActualCost > totalBudgetedCost ? 'text-red-600' : 'text-green-600'
            }`}
          >
            ${totalActualCost.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Actual Cost</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          {hasRework ? (
            <>
              <div className="text-2xl font-bold text-red-600">Yes</div>
              <div className="text-sm text-gray-500">Has Rework</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-green-600">No</div>
              <div className="text-sm text-gray-500">Rework</div>
            </>
          )}
        </div>
      </div>

      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Jobs ({jobs.length}) • {Object.keys(jobsByPhase).length} Phase(s)
        </h3>
        {onCreateJob && (
          <button
            onClick={onCreateJob}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        )}
      </div>

      {/* Jobs by Phase */}
      {Object.entries(jobsByPhase).map(([phase, phaseJobs]) => (
        <div key={phase} className="space-y-3">
          {/* Phase Header */}
          {Object.keys(jobsByPhase).length > 1 && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                Phase {phase}
              </span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          )}

          {/* Jobs in this Phase */}
          {phaseJobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const visits = (job.visits || []) as JobVisit[];
            const hasVisits = visits.length > 0;
            const reworkVisits = visits.filter((v) =>
              ['rework', 'callback', 'warranty'].includes(v.visit_type)
            );

            return (
              <div
                key={job.id}
                className={`bg-white rounded-lg border overflow-hidden ${
                  job.has_rework ? 'border-red-200' : ''
                }`}
              >
                {/* Job Header */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(job.id)}
                >
                  {/* Status Icon */}
                  <div
                    className={`p-2 rounded-lg ${
                      job.status === 'completed'
                        ? 'bg-green-100'
                        : job.status === 'in_progress'
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    {job.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Wrench className="w-5 h-5 text-gray-600" />
                    )}
                  </div>

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {job.job_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          JOB_STATUS_COLORS[job.status] || 'bg-gray-100'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      {job.phase_name && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                          {job.phase_name}
                        </span>
                      )}
                      {job.has_rework && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Rework ({reworkVisits.length})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      {job.scheduled_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(job.scheduled_date)}
                        </span>
                      )}
                      {job.assigned_crew && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {job.assigned_crew.name}
                        </span>
                      )}
                      {hasVisits && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {visits.length} visit(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financials Preview */}
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ${(job.quoted_total || 0).toLocaleString()}
                    </p>
                    {job.actual_total_cost > 0 && (
                      <p
                        className={`text-sm flex items-center justify-end gap-1 ${
                          job.actual_total_cost > (job.budgeted_total_cost || 0)
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {job.actual_total_cost > (job.budgeted_total_cost || 0) ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        ${job.actual_total_cost.toLocaleString()} actual
                      </p>
                    )}
                  </div>

                  {/* Expand Icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Budget vs Actual */}
                    {((job.budgeted_total_cost ?? 0) > 0 || (job.actual_total_cost ?? 0) > 0) && (
                      <div className="p-4 bg-gray-50">
                        <BudgetActualDisplay
                          labor={{
                            budgetedHours: job.budgeted_labor_hours || 0,
                            actualHours: job.actual_labor_hours || 0,
                            budgetedCost: job.budgeted_labor_cost || 0,
                            actualCost: job.actual_labor_cost || 0,
                          }}
                          materials={{
                            budgeted: job.budgeted_material_cost || 0,
                            actual: job.actual_material_cost || 0,
                          }}
                          total={{
                            budgeted: job.budgeted_total_cost || 0,
                            actual: job.actual_total_cost || 0,
                          }}
                          hasRework={job.has_rework}
                        />
                      </div>
                    )}

                    {/* Visits List */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          Visits ({visits.length})
                        </h4>
                        {onAddVisit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddVisit(job.id);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add Visit
                          </button>
                        )}
                      </div>

                      {visits.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No visits recorded yet
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {visits.map((visit) => (
                            <div
                              key={visit.id}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm font-medium text-gray-500 w-8">
                                #{visit.visit_number}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  VISIT_TYPE_COLORS[visit.visit_type as JobVisitType] ||
                                  'bg-gray-100'
                                }`}
                              >
                                {visit.visit_type}
                              </span>
                              <span className="flex items-center gap-1 text-sm text-gray-600">
                                <Calendar className="w-3 h-3" />
                                {formatDate(visit.scheduled_date)}
                              </span>
                              {visit.labor_hours && (
                                <span className="flex items-center gap-1 text-sm text-gray-600">
                                  <Clock className="w-3 h-3" />
                                  {visit.labor_hours}h
                                </span>
                              )}
                              {visit.assigned_crew && (
                                <span className="text-sm text-gray-600">
                                  {visit.assigned_crew.name}
                                </span>
                              )}
                              <span
                                className={`ml-auto px-2 py-0.5 rounded text-xs ${
                                  visit.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {visit.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex flex-wrap gap-2">
                      {job.status === 'won' && onScheduleJob && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onScheduleJob(job.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Calendar className="w-4 h-4" />
                          Schedule Job
                        </button>
                      )}
                      {onEditJob && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditJob(job.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                      )}
                      {onViewJob && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewJob(job.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          View Full Details
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Dependency Info */}
                    {job.depends_on_job && (
                      <div className="px-4 pb-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <strong>Depends on:</strong>{' '}
                          {job.depends_on_job.job_number} - {job.depends_on_job.name}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default WorkTab;
