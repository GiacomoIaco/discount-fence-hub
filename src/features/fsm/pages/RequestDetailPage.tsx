/**
 * RequestDetailPage - Full page view of a service request
 *
 * Accessible via URL: /requests/:id
 *
 * Tabs:
 * - Overview: Request details, contact info, status
 * - Assessment: Schedule/complete assessment
 * - Activity: Status history and notes
 */

import { useState } from 'react';
import {
  Edit2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  PlusCircle,
  History,
  Clipboard,
  Navigation,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';
import { useRequest, useScheduleAssessment, useCompleteAssessment, useConvertRequestToJob } from '../hooks/useRequests';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  SOURCE_LABELS,
} from '../types';
import { hasValidCoordinates, formatCoordinates } from '../../shared/types/location';
import { RequestProgress } from '../components/shared/WorkflowProgress';
import { EntityHeader } from '../components/shared/EntityHeader';
import { EntityMessagesTab } from '../components/EntityMessagesTab';
import { useEntityMessageCount } from '../../message-center/hooks/useEntityMessages';
import { MessageSquare } from 'lucide-react';

type Tab = 'overview' | 'assessment' | 'messages' | 'activity';

interface RequestDetailPageProps {
  requestId: string;
  onBack: () => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
  onCreateQuote?: (requestId: string) => void;
  onEdit?: (requestId: string) => void;
}

