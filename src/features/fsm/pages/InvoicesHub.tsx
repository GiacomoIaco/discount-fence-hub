/**
 * InvoicesHub - FSM Invoices Hub (Project-First Architecture)
 *
 * Routes:
 * - /invoices → InvoicesList (list view)
 * - /invoices/:id → InvoiceDetailPage (detail view)
 *
 * Flow:
 * - "New Invoice" → Job selection modal → Create invoice from job
 * - Click invoice → InvoiceDetailPage
 */

import { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  AlertTriangle,
  X,
  Wrench,
} from 'lucide-react';
import { useInvoices, useCreateInvoice } from '../hooks/useInvoices';
import { useJobs } from '../hooks/useJobs';
import type { Job } from '../types';
import { InvoiceDetailPage } from '../pages';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  type InvoiceStatus,
} from '../types';
import type { EntityContext } from '../../../hooks/useRouteSync';
import type { EntityType } from '../../../lib/routes';

interface InvoicesHubProps {
  onBack?: () => void;
  /** Entity context from URL for deep linking (e.g., /invoices/abc123) */
  entityContext?: EntityContext | null;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list) */
  onClearEntity?: () => void;
}

export default function InvoicesHub({
  entityContext,
  onNavigateToEntity,
  onClearEntity,
}: InvoicesHubProps) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all' | 'past_due'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Job selection modal state
  const [showJobSelector, setShowJobSelector] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');

  const filters = statusFilter === 'all'
    ? undefined
    : statusFilter === 'past_due'
    ? { isPastDue: true }
    : { status: statusFilter };

  const { data: invoices, isLoading, error } = useInvoices(filters);

  // Fetch completed jobs for invoice creation (jobs without invoices)
  const { data: completedJobs } = useJobs({ status: 'completed' });
  const createInvoiceMutation = useCreateInvoice();

  // Filter completed jobs to only show those without invoices
  const invoiceableJobs = completedJobs?.filter((job: Job) => !job.invoice_id);

  // Filter invoiceable jobs by search
  const filteredInvoiceableJobs = invoiceableJobs?.filter((job: Job) => {
    if (!jobSearchQuery) return true;
    const query = jobSearchQuery.toLowerCase();
    return (
      job.job_number?.toLowerCase().includes(query) ||
      job.client?.name?.toLowerCase().includes(query)
    );
  });

  // Handle creating invoice from job
  const handleCreateFromJob = async (job: Job) => {
    try {
      const invoice = await createInvoiceMutation.mutateAsync({
        job_id: job.id,
        client_id: job.client_id,
        billing_address: job.job_address || {},
        subtotal: job.quoted_total || 0,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total: job.quoted_total || 0,
        invoice_date: new Date().toISOString().split('T')[0],
        payment_terms: 'Net 30',
      });
      setShowJobSelector(false);
      setJobSearchQuery('');
      // Navigate to the new invoice
      if (onNavigateToEntity) {
        onNavigateToEntity('invoice', { id: invoice.id });
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  // Filter invoices by search query
  const filteredInvoices = invoices?.filter(invoice => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number?.toLowerCase().includes(query) ||
      invoice.client?.name?.toLowerCase().includes(query) ||
      invoice.po_number?.toLowerCase().includes(query)
    );
  });

  // Handle invoice selection - update URL
  const handleInvoiceSelect = (invoiceId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('invoice', { id: invoiceId });
    }
  };

  // Handle closing invoice detail - clear URL
  const handleInvoiceClose = () => {
    if (onClearEntity) {
      onClearEntity();
    }
  };

  // Handle navigation to related entities
  const handleNavigateToJob = (jobId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('job', { id: jobId });
    }
  };

  const handleNavigateToQuote = (quoteId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('quote', { id: quoteId });
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

  const isPastDue = (invoice: typeof invoices extends (infer T)[] | undefined ? T : never) => {
    return invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.balance_due > 0;
  };

  // Job selector modal
  const renderJobSelectorModal = () => {
    if (!showJobSelector) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Create Invoice from Job</h2>
            <button
              onClick={() => {
                setShowJobSelector(false);
                setJobSearchQuery('');
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={jobSearchQuery}
                onChange={(e) => setJobSearchQuery(e.target.value)}
                placeholder="Search completed jobs..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
          </div>

          {/* Jobs list */}
          <div className="p-4 overflow-y-auto max-h-[50vh]">
            {!filteredInvoiceableJobs?.length ? (
              <div className="text-center py-8 text-gray-500">
                <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No completed jobs ready for invoicing</p>
                <p className="text-sm mt-1">Complete a job first to create an invoice</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInvoiceableJobs.map((job: Job) => (
                  <button
                    key={job.id}
                    onClick={() => handleCreateFromJob(job)}
                    disabled={createInvoiceMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 border rounded-lg hover:border-green-300 hover:bg-green-50 text-left transition-colors disabled:opacity-50"
                  >
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Wrench className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{job.job_number}</p>
                      <p className="text-sm text-gray-500">
                        {job.client?.name} • ${job.quoted_total?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Completed
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // If viewing a specific invoice, render the detail page
  if (entityContext?.type === 'invoice') {
    return (
      <InvoiceDetailPage
        invoiceId={entityContext.id}
        onBack={handleInvoiceClose}
        onNavigateToJob={handleNavigateToJob}
        onNavigateToQuote={handleNavigateToQuote}
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
              <div className="p-2 bg-green-100 rounded-lg">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                <p className="text-sm text-gray-500">Manage invoices and payments</p>
              </div>
            </div>
            <button
              onClick={() => setShowJobSelector(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              New Invoice
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
              placeholder="Search invoices..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all' | 'past_due')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Statuses</option>
              <option value="past_due">Past Due</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
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
            Error loading invoices: {error.message}
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading invoices...</div>
        ) : !filteredInvoices?.length ? (
          <div className="p-8 text-center border-2 border-dashed rounded-lg bg-white">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No invoices found</p>
            <button
              onClick={() => setShowJobSelector(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Create First Invoice
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => handleInvoiceSelect(invoice.id)}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Receipt className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {invoice.invoice_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </span>
                          {isPastDue(invoice) && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Past Due
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {invoice.client && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {invoice.client.name}
                            </span>
                          )}
                          {invoice.job && (
                            <span>Job: {invoice.job.job_number}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {formatDate(invoice.invoice_date)}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(invoice.total)}
                      </div>
                      {invoice.balance_due > 0 && (
                        <div className="text-xs text-red-600">
                          Due: {formatCurrency(invoice.balance_due)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job selector modal */}
      {renderJobSelectorModal()}
    </div>
  );
}
