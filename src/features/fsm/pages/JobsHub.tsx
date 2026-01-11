/**
 * JobsHub - FSM Jobs Hub (Project-First Architecture)
 *
 * Routes:
 * - /jobs → JobsList (list view)
 * - /jobs/:id → JobCard (unified view/edit)
 *
 * Flow:
 * - "New Job" → ProjectCreateWizard → Project Detail (add job there)
 * - Click job → JobCard (view mode with collapsible sections)
 * - Edit button → JobCard (edit mode)
 */

import { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  Users,
} from 'lucide-react';
import { useJobs } from '../hooks/useJobs';
import { JobCard } from '../components/JobCard';
import { ProjectCreateWizard } from '../components/project';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from '../types';
import type { EntityContext } from '../../../hooks/useRouteSync';
import type { EntityType } from '../../../lib/routes';

interface JobsHubProps {
  onBack?: () => void;
  /** Entity context from URL for deep linking (e.g., /jobs/abc123) */
  entityContext?: EntityContext | null;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list) */
  onClearEntity?: () => void;
}

export default function JobsHub({
  entityContext,
  onNavigateToEntity,
  onClearEntity,
}: JobsHubProps) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Project-First Architecture state
  const [showProjectWizard, setShowProjectWizard] = useState(false);

  const filters = statusFilter === 'all' ? undefined : { status: statusFilter };
  const { data: jobs, isLoading, error } = useJobs(filters);

  // Filter jobs by search query
  const filteredJobs = jobs?.filter(job => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.job_number?.toLowerCase().includes(query) ||
      job.client?.name?.toLowerCase().includes(query) ||
      job.community?.name?.toLowerCase().includes(query) ||
      job.product_type?.toLowerCase().includes(query)
    );
  });

  // Handle job selection - update URL
  const handleJobSelect = (jobId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('job', { id: jobId });
    }
  };

  // Handle closing job detail - clear URL
  const handleJobClose = () => {
    if (onClearEntity) {
      onClearEntity();
    }
  };

  // Handle navigation to related entities
  const handleNavigateToQuote = (quoteId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('quote', { id: quoteId });
    }
  };

  const handleNavigateToInvoice = (invoiceId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('invoice', { id: invoiceId });
    }
  };

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
    });
  };

  // Show ProjectCreateWizard when creating new job
  if (showProjectWizard) {
    return (
      <ProjectCreateWizard
        isOpen={true}
        onClose={() => setShowProjectWizard(false)}
        onComplete={(result) => {
          setShowProjectWizard(false);
          // Navigate to the new project to add job
          if (onNavigateToEntity) {
            onNavigateToEntity('project', { id: result.projectId });
          }
        }}
        initialData={{ source: 'phone' }}  // Using 'phone' as source for jobs created directly
      />
    );
  }

  // If viewing a specific job, render JobCard in view mode
  if (entityContext?.type === 'job') {
    return (
      <JobCard
        mode="view"
        jobId={entityContext.id}
        onBack={handleJobClose}
        onCancel={handleJobClose}
        onComplete={(jobId) => {
          // Stay on the job detail after completion
          console.log('Job completed:', jobId);
        }}
        onCreateInvoice={(jobId) => {
          // Navigate to invoice after creation
          // TODO: Get invoice ID from job after refresh
          console.log('Invoice created for job:', jobId);
        }}
      />
    );
  }

  // Otherwise, render the list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wrench className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
                <p className="text-sm text-gray-500">Manage active jobs and work orders</p>
              </div>
            </div>
            <button
              onClick={() => setShowProjectWizard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
              New Job
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="p-8 text-center text-red-600">
            Error loading jobs: {error.message}
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading jobs...</div>
        ) : !filteredJobs?.length ? (
          <div className="p-8 text-center border-2 border-dashed rounded-lg bg-white">
            <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No jobs found</p>
            <button
              onClick={() => setShowProjectWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
              Create First Job
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleJobSelect(job.id)}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Wrench className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {job.job_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                            {JOB_STATUS_LABELS[job.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {job.client && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {job.client.name}
                            </span>
                          )}
                          {job.product_type && (
                            <span>{job.product_type}</span>
                          )}
                          {job.linear_feet && (
                            <span>{job.linear_feet} LF</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {formatDate(job.scheduled_date)}
                    </div>
                    {job.assigned_crew && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Users className="w-4 h-4" />
                        {job.assigned_crew.name}
                      </div>
                    )}
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(job.quoted_total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
