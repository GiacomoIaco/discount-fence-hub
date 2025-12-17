/**
 * ProjectJobsTimeline - Visual timeline of jobs within a project
 *
 * Shows:
 * - Job sequence with dependencies
 * - Crew assignments and schedules
 * - Invoice grouping status
 * - Multi-crew visibility for projects like Fence + Auto Gate
 */

import { useState } from 'react';
import {
  Calendar,
  Users,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  Clock,
  Link2,
  ExternalLink,
} from 'lucide-react';
import { useProjectJobsWithContext } from '../hooks/useQuoteToProject';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobWithContext,
} from '../types';

interface Props {
  projectId: string;
  onNavigateToJob?: (jobId: string) => void;
}

export default function ProjectJobsTimeline({ projectId, onNavigateToJob }: Props) {
  const { data: jobs, isLoading } = useProjectJobsWithContext(projectId);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const formatDate = (date: string | null) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading jobs...
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No jobs in this project yet</p>
      </div>
    );
  }

  // Group jobs by invoice group
  const invoiceGroups = new Map<string | null, JobWithContext[]>();
  jobs.forEach(job => {
    const groupId = job.invoice_group_id || null;
    if (!invoiceGroups.has(groupId)) {
      invoiceGroups.set(groupId, []);
    }
    invoiceGroups.get(groupId)!.push(job);
  });

  // Check if we have multiple jobs (multi-job project)
  const isMultiJobProject = jobs.length > 1;

  // Sort jobs by sequence
  const sortedJobs = [...jobs].sort((a, b) => (a.sequence_order || 1) - (b.sequence_order || 1));

  return (
    <div className="space-y-4">
      {/* Schedule Overview */}
      {isMultiJobProject && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Schedule Overview</h4>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {sortedJobs.map((job, index) => (
              <div key={job.id} className="flex items-center">
                <div className={`px-3 py-2 rounded-lg border ${
                  job.status === 'completed' || job.status === 'requires_invoicing'
                    ? 'bg-green-100 border-green-300'
                    : job.status === 'in_progress'
                    ? 'bg-blue-100 border-blue-300'
                    : job.scheduled_date
                    ? 'bg-white border-gray-300'
                    : 'bg-gray-100 border-gray-200'
                }`}>
                  <div className="text-xs font-medium text-gray-500">Job {index + 1}</div>
                  <div className="text-sm font-medium text-gray-900">{job.name || `Job ${index + 1}`}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {job.scheduled_date ? formatDate(job.scheduled_date) : 'Not scheduled'}
                  </div>
                  {job.assigned_crew && (
                    <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {job.assigned_crew.name}
                    </div>
                  )}
                </div>
                {index < sortedJobs.length - 1 && (
                  <div className="flex items-center px-2">
                    {job.depends_on_job_id ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Link2 className="w-4 h-4" />
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Invoice grouping indicator */}
          {invoiceGroups.size === 1 && invoiceGroups.has(jobs[0]?.invoice_group_id || null) && jobs[0]?.invoice_group_id && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <Receipt className="w-4 h-4" />
              <span>All jobs will be invoiced together</span>
              <span className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                {jobs[0]?.invoice_group?.group_number}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Job Cards */}
      <div className="space-y-2">
        {sortedJobs.map((job, index) => {
          const isExpanded = expandedJobId === job.id;
          const statusColor = JOB_STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-700';
          const statusLabel = JOB_STATUS_LABELS[job.status] || job.status;

          return (
            <div key={job.id} className="border rounded-lg overflow-hidden bg-white">
              {/* Job Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Sequence number */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    job.status === 'completed' || job.status === 'requires_invoicing'
                      ? 'bg-green-100 text-green-700'
                      : job.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {job.name || job.job_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                      <span className="font-mono text-xs">{job.job_number}</span>
                      {job.project_type && (
                        <span>{job.project_type.name}</span>
                      )}
                      {job.estimated_value && (
                        <span className="font-medium">{formatCurrency(job.estimated_value)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Schedule & Crew */}
                  <div className="text-right text-sm">
                    {job.scheduled_date ? (
                      <div className="flex items-center gap-1 text-gray-700">
                        <Calendar className="w-4 h-4" />
                        {formatDate(job.scheduled_date)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-4 h-4" />
                        Not scheduled
                      </div>
                    )}
                    {job.assigned_crew && (
                      <div className="flex items-center gap-1 text-gray-600 mt-0.5">
                        <Users className="w-4 h-4" />
                        {job.assigned_crew.name}
                      </div>
                    )}
                  </div>

                  {/* Expand toggle */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t bg-gray-50 p-4 space-y-4">
                  {/* Dependencies */}
                  {job.depends_on_job && (
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="w-4 h-4 text-amber-600" />
                      <span className="text-gray-600">Depends on:</span>
                      <span className="font-medium">{(job.depends_on_job as any).name || job.depends_on_job.job_number}</span>
                    </div>
                  )}

                  {/* Skill Tags */}
                  {job.skill_tag_ids && job.skill_tag_ids.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">Required Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {job.skill_tag_ids.map((tagId) => (
                          <span
                            key={tagId}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                          >
                            {tagId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoice Group */}
                  {job.invoice_group && (
                    <div className="flex items-center gap-2 text-sm">
                      <Receipt className="w-4 h-4 text-purple-600" />
                      <span className="text-gray-600">Invoice Group:</span>
                      <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border">
                        {job.invoice_group.group_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        job.invoice_group.status === 'invoiced'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {job.invoice_group.status}
                      </span>
                    </div>
                  )}

                  {/* Line Items Summary */}
                  {job.quote_line_item_ids && job.quote_line_item_ids.length > 0 && (
                    <div className="text-sm text-gray-600">
                      {job.quote_line_item_ids.length} line item{job.quote_line_item_ids.length !== 1 ? 's' : ''} assigned
                    </div>
                  )}

                  {/* Action Button */}
                  {onNavigateToJob && (
                    <button
                      onClick={() => onNavigateToJob(job.id)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Job Details
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Legend */}
      {isMultiJobProject && (
        <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <span>Not Started</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-200" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-200" />
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1">
            <Link2 className="w-3 h-3 text-amber-600" />
            <span>Depends On Previous</span>
          </div>
        </div>
      )}
    </div>
  );
}
