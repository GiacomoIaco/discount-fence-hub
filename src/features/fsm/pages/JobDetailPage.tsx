/**
 * JobDetailPage - Full page view of a job
 *
 * Accessible via URL: /jobs/:id
 *
 * Tabs:
 * - Overview: Job summary, schedule, crew assignment
 * - Visits: Multi-visit tracking for complex jobs
 * - Issues: Job issues with accountability tracking
 * - Activity: Status history, workflow tracking
 */

import { useState } from 'react';
import {
  CheckCircle,
  FileText,
  Building2,
  MapPin,
  AlertCircle,
  History,
  Package,
  Clock,
  Calendar,
  Users,
  Truck,
  Wrench,
  Receipt,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { useJob, useScheduleJob, useCompleteJob, useCreateInvoiceFromJob } from '../hooks/useJobs';
import { useJobIssues } from '../hooks/useJobIssues';
import JobIssuesList from '../components/JobIssuesList';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
} from '../types';

// BU type colors (same as QuoteHeader)
const BU_TYPE_COLORS: Record<string, string> = {
  residential: 'bg-blue-100 text-blue-700 border-blue-200',
  builders: 'bg-orange-100 text-orange-700 border-orange-200',
  commercial: 'bg-green-100 text-green-700 border-green-200',
};
import CustomFieldsSection from '../../client_hub/components/CustomFieldsSection';
import { EntityHeader } from '../components/shared/EntityHeader';
import { JobProgress } from '../components/shared/WorkflowProgress';

type Tab = 'overview' | 'visits' | 'issues' | 'activity';

interface JobDetailPageProps {
  jobId: string;
  onBack: () => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onEditJob?: (jobId: string) => void;
}

