/**
 * QuoteDetailPage - Full page view of a quote
 *
 * Accessible via URL: /quotes/:id
 *
 * Tabs:
 * - Overview: Quote summary, pricing, client info
 * - Line Items: Materials, labor, adjustments
 * - Activity: Status history, approval workflow
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Edit2,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Building2,
  MapPin,
  AlertCircle,
  Briefcase,
  History,
  Package,
  Clock,
} from 'lucide-react';
import { useQuote, useUpdateQuoteStatus, useSendQuote, useConvertQuoteToJob } from '../hooks/useQuotes';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_TRANSITIONS,
  type QuoteStatus,
} from '../types';

type Tab = 'overview' | 'line-items' | 'activity';

interface QuoteDetailPageProps {
  quoteId: string;
  onBack: () => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToRequest?: (requestId: string) => void;
  onEditQuote?: (quoteId: string) => void;
}

export default function QuoteDetailPage({
  quoteId,
  onBack,
  onNavigateToJob,
  onNavigateToRequest,
  onEditQuote,
}: QuoteDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState('');

  const { data: quote, isLoading, error } = useQuote(quoteId);
  const updateStatusMutation = useUpdateQuoteStatus();
  const sendQuoteMutation = useSendQuote();
  const convertToJobMutation = useConvertQuoteToJob();

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
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    await updateStatusMutation.mutateAsync({ id: quote.id, status: newStatus });
  };

  const handleSendQuote = async () => {
    if (!quote) return;
    await sendQuoteMutation.mutateAsync({
      id: quote.id,
      method: 'email',
      email: sendEmail || undefined,
    });
    setShowSendModal(false);
    setSendEmail('');
  };

  const handleConvertToJob = async () => {
    if (!quote) return;
    if (!confirm('Convert this quote to a job? This will create a new job and mark the quote as converted.')) {
      return;
    }
    const job = await convertToJobMutation.mutateAsync(quote.id);
    if (onNavigateToJob) {
      onNavigateToJob(job.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading quote...</div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">Quote not found</p>
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

  const allowedTransitions = QUOTE_TRANSITIONS[quote.status] || [];
  const canSend = quote.status === 'draft' || quote.status === 'changes_requested';
  const canConvertToJob = quote.status === 'approved';
  const lineItems = quote.line_items || [];

  // Calculate totals from line items
  const subtotal = lineItems.reduce((sum, item) => sum + (item.total_price || 0), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
    { id: 'line-items', label: 'Line Items', icon: <Package className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          {/* Back button and title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {quote.quote_number}
                  </h1>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>
                    {QUOTE_STATUS_LABELS[quote.status]}
                  </span>
                  {quote.requires_approval && quote.approval_status === 'pending' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Needs Approval
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {quote.client?.name || 'No client'}
                  {quote.product_type && ` • ${quote.product_type}`}
                  {quote.linear_feet && ` • ${quote.linear_feet} LF`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onEditQuote && (
                <button
                  onClick={() => onEditQuote(quote.id)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canSend && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                  Send Quote
                </button>
              )}
              {canConvertToJob && (
                <button
                  onClick={handleConvertToJob}
                  disabled={convertToJobMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Briefcase className="w-4 h-4" />
                  {convertToJobMutation.isPending ? 'Creating...' : 'Create Job'}
                </button>
              )}
              {quote.converted_to_job_id && onNavigateToJob && (
                <button
                  onClick={() => onNavigateToJob(quote.converted_to_job_id!)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Briefcase className="w-4 h-4" />
                  View Job
                </button>
              )}
            </div>
          </div>
        </div>

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
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Pricing Summary */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Pricing Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(quote.subtotal || subtotal)}</span>
                  </div>
                  {quote.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount {quote.discount_percent > 0 && `(${quote.discount_percent}%)`}</span>
                      <span>-{formatCurrency(quote.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax ({((quote.tax_rate || 0) * 100).toFixed(2)}%)</span>
                    <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-blue-600">{formatCurrency(quote.total)}</span>
                  </div>
                  {quote.deposit_required > 0 && (
                    <div className="flex justify-between text-sm text-gray-500 pt-2">
                      <span>Deposit Required</span>
                      <span>{formatCurrency(quote.deposit_required)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scope Summary */}
              {quote.scope_summary && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Scope of Work</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{quote.scope_summary}</p>
                </div>
              )}

              {/* Job Address */}
              {quote.job_address && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Job Site Address</h3>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{quote.job_address.line1}</p>
                      {quote.job_address.line2 && (
                        <p className="text-gray-600">{quote.job_address.line2}</p>
                      )}
                      <p className="text-gray-600">
                        {[quote.job_address.city, quote.job_address.state, quote.job_address.zip].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Address */}
              {quote.billing_address && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Billing Address</h3>
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="font-medium">{quote.billing_address.line1}</p>
                      {quote.billing_address.line2 && (
                        <p className="text-gray-600">{quote.billing_address.line2}</p>
                      )}
                      <p className="text-gray-600">
                        {[quote.billing_address.city, quote.billing_address.state, quote.billing_address.zip].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
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
                    <span className="text-sm font-medium">{formatDate(quote.created_at)}</span>
                  </div>
                  {quote.valid_until && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Valid Until</span>
                      <span className="text-sm font-medium">{formatDate(quote.valid_until)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Payment Terms</span>
                    <span className="text-sm font-medium">{quote.payment_terms || 'Net 30'}</span>
                  </div>
                  {quote.client && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Client</span>
                      <span className="text-sm font-medium text-blue-600">{quote.client.name}</span>
                    </div>
                  )}
                  {quote.community && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Community</span>
                      <span className="text-sm font-medium">{quote.community.name}</span>
                    </div>
                  )}
                  {quote.sales_rep && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Sales Rep</span>
                      <span className="text-sm font-medium">{quote.sales_rep.name}</span>
                    </div>
                  )}
                  {quote.request && onNavigateToRequest && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Request</span>
                      <button
                        onClick={() => onNavigateToRequest(quote.request!.id)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {quote.request.request_number}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Communication */}
              {quote.sent_at && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Communication</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Send className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Sent:</span>
                      <span className="font-medium">{formatDateTime(quote.sent_at)}</span>
                    </div>
                    {quote.sent_to_email && (
                      <div className="text-sm text-gray-500 ml-6">
                        To: {quote.sent_to_email}
                      </div>
                    )}
                    {quote.viewed_at && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Viewed: {formatDateTime(quote.viewed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              {allowedTransitions.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Change Status</h3>
                  <div className="space-y-2">
                    {allowedTransitions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={updateStatusMutation.isPending}
                        className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors ${QUOTE_STATUS_COLORS[status]} hover:opacity-80 disabled:opacity-50`}
                      >
                        {QUOTE_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'line-items' && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
              <p className="text-sm text-gray-500 mt-1">
                {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
              </p>
            </div>
            {lineItems.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No line items yet</p>
                <p className="text-sm mt-1">Line items will be added when building the quote</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          {item.group_name && (
                            <div className="text-sm text-gray-500">{item.group_name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.line_type === 'material' ? 'bg-blue-100 text-blue-700' :
                            item.line_type === 'labor' ? 'bg-green-100 text-green-700' :
                            item.line_type === 'discount' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.line_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {item.quantity} {item.unit_type}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {formatCurrency(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-6 py-3 text-right font-medium text-gray-900">
                        Subtotal
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="max-w-2xl space-y-6">
            {/* Approval Info */}
            {quote.requires_approval && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Approval Status</h3>
                <div className="flex items-center gap-3">
                  {quote.approval_status === 'approved' ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-600">Approved</p>
                        {quote.approved_at && (
                          <p className="text-sm text-gray-500">{formatDateTime(quote.approved_at)}</p>
                        )}
                      </div>
                    </>
                  ) : quote.approval_status === 'rejected' ? (
                    <>
                      <XCircle className="w-6 h-6 text-red-600" />
                      <div>
                        <p className="font-medium text-red-600">Rejected</p>
                        {quote.approval_notes && (
                          <p className="text-sm text-gray-500 mt-1">{quote.approval_notes}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="w-6 h-6 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-600">Pending Approval</p>
                        {quote.approval_reason && (
                          <p className="text-sm text-gray-500 mt-1">Reason: {quote.approval_reason}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Status History */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Status History</h3>
              <div className="space-y-4">
                {/* Current status */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(quote.status_changed_at)}
                    </p>
                  </div>
                </div>
                {/* Creation */}
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Quote Created</p>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(quote.created_at)}
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

      {/* Send Quote Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Quote</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-sm text-gray-500">
                The quote will be sent as a PDF attachment.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSendQuote}
                disabled={sendQuoteMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendQuoteMutation.isPending ? 'Sending...' : 'Send Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
