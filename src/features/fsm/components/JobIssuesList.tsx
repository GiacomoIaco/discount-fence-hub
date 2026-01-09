/**
 * JobIssuesList - List and manage job issues with penalization
 *
 * Shows all issues for a job with:
 * - Issue type badges with colors
 * - Status indicators
 * - Accountability (crew/rep)
 * - Penalization details
 * - Add new issue button
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  ChevronRight,
  User,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  useJobIssues,
  useCreateJobIssue,
  useUpdateJobIssue,
  useResolveJobIssue,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPE_COLORS,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_COLORS,
  PENALIZATION_TYPE_LABELS,
  PENALIZATION_TYPE_COLORS,
} from '../hooks/useJobIssues';
import type { JobIssue, JobIssueType, JobIssueStatus } from '../types';

interface JobIssuesListProps {
  jobId: string;
  onSelectIssue?: (issue: JobIssue) => void;
}

// Status icons
const STATUS_ICONS: Record<JobIssueStatus, React.ElementType> = {
  identified: AlertCircle,
  assessing: Clock,
  approved: CheckCircle,
  in_progress: Clock,
  resolved: CheckCircle,
  cancelled: XCircle,
};

export default function JobIssuesList({ jobId, onSelectIssue }: JobIssuesListProps) {
  const { data: issues, isLoading } = useJobIssues(jobId);
  const createIssue = useCreateJobIssue();
  const updateIssue = useUpdateJobIssue();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    issue_type: 'other' as JobIssueType,
    description: '',
    is_billable: false,
    estimated_cost: '',
  });

  const handleAddIssue = async () => {
    if (!newIssue.title.trim()) return;

    await createIssue.mutateAsync({
      job_id: jobId,
      title: newIssue.title,
      issue_type: newIssue.issue_type,
      description: newIssue.description || undefined,
      is_billable: newIssue.is_billable,
      estimated_cost: newIssue.estimated_cost ? parseFloat(newIssue.estimated_cost) : undefined,
    });

    setShowAddForm(false);
    setNewIssue({
      title: '',
      issue_type: 'other',
      description: '',
      is_billable: false,
      estimated_cost: '',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <div className="animate-pulse">Loading issues...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-semibold">Issues</h2>
          {issues && issues.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              {issues.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <Plus className="w-4 h-4" />
          Report Issue
        </button>
      </div>

      {/* Add Issue Form */}
      {showAddForm && (
        <div className="p-4 border-b bg-amber-50">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Issue Type</label>
                <select
                  value={newIssue.issue_type}
                  onChange={(e) => setNewIssue({ ...newIssue, issue_type: e.target.value as JobIssueType })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {Object.entries(ISSUE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost</label>
                <input
                  type="number"
                  value={newIssue.estimated_cost}
                  onChange={(e) => setNewIssue({ ...newIssue, estimated_cost: e.target.value })}
                  placeholder="$0.00"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={newIssue.title}
                onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Details (optional)</label>
              <textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                placeholder="Additional context..."
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIssue.is_billable}
                  onChange={(e) => setNewIssue({ ...newIssue, is_billable: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                Billable to customer
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIssue}
                disabled={!newIssue.title.trim() || createIssue.isPending}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {createIssue.isPending ? 'Saving...' : 'Report Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      {!issues || issues.length === 0 ? (
        <div className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No issues reported</p>
          <p className="text-xs text-gray-400 mt-1">Click "Report Issue" to log a problem</p>
        </div>
      ) : (
        <div className="divide-y">
          {issues.map((issue) => {
            const StatusIcon = STATUS_ICONS[issue.status];
            return (
              <div
                key={issue.id}
                onClick={() => onSelectIssue?.(issue)}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  {/* Type Badge */}
                  <div className={`px-2 py-1 text-xs font-medium rounded ${ISSUE_TYPE_COLORS[issue.issue_type]}`}>
                    {ISSUE_TYPE_LABELS[issue.issue_type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{issue.title}</h3>
                      {issue.is_billable && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                          Billable
                        </span>
                      )}
                    </div>
                    {issue.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{issue.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {/* Status */}
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${ISSUE_STATUS_COLORS[issue.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {ISSUE_STATUS_LABELS[issue.status]}
                      </span>

                      {/* Cost */}
                      {(issue.estimated_cost || issue.actual_cost) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(issue.actual_cost || issue.estimated_cost)}
                        </span>
                      )}

                      {/* Accountability */}
                      {issue.responsible_crew && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {issue.responsible_crew.name}
                        </span>
                      )}
                      {issue.responsible_user && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {issue.responsible_user.full_name}
                        </span>
                      )}

                      {/* Penalization */}
                      {issue.penalization_type && issue.penalization_type !== 'none' && (
                        <span className={`px-1.5 py-0.5 rounded ${PENALIZATION_TYPE_COLORS[issue.penalization_type]}`}>
                          {PENALIZATION_TYPE_LABELS[issue.penalization_type]}
                          {issue.penalization_amount && `: $${issue.penalization_amount}`}
                          {issue.penalization_percent && `: ${issue.penalization_percent}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
