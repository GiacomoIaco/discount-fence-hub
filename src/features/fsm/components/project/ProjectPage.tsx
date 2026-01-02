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
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  LayoutDashboard,
  FileText,
  Wrench,
  Receipt,
  FolderOpen,
  Clock,
  Plus,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import {
  useProjectFull,
  useProjectQuotes,
  useProjectJobs,
  useProjectInvoices,
  useChildProjects,
} from '../../hooks/useProjects';
import { EntityHeader, type Badge } from '../shared/EntityHeader';
import { TotalsDisplay } from '../shared/TotalsDisplay';
import { WorkflowProgress, type WorkflowStep } from '../shared/WorkflowProgress';
import { EstimatesTab } from './tabs/EstimatesTab';
import { WorkTab } from './tabs/WorkTab';
import { BillingTab } from './tabs/BillingTab';
import QuoteToJobsModal from '../QuoteToJobsModal';
import type { Project, ProjectStatus, Quote } from '../../types';

// Tab types
type ProjectTab = 'overview' | 'estimates' | 'work' | 'billing' | 'files' | 'activity';

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
  warranty: 'Warranty',
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
  warranty: 'bg-purple-100 text-purple-700',
};

// Tab configuration
const TABS: { id: ProjectTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'estimates', label: 'Estimates', icon: FileText },
  { id: 'work', label: 'Work', icon: Wrench },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'activity', label: 'Activity', icon: Clock },
];

interface ProjectPageProps {
  projectId: string;
  onBack: () => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onCreateQuote?: () => void;
  onCreateJob?: () => void;
  onEditProject?: () => void;
}

export function ProjectPage({
  projectId,
  onBack,
  onNavigateToQuote,
  onNavigateToJob,
  onNavigateToInvoice,
  onCreateQuote,
  onCreateJob,
  onEditProject,
}: ProjectPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProjectTab>(
    (searchParams.get('tab') as ProjectTab) || 'overview'
  );
  // State for QuoteToJobsModal
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);

  // Sync tab with URL
  useEffect(() => {
    const urlTab = searchParams.get('tab') as ProjectTab;
    if (urlTab && TABS.some((t) => t.id === urlTab)) {
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

  // Compute workflow steps based on project state
  const getWorkflowSteps = (): WorkflowStep[] => {
    const hasAcceptedQuote = quotes.some((q) => q.acceptance_status === 'accepted');
    const hasActiveJobs = jobs.some((j) => !['completed', 'cancelled'].includes(j.status));
    const hasCompletedJobs = jobs.some((j) => j.status === 'completed');
    const hasPaidInvoices = invoices.some((i) => i.status === 'paid');
    const allInvoicesPaid = invoices.length > 0 && invoices.every((i) => i.status === 'paid');

    return [
      {
        id: 'quote',
        label: 'Quote',
        completed: hasAcceptedQuote,
        current: !hasAcceptedQuote && quotes.length > 0,
      },
      {
        id: 'jobs',
        label: 'Jobs',
        completed: hasCompletedJobs && !hasActiveJobs,
        current: hasActiveJobs,
      },
      {
        id: 'invoice',
        label: 'Invoice',
        completed: hasPaidInvoices,
        current: invoices.length > 0 && !hasPaidInvoices,
      },
      {
        id: 'paid',
        label: 'Paid',
        completed: allInvoicesPaid,
        current: false,
      },
    ];
  };

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

  // Build header content
  const statusBadge: Badge = {
    label: PROJECT_STATUS_LABELS[project.status],
    colorClass: PROJECT_STATUS_COLORS[project.status],
  };

  const extraBadges: Badge[] = [];
  if (project.has_rework) {
    extraBadges.push({
      label: 'Has Rework',
      colorClass: 'bg-red-100 text-red-700',
    });
  }
  if (project.parent_project_id) {
    extraBadges.push({
      label: project.relationship_type || 'Related',
      colorClass: 'bg-purple-100 text-purple-700',
    });
  }

  // Subtitle content
  const subtitleContent = (
    <>
      {project.client_display_name || project.client?.name || 'No client'}
      {project.property_address && (
        <span className="text-gray-400">|</span>
      )}
      {project.property_address && (
        <span>
          {project.property_address}
          {project.property_city && `, ${project.property_city}`}
        </span>
      )}
      {project.qbo_class?.labor_code && (
        <>
          <span className="text-gray-400">|</span>
          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
            {project.qbo_class.labor_code}
          </span>
        </>
      )}
    </>
  );

  // Actions
  const headerActions = (
    <>
      {activeTab === 'estimates' && onCreateQuote && (
        <button
          onClick={onCreateQuote}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Quote
        </button>
      )}
      {activeTab === 'work' && onCreateJob && (
        <button
          onClick={onCreateJob}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Job
        </button>
      )}
      {onEditProject && (
        <button
          onClick={onEditProject}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Edit Project"
        >
          <Edit2 className="w-5 h-5 text-gray-500" />
        </button>
      )}
      <button className="p-2 hover:bg-gray-100 rounded-lg">
        <MoreVertical className="w-5 h-5 text-gray-500" />
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <EntityHeader
        onBack={onBack}
        icon={Briefcase}
        iconBgClass="bg-blue-100"
        iconColorClass="text-blue-600"
        title={project.project_number || project.name || 'Project'}
        statusBadge={statusBadge}
        extraBadges={extraBadges}
        subtitle={subtitleContent}
        workflowProgress={<WorkflowProgress steps={getWorkflowSteps()} compact />}
        actions={headerActions}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 border-t pt-4 -mx-6 px-6 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            // Count badges for certain tabs
            let count: number | null = null;
            if (tab.id === 'estimates') count = quotes.length;
            if (tab.id === 'work') count = jobs.length;
            if (tab.id === 'billing') count = invoices.length;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {count !== null && count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </EntityHeader>

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

export default ProjectPage;
