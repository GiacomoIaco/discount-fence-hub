/**
 * ProjectDetailPage - Full page view of a project
 *
 * Shows all related entities: Requests, Quotes, Jobs, Invoices
 * in a timeline/grouped view.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  FileText,
  Hammer,
  Receipt,
  MapPin,
  User,
  Calendar,
  DollarSign,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Building,
} from 'lucide-react';
import { useProject, useProjectEntities, useUpdateProjectStatus } from '../hooks/useProjects';
import ProjectJobsTimeline from '../components/ProjectJobsTimeline';
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  type ProjectStatus,
} from '../types';

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

interface ProjectDetailPageProps {
  projectId: string;
  onBack: () => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
}

export default function ProjectDetailPage({
  projectId,
  onBack,
  onNavigateToRequest,
  onNavigateToQuote,
  onNavigateToJob,
  onNavigateToInvoice,
}: ProjectDetailPageProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('all');

  const { data: project, isLoading, error } = useProject(projectId);
  const { data: entities, isLoading: entitiesLoading } = useProjectEntities(projectId);
  const updateStatusMutation = useUpdateProjectStatus();

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderEntityCard = (
    type: 'request' | 'quote' | 'job' | 'invoice',
    entity: Record<string, unknown>,
    onClick?: () => void
  ) => {
    const getStatusBadge = () => {
      const status = entity.status as string;
      switch (type) {
        case 'request':
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REQUEST_STATUS_COLORS[status as keyof typeof REQUEST_STATUS_COLORS] || 'bg-gray-100'}`}>
              {REQUEST_STATUS_LABELS[status as keyof typeof REQUEST_STATUS_LABELS] || status}
            </span>
          );
        case 'quote':
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUOTE_STATUS_COLORS[status as keyof typeof QUOTE_STATUS_COLORS] || 'bg-gray-100'}`}>
              {QUOTE_STATUS_LABELS[status as keyof typeof QUOTE_STATUS_LABELS] || status}
            </span>
          );
        case 'job':
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${JOB_STATUS_COLORS[status as keyof typeof JOB_STATUS_COLORS] || 'bg-gray-100'}`}>
              {JOB_STATUS_LABELS[status as keyof typeof JOB_STATUS_LABELS] || status}
            </span>
          );
        case 'invoice':
          return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[status as keyof typeof INVOICE_STATUS_COLORS] || 'bg-gray-100'}`}>
              {INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS] || status}
            </span>
          );
      }
    };

    const getIcon = () => {
      switch (type) {
        case 'request':
          return <ClipboardList className="w-4 h-4 text-blue-600" />;
        case 'quote':
          return <FileText className="w-4 h-4 text-green-600" />;
        case 'job':
          return <Hammer className="w-4 h-4 text-orange-600" />;
        case 'invoice':
          return <Receipt className="w-4 h-4 text-purple-600" />;
      }
    };

    const getNumber = () => {
      switch (type) {
        case 'request':
          return entity.request_number;
        case 'quote':
          return entity.quote_number;
        case 'job':
          return entity.job_number;
        case 'invoice':
          return entity.invoice_number;
      }
    };

    return (
      <button
        key={entity.id as string}
        onClick={onClick}
        className="w-full flex items-center gap-3 p-3 bg-white border rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left"
      >
        <div className="p-2 bg-gray-50 rounded-lg">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{getNumber() as string}</span>
            {getStatusBadge()}
            {type === 'job' && Boolean(entity.is_warranty) && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                Warranty
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
            {entity.product_type ? <span>{String(entity.product_type)}</span> : null}
            {type === 'quote' && entity.total ? (
              <span className="font-medium text-gray-700">{formatCurrency(entity.total as number)}</span>
            ) : null}
            {type === 'job' && entity.scheduled_date ? (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(entity.scheduled_date as string)}
              </span>
            ) : null}
            {type === 'invoice' && (
              <>
                <span className="font-medium text-gray-700">{formatCurrency(entity.total as number)}</span>
                {(entity.balance_due as number) > 0 && (
                  <span className="text-red-600">Due: {formatCurrency(entity.balance_due as number)}</span>
                )}
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {project.project_number}
                  </h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PROJECT_STATUS_COLORS[project.status]}`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {project.product_type || 'No product type'}
                  {project.client && ` • ${project.client.name}`}
                </p>
              </div>
            </div>

            {/* Status Change Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={project.status}
                onChange={(e) => updateStatusMutation.mutate({ id: project.id, status: e.target.value as ProjectStatus })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                disabled={updateStatusMutation.isPending}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column - Entities */}
          <div className="lg:col-span-2 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{entities?.requests.length || 0}</div>
                <div className="text-sm text-gray-500">Requests</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{entities?.quotes.length || 0}</div>
                <div className="text-sm text-gray-500">Quotes</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{entities?.jobs.length || 0}</div>
                <div className="text-sm text-gray-500">Jobs</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{entities?.invoices.length || 0}</div>
                <div className="text-sm text-gray-500">Invoices</div>
              </div>
            </div>

            {entitiesLoading ? (
              <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                Loading entities...
              </div>
            ) : (
              <>
                {/* Requests Section */}
                {entities?.requests && entities.requests.length > 0 && (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleSection('requests')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        <span className="font-medium">Requests ({entities.requests.length})</span>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'requests' || expandedSection === 'all' ? 'rotate-90' : ''}`} />
                    </button>
                    {(expandedSection === 'requests' || expandedSection === 'all') && (
                      <div className="p-4 pt-0 space-y-2">
                        {entities.requests.map((request) =>
                          renderEntityCard('request', request, () => onNavigateToRequest?.(request.id))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Quotes Section */}
                {entities?.quotes && entities.quotes.length > 0 && (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleSection('quotes')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="font-medium">Quotes ({entities.quotes.length})</span>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'quotes' || expandedSection === 'all' ? 'rotate-90' : ''}`} />
                    </button>
                    {(expandedSection === 'quotes' || expandedSection === 'all') && (
                      <div className="p-4 pt-0 space-y-2">
                        {entities.quotes.map((quote) =>
                          renderEntityCard('quote', quote, () => onNavigateToQuote?.(quote.id))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Jobs Section - Enhanced Timeline */}
                {entities?.jobs && entities.jobs.length > 0 && (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleSection('jobs')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <Hammer className="w-5 h-5 text-orange-600" />
                        <span className="font-medium">Jobs ({entities.jobs.length})</span>
                        {entities.jobs.length > 1 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600">
                            Multi-Job Project
                          </span>
                        )}
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'jobs' || expandedSection === 'all' ? 'rotate-90' : ''}`} />
                    </button>
                    {(expandedSection === 'jobs' || expandedSection === 'all') && (
                      <div className="p-4 pt-0">
                        <ProjectJobsTimeline
                          projectId={projectId}
                          onNavigateToJob={onNavigateToJob}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Invoices Section */}
                {entities?.invoices && entities.invoices.length > 0 && (
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <button
                      onClick={() => toggleSection('invoices')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-purple-600" />
                        <span className="font-medium">Invoices ({entities.invoices.length})</span>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === 'invoices' || expandedSection === 'all' ? 'rotate-90' : ''}`} />
                    </button>
                    {(expandedSection === 'invoices' || expandedSection === 'all') && (
                      <div className="p-4 pt-0 space-y-2">
                        {entities.invoices.map((invoice) =>
                          renderEntityCard('invoice', invoice, () => onNavigateToInvoice?.(invoice.id))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {!entities?.requests.length && !entities?.quotes.length && !entities?.jobs.length && !entities?.invoices.length && (
                  <div className="bg-white rounded-lg border p-8 text-center">
                    <div className="text-gray-400 mb-2">
                      <Briefcase className="w-12 h-12 mx-auto" />
                    </div>
                    <p className="text-gray-500">No entities linked to this project yet</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Project Details */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium text-gray-900 mb-4">Project Details</h3>
              <div className="space-y-3">
                {project.client && (
                  <div className="flex items-start gap-3">
                    <Building className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Client</p>
                      <p className="font-medium text-blue-600">{project.client.name}</p>
                    </div>
                  </div>
                )}

                {project.community && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Community</p>
                      <p className="font-medium">{project.community.name}</p>
                    </div>
                  </div>
                )}

                {project.address_line1 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-medium">{project.address_line1}</p>
                      {(project.city || project.state || project.zip) && (
                        <p className="text-sm text-gray-500">
                          {[project.city, project.state, project.zip].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {project.assigned_rep && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Assigned Rep</p>
                      <p className="font-medium">{project.assigned_rep.name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">{formatDate(project.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financials */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium text-gray-900 mb-4">Financials</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Quoted</span>
                  <span className="font-medium">{formatCurrency(project.total_quoted)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Invoiced</span>
                  <span className="font-medium">{formatCurrency(project.total_invoiced)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(project.total_paid)}</span>
                </div>
                {project.total_invoiced > project.total_paid && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium text-gray-700">Balance Due</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(project.total_invoiced - project.total_paid)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Status */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-medium text-gray-900 mb-4">Status Summary</h3>
              <div className="space-y-2">
                {entities?.jobs.some(j => j.status === 'in_progress') && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>Work in progress</span>
                  </div>
                )}
                {entities?.jobs.some(j => j.status === 'completed') && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Job completed</span>
                  </div>
                )}
                {entities?.invoices.some(i => i.status === 'past_due') && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span>Invoice past due</span>
                  </div>
                )}
                {entities?.invoices.every(i => i.status === 'paid') && entities.invoices.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span>Fully paid</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
