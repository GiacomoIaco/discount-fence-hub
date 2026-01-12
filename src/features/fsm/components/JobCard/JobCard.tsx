/**
 * JobCard - Unified job component for create/edit/view modes
 *
 * This component handles all job interactions following the Jobber pattern:
 * - Header with status and actions
 * - Visits timeline (ALWAYS visible)
 * - Budget vs Actual tracking
 * - Right sidebar for assignment/scheduling
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  History,
  AlertTriangle,
} from 'lucide-react';
import type { JobCardProps, JobCardMode } from './types';
import { useJobForm } from './useJobForm';
import JobHeader from './JobHeader';
import JobVisitsSection from './JobVisitsSection';
import JobBudgetSection from './JobBudgetSection';
import JobLineItemsSection from './JobLineItemsSection';
import JobSidebar from './JobSidebar';
import CollapsibleSection from './CollapsibleSection';
import QuickTicketModal, { type FsmTicketContext } from '../QuickTicketModal';
import {
  useCompleteJob,
  useUpdateJobStatus,
  useCreateInvoiceFromJob,
  useAddJobVisit,
  useCompleteJobVisit,
} from '../../hooks/useJobs';
import { useJobIssues } from '../../hooks/useJobIssues';
import { useCrews } from '../../hooks/useCrews';
import type { JobVisit } from '../../types';
import { JOB_STATUS_LABELS } from '../../types';
import JobIssuesList from '../JobIssuesList';

export default function JobCard({
  mode: initialMode,
  jobId,
  projectId,
  quoteId,
  clientId,
  communityId,
  propertyId,
  jobAddress,
  onSave,
  onCancel,
  onBack,
  onComplete,
  onCreateInvoice,
  onCreateTicket,
}: JobCardProps) {
  // Mode state (can switch from view to edit)
  const [mode, setMode] = useState<JobCardMode>(initialMode);

  // Visit editor modal state
  const [showVisitEditor, setShowVisitEditor] = useState(false);
  const [editingVisit, setEditingVisit] = useState<JobVisit | null>(null);

  // Quick Ticket modal state
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Form state management
  const {
    form,
    setField,
    setFields,
    totals,
    validation,
    save,
    isSaving,
    isDirty,
    job,
    visits,
    isLoading,
  } = useJobForm({
    mode,
    jobId,
    projectId,
    quoteId,
    clientId,
    communityId,
    propertyId,
    jobAddress,
  });

  // Crews for assignment dropdown
  const { data: crews = [], isLoading: isLoadingCrews } = useCrews();

  // Job issues
  const { data: jobIssues } = useJobIssues(jobId);

  // Mutations
  const completeMutation = useCompleteJob();
  const statusMutation = useUpdateJobStatus();
  const invoiceMutation = useCreateInvoiceFromJob();
  useAddJobVisit(); // Available for future use
  const completeVisitMutation = useCompleteJobVisit();

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      const savedId = await save();
      if (savedId) {
        setMode('view');
        if (onSave && job) {
          onSave(job);
        }
      }
    } catch (error) {
      console.error('Failed to save job:', error);
      alert(`Error saving job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [save, onSave, job]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (mode === 'edit') {
      setMode('view');
    } else if (onCancel) {
      onCancel();
    } else if (onBack) {
      onBack();
    }
  }, [mode, onCancel, onBack]);

  // Handle edit mode switch
  const handleEdit = useCallback(() => {
    setMode('edit');
  }, []);

  // Handle complete job
  const handleComplete = useCallback(async () => {
    if (!jobId) return;
    try {
      await completeMutation.mutateAsync({ id: jobId });
      onComplete?.(jobId);
    } catch (error) {
      console.error('Failed to complete job:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [jobId, completeMutation, onComplete]);

  // Handle create invoice
  const handleCreateInvoice = useCallback(async () => {
    if (!jobId) return;
    try {
      await invoiceMutation.mutateAsync(jobId);
      onCreateInvoice?.(jobId);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [jobId, invoiceMutation, onCreateInvoice]);

  // Handle schedule job
  const handleSchedule = useCallback(() => {
    // Switch to edit mode and focus on scheduling section
    setMode('edit');
    // TODO: Scroll to scheduling section
  }, []);

  // Handle send to yard
  const handleSendToYard = useCallback(async () => {
    if (!jobId) return;
    try {
      await statusMutation.mutateAsync({ id: jobId, status: 'ready_for_yard' });
    } catch (error) {
      console.error('Failed to send to yard:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [jobId, statusMutation]);

  // Handle add visit
  const handleAddVisit = useCallback(() => {
    setEditingVisit(null);
    setShowVisitEditor(true);
  }, []);

  // Handle edit visit
  const handleEditVisit = useCallback((visit: JobVisit) => {
    setEditingVisit(visit);
    setShowVisitEditor(true);
  }, []);

  // Handle start visit
  const handleStartVisit = useCallback(async (_visitId: string) => {
    // TODO: Implement start visit
    alert('Start visit functionality coming soon');
  }, []);

  // Handle complete visit
  const handleCompleteVisit = useCallback(async (visitId: string) => {
    try {
      await completeVisitMutation.mutateAsync({ id: visitId });
    } catch (error) {
      console.error('Failed to complete visit:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [completeVisitMutation]);

  // Handle report issue
  const handleReportIssue = useCallback(() => {
    // TODO: Open issue reporter modal
    alert('Report issue functionality coming soon');
  }, []);

  // Handle creating an internal ticket linked to this job
  const handleCreateTicket = useCallback(() => {
    if (!jobId || !job) return;
    if (onCreateTicket) {
      onCreateTicket(jobId, job.job_number);
    } else {
      // Open the QuickTicketModal
      setShowTicketModal(true);
    }
  }, [jobId, job, onCreateTicket]);

  // Build ticket context from job data
  const ticketContext = useMemo<FsmTicketContext | null>(() => {
    if (!jobId || !job) return null;

    // Build address from job_address
    const address = job.job_address;

    return {
      entityType: 'job',
      entityId: jobId,
      entityNumber: job.job_number,
      projectId: job.project_id,
      // Customer info
      clientId: job.client_id || undefined,
      clientName: job.client?.name,
      communityId: job.community_id || undefined,
      communityName: job.community?.name,
      // Address
      address: address ? {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        zip: address.zip,
      } : undefined,
      // Project details
      productType: job.product_type,
      linearFeet: job.linear_feet,
      // Note: Job's client select doesn't include contact info - phone/email will be undefined
    };
  }, [jobId, job]);

  // Handle field changes from sidebar
  const handleFieldChange = useCallback((field: keyof typeof form, value: string | number | null) => {
    setField(field, value as any);
  }, [setField]);

  // Handle crew change
  const handleCrewChange = useCallback((crewId: string) => {
    setField('assignedCrewId', crewId);
  }, [setField]);

  // Handle rep change
  const handleRepChange = useCallback((repId: string) => {
    setField('assignedRepId', repId);
  }, [setField]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <JobHeader
        mode={mode}
        job={job ?? null}
        validation={validation}
        isSaving={isSaving || completeMutation.isPending || invoiceMutation.isPending}
        isDirty={isDirty}
        onBack={onBack}
        onCancel={handleCancel}
        onSave={handleSave}
        onEdit={handleEdit}
        onComplete={handleComplete}
        onCreateInvoice={handleCreateInvoice}
        onSchedule={handleSchedule}
        onSendToYard={handleSendToYard}
        onAddVisit={handleAddVisit}
        onReportIssue={handleReportIssue}
        onCreateTicket={mode === 'view' && jobId ? handleCreateTicket : undefined}
      />

      {/* Main Layout: Content + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto space-y-6">
          {/* Job Name/Description Section (edit mode) */}
          {mode !== 'view' && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Job Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="e.g., Phase 1 - Main Installation"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={form.jobAddress?.line1 || ''}
                    onChange={(e) =>
                      setFields({
                        jobAddress: { ...form.jobAddress, line1: e.target.value },
                      })
                    }
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={2}
                  placeholder="Describe the work to be done..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={form.specialInstructions}
                  onChange={(e) => setField('specialInstructions', e.target.value)}
                  rows={2}
                  placeholder="Gate access codes, parking notes, etc..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 bg-yellow-50"
                />
              </div>
            </div>
          )}

          {/* Line Items Section (edit mode - read only) */}
          {mode !== 'view' && job && (job as any).line_items && (job as any).line_items.length > 0 && (
            <JobLineItemsSection
              lineItems={(job as any).line_items}
              totalAmount={job.quoted_total || undefined}
            />
          )}

          {/* Job Summary (view mode) */}
          {mode === 'view' && job && (
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{job.name || job.job_number}</h2>
                  {job.job_address && (
                    <p className="text-gray-600 mt-1">
                      {job.job_address.line1}
                      {job.job_address.line2 && `, ${job.job_address.line2}`}
                      <br />
                      {job.job_address.city}, {job.job_address.state} {job.job_address.zip}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    ${(job.quoted_total || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Quoted Total</div>
                </div>
              </div>

              {job.description && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
                </div>
              )}

              {job.special_instructions && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Special Instructions</h3>
                  <p className="text-gray-600 whitespace-pre-wrap bg-yellow-50 p-3 rounded-lg">
                    {job.special_instructions}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Line Items Section (view mode) */}
          {mode === 'view' && job && (job as any).line_items && (
            <JobLineItemsSection
              lineItems={(job as any).line_items}
              totalAmount={job.quoted_total || undefined}
            />
          )}

          {/* Visits Timeline - ALWAYS VISIBLE */}
          <JobVisitsSection
            mode={mode}
            jobId={jobId}
            visits={visits}
            isLoading={false}
            onAddVisit={handleAddVisit}
            onEditVisit={handleEditVisit}
            onCompleteVisit={handleCompleteVisit}
            onStartVisit={handleStartVisit}
          />

          {/* Budget vs Actual */}
          {mode === 'view' && (
            <JobBudgetSection
              mode={mode}
              totals={totals}
              hasRework={job?.has_rework}
              reworkReason={job?.rework_reason}
              reworkCost={job?.rework_cost}
            />
          )}

          {/* Budget Entry (edit mode) */}
          {mode !== 'view' && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold mb-4">Budget</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Est. Labor Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.budgetedLaborHours || ''}
                    onChange={(e) =>
                      setField('budgetedLaborHours', parseFloat(e.target.value) || null)
                    }
                    placeholder="8"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Cost
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.budgetedLaborCost || ''}
                      onChange={(e) =>
                        setField('budgetedLaborCost', parseFloat(e.target.value) || null)
                      }
                      className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material Cost
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.budgetedMaterialCost || ''}
                      onChange={(e) =>
                        setField('budgetedMaterialCost', parseFloat(e.target.value) || null)
                      }
                      className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          {(mode !== 'view' || form.notes || form.internalNotes) && (
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h2 className="text-lg font-semibold">Notes</h2>

              {(mode !== 'view' || form.notes) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Notes
                  </label>
                  {mode !== 'view' ? (
                    <textarea
                      value={form.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                      rows={3}
                      placeholder="Notes visible to the client..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{form.notes}</p>
                  )}
                </div>
              )}

              {(mode !== 'view' || form.internalNotes) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  {mode !== 'view' ? (
                    <textarea
                      value={form.internalNotes}
                      onChange={(e) => setField('internalNotes', e.target.value)}
                      rows={3}
                      placeholder="Private notes for your team..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 bg-yellow-50"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap bg-yellow-50 p-3 rounded-lg">
                      {form.internalNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Workflow Progress Section (view mode only) */}
          {mode === 'view' && job && (
            <CollapsibleSection
              title="Workflow Progress"
              icon={<Clock className="w-5 h-5" />}
              defaultOpen={true}
            >
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
            </CollapsibleSection>
          )}

          {/* Issues Section (view mode only) */}
          {mode === 'view' && jobId && (
            <CollapsibleSection
              title="Issues"
              icon={<AlertTriangle className="w-5 h-5" />}
              defaultOpen={jobIssues && jobIssues.length > 0}
              badge={
                jobIssues && jobIssues.length > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    {jobIssues.length}
                  </span>
                ) : undefined
              }
            >
              <JobIssuesList jobId={jobId} />
            </CollapsibleSection>
          )}

          {/* Activity Section (view mode only, collapsed by default) */}
          {mode === 'view' && job && (
            <CollapsibleSection
              title="Activity"
              icon={<History className="w-5 h-5" />}
              defaultOpen={false}
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                  <div>
                    <p>Status changed to <strong>{JOB_STATUS_LABELS[job.status]}</strong></p>
                    <p className="text-gray-500">{formatDateTime(job.status_changed_at)}</p>
                  </div>
                </div>
                {job.work_completed_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                    <div>
                      <p>Work completed</p>
                      <p className="text-gray-500">{formatDateTime(job.work_completed_at)}</p>
                    </div>
                  </div>
                )}
                {job.work_started_at && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                    <div>
                      <p>Work started</p>
                      <p className="text-gray-500">{formatDateTime(job.work_started_at)}</p>
                    </div>
                  </div>
                )}
                {job.scheduled_date && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                    <div>
                      <p>Job scheduled for {new Date(job.scheduled_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5" />
                  <div>
                    <p>Job created</p>
                    <p className="text-gray-500">{formatDateTime(job.created_at)}</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}
        </main>

        {/* Right Sidebar */}
        <JobSidebar
          mode={mode}
          form={form}
          job={job ?? null}
          crews={crews}
          isLoadingCrews={isLoadingCrews}
          validation={validation}
          onFieldChange={handleFieldChange}
          onCrewChange={handleCrewChange}
          onRepChange={handleRepChange}
        />
      </div>

      {/* TODO: Visit Editor Modal */}
      {showVisitEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingVisit ? 'Edit Visit' : 'Add Visit'}
            </h3>
            <p className="text-gray-600 mb-4">
              Visit editor modal coming soon...
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowVisitEditor(false);
                  setEditingVisit(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowVisitEditor(false);
                  setEditingVisit(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Visit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Ticket Modal */}
      {ticketContext && (
        <QuickTicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          context={ticketContext}
          onSuccess={(ticketId) => {
            console.log('Ticket created:', ticketId);
            // Could navigate to ticket or show toast here
          }}
        />
      )}
    </div>
  );
}

// Helper function to format date/time
function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Helper component for workflow steps
function WorkflowStep({
  label,
  timestamp,
  completed,
}: {
  label: string;
  timestamp: string | null | undefined;
  completed: boolean;
}) {
  const formatTime = (ts: string | null | undefined) => {
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