export default function RequestDetailPage({
  requestId,
  onBack,
  onNavigateToQuote,
  onNavigateToJob,
  onNavigateToProject,
  onCreateQuote,
  onEdit,
}: RequestDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const { data: request, isLoading, error } = useRequest(requestId);
  const { data: messageCount } = useEntityMessageCount('request', requestId);
  const scheduleAssessmentMutation = useScheduleAssessment();
  const completeAssessmentMutation = useCompleteAssessment();
  const convertToJobMutation = useConvertRequestToJob();

  // Schedule assessment form state
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Complete assessment form state
  const [assessmentNotes, setAssessmentNotes] = useState('');

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleScheduleAssessment = async () => {
    if (!request || !scheduleDate) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    await scheduleAssessmentMutation.mutateAsync({
      id: request.id,
      scheduledAt,
    });
    setShowScheduleModal(false);
    setScheduleDate('');
  };

  const handleCompleteAssessment = async () => {
    if (!request) return;
    await completeAssessmentMutation.mutateAsync({
      id: request.id,
      notes: assessmentNotes || undefined,
    });
    setShowCompleteModal(false);
    setAssessmentNotes('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading request...</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Request not found</p>
          <button
            onClick={onBack}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const canScheduleAssessment = request.requires_assessment && !request.assessment_scheduled_at;
  const canCompleteAssessment = request.assessment_scheduled_at && !request.assessment_completed_at;
  const isReadyForConversion = request.status === 'assessment_completed' || !request.requires_assessment;
  const isNotConverted = !request.converted_to_quote_id && !request.converted_to_job_id;
  const canConvert = isReadyForConversion && isNotConverted;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'assessment', label: 'Assessment', icon: <Clipboard className="w-4 h-4" /> },
    { id: 'messages', label: `Messages${messageCount ? ` (${messageCount})` : ''}`, icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  ];

  // Build action buttons based on request state
  const actionButtons = (
    <>
      <button
        onClick={() => onEdit?.(request.id)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Edit2 className="w-4 h-4" />
        Edit
      </button>

      {/* Convert options - only show when ready and not yet converted */}
      {canConvert && (
        <>
          <button
            onClick={() => onCreateQuote?.(request.id)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <PlusCircle className="w-4 h-4" />
            Create Quote
          </button>
          {/* Direct to Job - only if client is assigned */}
          {request.client_id && (
            <button
              onClick={async () => {
                const job = await convertToJobMutation.mutateAsync(request.id);
                onNavigateToJob?.(job.id);
              }}
              disabled={convertToJobMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              title="Skip quote and create job directly (for builders without PO process)"
            >
              <PlusCircle className="w-4 h-4" />
              {convertToJobMutation.isPending ? 'Creating...' : 'Create Job'}
            </button>
          )}
        </>
      )}

      {/* Already converted - show navigation buttons */}
      {request.converted_to_quote_id && (
        <button
          onClick={() => onNavigateToQuote?.(request.converted_to_quote_id!)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          View Quote
        </button>
      )}
      {request.converted_to_job_id && (
        <button
          onClick={() => onNavigateToJob?.(request.converted_to_job_id!)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          View Job
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <EntityHeader
        onBack={onBack}
        title={request.request_number}
        statusBadge={{
          label: REQUEST_STATUS_LABELS[request.status],
          colorClass: REQUEST_STATUS_COLORS[request.status],
        }}
        extraBadges={[
          {
            label: PRIORITY_LABELS[request.priority],
            colorClass: PRIORITY_COLORS[request.priority],
          },
        ]}
        subtitle={
          <span>
            {request.product_type || 'No product type'} • {SOURCE_LABELS[request.source]}
            {request.linear_feet_estimate && ` • ${request.linear_feet_estimate} LF`}
          </span>
        }
        workflowProgress={
          <RequestProgress
            status={request.status}
            requiresAssessment={request.requires_assessment}
            assessmentScheduledAt={request.assessment_scheduled_at}
            assessmentCompletedAt={request.assessment_completed_at}
            convertedToQuoteId={request.converted_to_quote_id}
            convertedToJobId={request.converted_to_job_id}
            compact
          />
        }
        actions={actionButtons}
      >
        {/* Tabs */}
        <div className="px-6">
          <nav className="flex gap-6 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </EntityHeader>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              {request.description && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{request.description}</p>
                </div>
              )}

              {/* Contact Information */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {request.contact_name && (
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Contact Name</p>
                        <p className="font-medium">{request.contact_name}</p>
                      </div>
                    </div>
                  )}
                  {request.contact_phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <a
                          href={`tel:${request.contact_phone}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {request.contact_phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {request.contact_email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <a
                          href={`mailto:${request.contact_email}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          {request.contact_email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              {request.address_line1 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Job Site Address</h3>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{request.address_line1}</p>
                      <p className="text-gray-600">
                        {[request.city, request.state, request.zip].filter(Boolean).join(', ')}
                      </p>
                      {hasValidCoordinates(request.latitude, request.longitude) && (
                        <div className="flex items-center gap-2 mt-2">
                          <Navigation className="w-4 h-4 text-green-600" />
                          <span className="font-mono text-sm text-gray-600">
                            {formatCoordinates(request.latitude!, request.longitude!, 6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${request.latitude},${request.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Open in Maps
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {request.notes && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Internal Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{request.notes}</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Details</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Created</span>
                    <span className="text-sm font-medium">{formatDate(request.created_at)}</span>
                  </div>
                  {request.client && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Client</span>
                      <span className="text-sm font-medium text-blue-600">{request.client.name}</span>
                    </div>
                  )}
                  {request.community && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Community</span>
                      <span className="text-sm font-medium">{request.community.name}</span>
                    </div>
                  )}
                  {request.assigned_rep_user && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Assigned To</span>
                      <span className="text-sm font-medium">{request.assigned_rep_user.name}</span>
                    </div>
                  )}
                  {request.territory && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Territory</span>
                      <span className="text-sm font-medium">{request.territory.name}</span>
                    </div>
                  )}
                  {/* Show linked project when request has been converted */}
                  {request.project_id && (
                    <div className="flex items-center justify-between pt-3 mt-3 border-t">
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <FolderOpen className="w-4 h-4" />
                        Created Project
                      </span>
                      <button
                        onClick={() => onNavigateToProject?.(request.project_id!)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        View Project
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Status changes via actions only - removed manual status dropdown per Jobber pattern */}
            </div>
          </div>
        )}

        {activeTab === 'assessment' && (
          <div className="max-w-2xl space-y-6">
            {/* Assessment Status Card */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${request.assessment_completed_at ? 'bg-green-100' : request.assessment_scheduled_at ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  {request.assessment_completed_at ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <Calendar className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {request.assessment_completed_at
                      ? 'Assessment Completed'
                      : request.assessment_scheduled_at
                      ? 'Assessment Scheduled'
                      : 'No Assessment Scheduled'}
                  </h3>
                  {request.assessment_scheduled_at && (
                    <p className="text-sm text-gray-500">
                      {formatDateTime(request.assessment_scheduled_at)}
                    </p>
                  )}
                </div>
              </div>

              {/* Assessment Details */}
              {request.assessment_completed_at && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Completed</span>
                    <span className="text-sm font-medium">{formatDateTime(request.assessment_completed_at)}</span>
                  </div>
                  {request.assessment_rep_user && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Completed By</span>
                      <span className="text-sm font-medium">{request.assessment_rep_user.name}</span>
                    </div>
                  )}
                  {request.assessment_notes && (
                    <div className="pt-2">
                      <p className="text-sm text-gray-500 mb-2">Assessment Notes</p>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                        {request.assessment_notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                {canScheduleAssessment && (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule Assessment
                  </button>
                )}
                {canCompleteAssessment && (
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Assessment
                  </button>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Assessment Requirements</h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={request.requires_assessment}
                  disabled
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-700">Site assessment required before quoting</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <EntityMessagesTab
            entityType="request"
            entityId={requestId}
            entityLabel={`Request ${request.request_number}`}
            contactPhone={request.contact_phone ?? undefined}
            contactName={request.contact_name || request.client?.name}
          />
        )}

        {activeTab === 'activity' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Status History</h3>
              <div className="space-y-4">
                {/* Current status */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {REQUEST_STATUS_LABELS[request.status]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(request.status_changed_at)}
                    </p>
                  </div>
                </div>
                {/* Creation */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Request Created</p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(request.created_at)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-6 pt-4 border-t">
                Full activity history coming soon...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Schedule Assessment Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Assessment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleAssessment}
                disabled={!scheduleDate || scheduleAssessmentMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {scheduleAssessmentMutation.isPending ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Assessment Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Assessment</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assessment Notes (optional)
              </label>
              <textarea
                value={assessmentNotes}
                onChange={(e) => setAssessmentNotes(e.target.value)}
                rows={4}
                placeholder="Add any notes from the site visit..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteAssessment}
                disabled={completeAssessmentMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {completeAssessmentMutation.isPending ? 'Completing...' : 'Complete Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