export default function JobDetailPage({
  jobId,
  onBack,
  onNavigateToQuote,
  onNavigateToInvoice,
}: JobDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const { data: job, isLoading, error } = useJob(jobId);
  const { data: jobIssues } = useJobIssues(jobId);
  const scheduleJob = useScheduleJob();
  const completeJob = useCompleteJob();
  const createInvoice = useCreateInvoiceFromJob();

  // Schedule modal state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTimeStart, setScheduleTimeStart] = useState('');
  const [scheduleTimeEnd, setScheduleTimeEnd] = useState('');

  // Complete modal state
  const [completionNotes, setCompletionNotes] = useState('');

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatAddress = (address: { line1: string; line2?: string; city: string; state: string; zip: string } | null) => {
    if (!address) return '-';
    const parts = [address.line1];
    if (address.line2) parts.push(address.line2);
    parts.push(`${address.city}, ${address.state} ${address.zip}`);
    return parts.join('\n');
  };

  const handleSchedule = async () => {
    if (!job || !scheduleDate) return;
    await scheduleJob.mutateAsync({
      id: job.id,
      scheduledDate: scheduleDate,
      scheduledTimeStart: scheduleTimeStart || undefined,
      scheduledTimeEnd: scheduleTimeEnd || undefined,
    });
    setShowScheduleModal(false);
    setScheduleDate('');
    setScheduleTimeStart('');
    setScheduleTimeEnd('');
  };

  const handleComplete = async () => {
    if (!job) return;
    await completeJob.mutateAsync({
      id: job.id,
      notes: completionNotes || undefined,
    });
    setShowCompleteModal(false);
    setCompletionNotes('');
  };

  const handleCreateInvoice = async () => {
    if (!job) return;
    const invoice = await createInvoice.mutateAsync(job.id);
    if (onNavigateToInvoice && invoice?.id) {
      onNavigateToInvoice(invoice.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading job...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </button>
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error?.message || 'Job not found'}
        </div>
      </div>
    );
  }

  // Action buttons
  const actionButtons = (
    <>
      {/* Schedule Button */}
      {job.status === 'won' && (
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Calendar className="w-4 h-4" />
          Schedule
        </button>
      )}

      {/* Complete Button */}
      {job.status === 'in_progress' && (
        <button
          onClick={() => setShowCompleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <CheckCircle className="w-4 h-4" />
          Complete Job
        </button>
      )}

      {/* Create Invoice Button */}
      {job.status === 'completed' && !job.invoice_id && (
        <button
          onClick={handleCreateInvoice}
          disabled={createInvoice.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          <Receipt className="w-4 h-4" />
          {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <EntityHeader
        onBack={onBack}
        backLabel="Back to Jobs"
        icon={Wrench}
        iconBgClass="bg-orange-100"
        iconColorClass="text-orange-600"
        title={job.job_number}
        statusBadge={{
          label: JOB_STATUS_LABELS[job.status],
          colorClass: JOB_STATUS_COLORS[job.status],
        }}
        extraBadges={
          job.qbo_class?.labor_code || job.qbo_class?.name
            ? [{
                label: job.qbo_class.labor_code || job.qbo_class.name,
                colorClass: `${BU_TYPE_COLORS[job.qbo_class.bu_type || 'residential']} border`,
              }]
            : undefined
        }
        subtitle={
          <span className="flex items-center gap-4">
            {job.client && (
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {job.client.name}
              </span>
            )}
            {job.product_type && <span>{job.product_type}</span>}
            {job.linear_feet && <span>{job.linear_feet} LF</span>}
          </span>
        }
        workflowProgress={
          <JobProgress
            status={job.status}
            scheduledDate={job.scheduled_date}
            workStartedAt={job.work_started_at}
            workCompletedAt={job.work_completed_at}
            compact
          />
        }
        actions={actionButtons}
      >
        {/* Tabs */}
        <div className="px-6 pt-4 -mx-6 flex gap-1 border-t">
          {(['overview', 'visits', 'issues', 'activity'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'visits' && `Visits${job.visits?.length ? ` (${job.visits.length})` : ''}`}
              {tab === 'issues' && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Issues{jobIssues?.length ? ` (${jobIssues.length})` : ''}
                </span>
              )}
              {tab === 'activity' && 'Activity'}
            </button>
          ))}
        </div>
      </EntityHeader>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Schedule Card */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Scheduled Date</span>
                    <p className="font-medium">{formatDate(job.scheduled_date)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Time</span>
                    <p className="font-medium">
                      {job.scheduled_time_start && job.scheduled_time_end
                        ? `${job.scheduled_time_start} - ${job.scheduled_time_end}`
                        : job.scheduled_time_start || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Estimated Duration</span>
                    <p className="font-medium">
                      {job.estimated_duration_hours ? `${job.estimated_duration_hours} hours` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Assigned Crew</span>
                    <p className="font-medium flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      {job.assigned_crew?.name || 'Not assigned'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Workflow Progress */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Workflow Progress
                </h3>
                <div className="space-y-3">
                  <WorkflowStep
                    label="Ready for Yard"
                    timestamp={job.ready_for_yard_at}
                    completed={!!job.ready_for_yard_at}
                  />
                  <WorkflowStep
                    label="Picking Started"
                    timestamp={job.picking_started_at}
                    completed={!!job.picking_started_at}
                  />
                  <WorkflowStep
                    label="Picking/Staging Complete"
                    timestamp={job.staging_completed_at}
                    completed={!!job.staging_completed_at}
                  />
                  <WorkflowStep
                    label="Loaded"
                    timestamp={job.loaded_at}
                    completed={!!job.loaded_at}
                  />
                  <WorkflowStep
                    label="Work Started"
                    timestamp={job.work_started_at}
                    completed={!!job.work_started_at}
                  />
                  <WorkflowStep
                    label="Work Completed"
                    timestamp={job.work_completed_at}
                    completed={!!job.work_completed_at}
                  />
                </div>
              </div>

              {/* Scope & Description */}
              {(job.description || job.special_instructions) && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    Scope
                  </h3>
                  {job.description && (
                    <div className="mb-4">
                      <span className="text-sm text-gray-500">Description</span>
                      <p className="whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                  {job.special_instructions && (
                    <div>
                      <span className="text-sm text-gray-500">Special Instructions</span>
                      <p className="whitespace-pre-wrap text-amber-700 bg-amber-50 p-3 rounded-lg mt-1">
                        {job.special_instructions}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Completion Info */}
              {job.status === 'completed' && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Completion Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Completed At</span>
                      <p className="font-medium">{formatDateTime(job.work_completed_at)}</p>
                    </div>
                    {job.completion_notes && (
                      <div className="col-span-2">
                        <span className="text-sm text-gray-500">Notes</span>
                        <p className="whitespace-pre-wrap">{job.completion_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Job Address */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Job Site
                </h3>
                <p className="whitespace-pre-line text-gray-900">
                  {formatAddress(job.job_address)}
                </p>
              </div>

              {/* Pricing */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Pricing
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quoted Total</span>
                    <span className="font-semibold">{formatCurrency(job.quoted_total)}</span>
                  </div>
                </div>
              </div>

              {/* Related Entities */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Related
                </h3>
                <div className="space-y-2">
                  {job.quote && (
                    <button
                      onClick={() => onNavigateToQuote?.(job.quote!.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <FileText className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">{job.quote.quote_number}</p>
                        <p className="text-sm text-gray-500">Quote</p>
                      </div>
                    </button>
                  )}
                  {job.invoice_id && (
                    <button
                      onClick={() => onNavigateToInvoice?.(job.invoice_id!)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <Receipt className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Invoice</p>
                        <p className="text-sm text-gray-500">View Invoice</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Timeline
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span>{formatDate(job.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Updated</span>
                    <span>{formatDate(job.updated_at)}</span>
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              <CustomFieldsSection
                entityType="job"
                entityId={jobId}
                collapsible={true}
                defaultCollapsed={true}
              />
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Job Visits</h3>
              <p className="text-sm text-gray-500 mt-1">
                Track multiple visits for complex jobs
              </p>
            </div>
            {job.visits && job.visits.length > 0 ? (
              <div className="divide-y">
                {job.visits.map((visit) => (
                  <div key={visit.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Truck className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">Visit #{visit.visit_number}</p>
                        <p className="text-sm text-gray-500">
                          {visit.visit_type} - {formatDate(visit.scheduled_date)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      visit.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : visit.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {visit.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No visits scheduled</p>
                <p className="text-sm mt-1">Add visits for multi-day or multi-phase jobs</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'issues' && (
          <JobIssuesList jobId={jobId} />
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Activity History
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5" />
                <div>
                  <p>Status changed to <strong>{JOB_STATUS_LABELS[job.status]}</strong></p>
                  <p className="text-gray-500">{formatDateTime(job.status_changed_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5" />
                <div>
                  <p>Job created</p>
                  <p className="text-gray-500">{formatDateTime(job.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Schedule Job</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTimeStart}
                    onChange={(e) => setScheduleTimeStart(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTimeEnd}
                    onChange={(e) => setScheduleTimeEnd(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate || scheduleJob.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {scheduleJob.isPending ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Complete Job</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completion Notes
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Any notes about the completed work..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={completeJob.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {completeJob.isPending ? 'Completing...' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for workflow steps
function WorkflowStep({
  label,
  timestamp,
  completed,
}: {
  label: string;
  timestamp: string | null;
  completed: boolean;
}) {
  const formatTime = (ts: string | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        completed ? 'bg-green-100' : 'bg-gray-100'
      }`}>
        {completed ? (
          <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
          <Clock className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="flex-1">
        <span className={completed ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
      </div>
      <span className="text-sm text-gray-500">{formatTime(timestamp)}</span>
    </div>
  );
}
