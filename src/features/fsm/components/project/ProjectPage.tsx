/**
 * ProjectPage - Main container for Project-First architecture
 *
 * Provides tabbed navigation:
 * - Overview: Project summary, timeline, totals
 * - Estimates: Quotes list with acceptance status
 * - Work: Jobs by phase, visits timeline
 * - Billing: Invoices, payments, balance
 * - Files: Attachments (future)
 * - Activity: Status history, notes
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Clock,
  Plus,
  AlertTriangle,
  FileText,
  CheckCircle,
  Wrench,
  Receipt,
  DollarSign,
  Calendar,
} from 'lucide-react';
import {
  useProjectFull,
  useProjectQuotes,
  useProjectJobs,
  useProjectInvoices,
  useChildProjects,
} from '../../hooks/useProjects';
import { TotalsDisplay } from '../shared/TotalsDisplay';
import UnifiedProjectHeader, { type ProjectTab } from './UnifiedProjectHeader';
import ProjectEditorModal from './ProjectEditorModal';
import { EstimatesTab } from './tabs/EstimatesTab';
import { WorkTab } from './tabs/WorkTab';
import { BillingTab } from './tabs/BillingTab';
import QuoteToJobsModal from '../QuoteToJobsModal';
import type { Project, Quote } from '../../types';

// Tab IDs for URL sync
const VALID_TABS: ProjectTab[] = ['overview', 'estimates', 'work', 'billing', 'files', 'activity'];

interface ProjectPageProps {
  projectId: string;
  onBack: () => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onCreateQuote?: () => void;
  onCreateJob?: () => void;
}

export function ProjectPage({
  projectId,
  onBack,
  onNavigateToQuote,
  onNavigateToJob,
  onNavigateToInvoice,
  onCreateQuote,
  onCreateJob,
}: ProjectPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProjectTab>(
    (searchParams.get('tab') as ProjectTab) || 'overview'
  );
  // State for QuoteToJobsModal
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  // State for ProjectEditorModal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Navigation handlers for metalinks
  const handleNavigateToClient = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  const handleNavigateToCommunity = (communityId: string) => {
    // Community pages are nested under a client - need the client_id from project
    if (project?.client_id) {
      navigate(`/clients/${project.client_id}/communities/${communityId}`);
    }
  };

  // Sync tab with URL
  useEffect(() => {
    const urlTab = searchParams.get('tab') as ProjectTab;
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: ProjectTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Data fetching
  const { data: project, isLoading, error } = useProjectFull(projectId);
  const { data: quotes = [] } = useProjectQuotes(projectId);
  const { data: jobs = [] } = useProjectJobs(projectId);
  const { data: invoices = [] } = useProjectInvoices(projectId);
  const { data: childProjects = [] } = useChildProjects(projectId);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading project...</div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Project not found</p>
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

  // Tab-specific actions
  const tabActions = (
    <>
      {activeTab === 'estimates' && onCreateQuote && (
        <button
          onClick={onCreateQuote}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </button>
      )}
      {activeTab === 'work' && onCreateJob && (
        <button
          onClick={onCreateJob}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Unified Project Header */}
      <UnifiedProjectHeader
        project={project}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={{
          estimates: quotes.length,
          work: jobs.length,
          billing: invoices.length,
        }}
        onBack={onBack}
        onEdit={() => setIsEditModalOpen(true)}
        tabActions={tabActions}
        onNavigateToClient={handleNavigateToClient}
        onNavigateToCommunity={handleNavigateToCommunity}
      />

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            project={project}
            quotes={quotes}
            jobs={jobs}
            invoices={invoices}
            childProjects={childProjects}
          />
        )}
        {activeTab === 'estimates' && (
          <EstimatesTab
            quotes={quotes as Quote[]}
            projectId={projectId}
            onCreateQuote={onCreateQuote}
            onEditQuote={onNavigateToQuote}
            onConvertToJobs={(quoteId) => {
              const quote = quotes.find((q) => q.id === quoteId) as Quote | undefined;
              if (quote) {
                setConvertingQuote(quote);
              }
            }}
            onViewQuote={onNavigateToQuote}
          />
        )}
        {activeTab === 'work' && (
          <WorkTab
            jobs={jobs}
            projectId={projectId}
            onCreateJob={onCreateJob}
            onViewJob={onNavigateToJob}
          />
        )}
        {activeTab === 'billing' && (
          <BillingTab
            invoices={invoices}
            projectId={projectId}
            onViewInvoice={onNavigateToInvoice}
          />
        )}
        {activeTab === 'files' && <FilesTabPlaceholder />}
        {activeTab === 'activity' && <ActivityTabPlaceholder projectId={projectId} />}
      </div>

      {/* QuoteToJobsModal for multi-job conversion */}
      {convertingQuote && (
        <QuoteToJobsModal
          quote={convertingQuote}
          onClose={() => setConvertingQuote(null)}
          onSuccess={(result) => {
            setConvertingQuote(null);
            // Switch to Work tab after creating jobs
            handleTabChange('work');
            // Optionally navigate to first job
            if (result.jobIds.length > 0 && onNavigateToJob) {
              onNavigateToJob(result.jobIds[0]);
            }
          }}
        />
      )}

      {/* ProjectEditorModal for editing project details */}
      {isEditModalOpen && (
        <ProjectEditorModal
          project={project}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================
// PLACEHOLDER TAB COMPONENTS (will be replaced)
// ============================================

interface OverviewTabProps {
  project: Project;
  quotes: unknown[];
  jobs: unknown[];
  invoices: unknown[];
  childProjects: unknown[];
}

function OverviewTab({ project, quotes, jobs, invoices, childProjects }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Summary Cards */}
      <div className="lg:col-span-2 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{quotes.length}</div>
            <div className="text-sm text-gray-500">Quotes</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{jobs.length}</div>
            <div className="text-sm text-gray-500">Jobs</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{invoices.length}</div>
            <div className="text-sm text-gray-500">Invoices</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{childProjects.length}</div>
            <div className="text-sm text-gray-500">Related</div>
          </div>
        </div>

        {/* Financials */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Financial Summary</h3>
          <TotalsDisplay
            subtotal={project.accepted_quote_total || 0}
            total={project.total_job_value || 0}
            amountPaid={project.total_paid || 0}
            balanceDue={(project.total_job_value || 0) - (project.total_paid || 0)}
            horizontal
          />
        </div>

        {/* Budget vs Actual */}
        {((project.total_budgeted_cost ?? 0) > 0 || (project.total_actual_cost ?? 0) > 0) && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Budgeted Cost</p>
                <p className="text-xl font-bold">
                  ${(project.total_budgeted_cost || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Actual Cost</p>
                <p
                  className={`text-xl font-bold ${
                    (project.total_actual_cost ?? 0) > (project.total_budgeted_cost ?? 0)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  ${(project.total_actual_cost || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Project Details */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500">Client:</span>{' '}
              <span className="font-medium">{project.client_display_name || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">Address:</span>{' '}
              <span className="font-medium">{project.property_address || '-'}</span>
            </div>
            {project.community_name && (
              <div>
                <span className="text-gray-500">Community:</span>{' '}
                <span className="font-medium">{project.community_name}</span>
              </div>
            )}
            {project.qbo_class?.name && (
              <div>
                <span className="text-gray-500">Business Unit:</span>{' '}
                <span className="font-medium">
                  {project.qbo_class.name}
                  {project.qbo_class.labor_code && ` (${project.qbo_class.labor_code})`}
                </span>
              </div>
            )}
            {project.rep_name && (
              <div>
                <span className="text-gray-500">Rep:</span>{' '}
                <span className="font-medium">{project.rep_name}</span>
              </div>
            )}
            {project.source && (
              <div>
                <span className="text-gray-500">Source:</span>{' '}
                <span className="font-medium">{project.source}</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Created:</span>{' '}
              <span className="font-medium">
                {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Project Timeline */}
        <ProjectTimeline project={project} />

        {/* Related Projects */}
        {childProjects.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Related Projects</h3>
            <div className="space-y-2">
              {(childProjects as Project[]).map((child) => (
                <div
                  key={child.id}
                  className="p-2 bg-gray-50 rounded flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{child.name}</span>
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    {child.relationship_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Note: EstimatesTab, WorkTab, and BillingTab are now imported from ./tabs/

function FilesTabPlaceholder() {
  return (
    <div className="bg-white rounded-lg border p-8 text-center">
      <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500">Files tab coming soon</p>
    </div>
  );
}

function ActivityTabPlaceholder({ projectId }: { projectId: string }) {
  return (
    <div className="bg-white rounded-lg border p-8 text-center">
      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-500">Activity tab coming soon</p>
      <p className="text-xs text-gray-400 mt-2">Project ID: {projectId}</p>
    </div>
  );
}

/**
 * ProjectTimeline - Displays lifecycle dates from v_projects_full
 */
interface TimelineEvent {
  label: string;
  date: string | null | undefined;
  icon: React.ReactNode;
  color: string;
}

function ProjectTimeline({ project }: { project: Project }) {
  // Build timeline events from lifecycle dates
  const events: TimelineEvent[] = [
    {
      label: 'Created',
      date: project.created_at,
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-gray-500 bg-gray-100',
    },
    {
      label: 'First Quote Sent',
      date: project.first_quote_sent_at,
      icon: <FileText className="w-4 h-4" />,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Quote Accepted',
      date: project.quote_accepted_at,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Work Started',
      date: project.work_started_at,
      icon: <Wrench className="w-4 h-4" />,
      color: 'text-orange-600 bg-orange-100',
    },
    {
      label: 'Work Completed',
      date: project.work_completed_at,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-teal-600 bg-teal-100',
    },
    {
      label: 'First Invoice Sent',
      date: project.first_invoice_sent_at,
      icon: <Receipt className="w-4 h-4" />,
      color: 'text-purple-600 bg-purple-100',
    },
    {
      label: 'Last Payment',
      date: project.last_payment_at,
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-emerald-600 bg-emerald-100',
    },
  ];

  // Filter to only show events that have dates, or show "Created" always
  const completedEvents = events.filter((e, idx) => idx === 0 || e.date);
  const pendingEvents = events.filter((e, idx) => idx !== 0 && !e.date);

  // Format date helper
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Only show if there's at least one lifecycle event beyond creation
  const hasLifecycleEvents = completedEvents.length > 1;

  if (!hasLifecycleEvents && pendingEvents.length === events.length - 1) {
    // Project just created, no lifecycle events yet
    return null;
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" />
        Project Timeline
      </h3>

      {/* Completed Events */}
      <div className="space-y-3">
        {completedEvents.map((event, idx) => (
          <div key={event.label} className="flex items-center gap-3">
            {/* Timeline connector */}
            <div className="relative flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${event.color}`}>
                {event.icon}
              </div>
              {idx < completedEvents.length - 1 && (
                <div className="absolute top-8 w-0.5 h-3 bg-gray-200" />
              )}
            </div>
            {/* Event details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{event.label}</p>
              <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Events (dimmed) */}
      {pendingEvents.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dashed">
          <p className="text-xs text-gray-400 mb-2">Upcoming</p>
          <div className="space-y-2">
            {pendingEvents.map((event) => (
              <div key={event.label} className="flex items-center gap-3 opacity-40">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-400">
                  {event.icon}
                </div>
                <p className="text-sm text-gray-500">{event.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Days in current stage */}
      {project.days_in_stage != null && project.days_in_stage > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Days in current stage:</span>
            <span className={`font-medium ${project.days_in_stage > 7 ? 'text-amber-600' : 'text-gray-900'}`}>
              {project.days_in_stage} day{project.days_in_stage !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectPage;
