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
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useQuote, useUpdateQuoteStatus, useSendQuote, useConvertQuoteToJob, useUpdateQuote } from '../hooks/useQuotes';
import QuoteToJobsModal from '../components/QuoteToJobsModal';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
} from '../types';
import CustomFieldsSection from '../../client_hub/components/CustomFieldsSection';
import { QuoteProgress } from '../components/shared/WorkflowProgress';
import { TotalsDisplay } from '../components/shared/TotalsDisplay';

// Lost reason options
const LOST_REASONS = [
  'Price too high',
  'Went with competitor',
  'Project cancelled',
  'Budget constraints',
  'Timeline issues',
  'Changed requirements',
  'No response',
  'Other',
] as const;

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
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'both'>('email');
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  // Approve quote modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [approvePo, setApprovePo] = useState('');
  // Lost quote modal state
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostCompetitor, setLostCompetitor] = useState('');
  const [lostNotes, setLostNotes] = useState('');
  // Multi-job conversion modal state
  const [showMultiJobModal, setShowMultiJobModal] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);

  const { data: quote, isLoading, error } = useQuote(quoteId);
  const updateStatusMutation = useUpdateQuoteStatus();
  const updateQuoteMutation = useUpdateQuote();
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

  const handleSendQuote = async () => {
    if (!quote) return;

    setIsSending(true);
    try {
      // Call the Netlify function to actually send the quote
      const response = await fetch('/.netlify/functions/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          method: sendMethod,
          email: sendEmail || undefined,
          phone: sendPhone || undefined,
          message: sendMessage || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send quote');
      }

      // Show success message
      if (result.emailSent && result.smsSent) {
        alert('Quote sent via email and SMS!');
      } else if (result.emailSent) {
        alert('Quote sent via email!');
      } else if (result.smsSent) {
        alert('Quote sent via SMS!');
      }

      setShowSendModal(false);
      setSendEmail('');
      setSendPhone('');
      setSendMessage('');
      setSendMethod('email');

      // Refresh the quote data - map send method to DB method type
      const dbMethod: 'email' | 'client_hub' | 'print' =
        sendMethod === 'sms' ? 'email' : 'email'; // All methods map to 'email' for DB tracking
      sendQuoteMutation.mutate({
        id: quote.id,
        method: dbMethod,
        email: sendEmail || undefined,
      });
    } catch (err) {
      console.error('Send quote error:', err);
      alert(err instanceof Error ? err.message : 'Failed to send quote');
    } finally {
      setIsSending(false);
    }
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

  const handleApproveQuote = async () => {
    if (!quote) return;
    try {
      // Update status to approved and store PO number/notes
      await updateStatusMutation.mutateAsync({
        id: quote.id,
        status: 'approved',
        notes: approvePo ? `PO: ${approvePo}. ${approveNotes}` : approveNotes || undefined,
      });
      // Also store the PO number separately
      if (approvePo) {
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          data: { client_po_number: approvePo },
        });
      }
      setShowApproveModal(false);
      setApproveNotes('');
      setApprovePo('');
    } catch (err) {
      console.error('Approve quote error:', err);
    }
  };

  const handleMarkLost = async () => {
    if (!quote || !lostReason) return;
    try {
      // Update status to lost and store reason
      await updateStatusMutation.mutateAsync({
        id: quote.id,
        status: 'lost',
        notes: `Reason: ${lostReason}${lostCompetitor ? `. Lost to: ${lostCompetitor}` : ''}${lostNotes ? `. ${lostNotes}` : ''}`,
      });
      // Also store the lost reason details separately
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        data: {
          lost_reason: lostReason,
          lost_to_competitor: lostCompetitor || null,
        },
      });
      setShowLostModal(false);
      setLostReason('');
      setLostCompetitor('');
      setLostNotes('');
    } catch (err) {
      console.error('Mark lost error:', err);
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

  const canSend = quote.status === 'draft' || quote.status === 'changes_requested';
  const canApprove = quote.status === 'sent' || quote.status === 'follow_up';
  const canMarkLost = ['draft', 'sent', 'follow_up', 'changes_requested', 'pending_approval'].includes(quote.status);
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
                  {quote.product_type && ` â€¢ ${quote.product_type}`}
                  {quote.linear_feet && ` â€¢ ${quote.linear_feet} LF`}
                </p>
                {/* Workflow Progress */}
                <div className="mt-3">
                  <QuoteProgress
                    status={quote.status}
                    sentAt={quote.sent_at}
                    approvedAt={quote.approved_at}
                    convertedToJobId={quote.converted_to_job_id}
                    compact
                  />
                </div>
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
              {canApprove && (
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Approved
                </button>
              )}
              {canMarkLost && (
                <button
                  onClick={() => setShowLostModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" />
                  Mark Lost
                </button>
              )}
              {canConvertToJob && (
                <div className="relative">
                  <div className="flex">
                    <button
                      onClick={handleConvertToJob}
                      disabled={convertToJobMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-l-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Briefcase className="w-4 h-4" />
                      {convertToJobMutation.isPending ? 'Creating...' : 'Create Job'}
                    </button>
                    <button
                      onClick={() => setShowJobDropdown(!showJobDropdown)}
                      className="px-2 py-2 bg-green-600 text-white rounded-r-lg hover:bg-green-700 border-l border-green-500"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {showJobDropdown && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                      <button
                        onClick={() => {
                          setShowJobDropdown(false);
                          handleConvertToJob();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
                      >
                        <Briefcase className="w-4 h-4 text-gray-500" />
                        Create Single Job
                      </button>
                      <button
                        onClick={() => {
                          setShowJobDropdown(false);
                          setShowMultiJobModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
                      >
                        <Layers className="w-4 h-4 text-gray-500" />
                        Create Multiple Jobs
                      </button>
                    </div>
                  )}
                </div>
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
                <TotalsDisplay
                  subtotal={quote.subtotal || subtotal}
                  tax={quote.tax_amount || 0}
                  taxRate={(quote.tax_rate || 0) * 100}
                  discount={quote.discount_amount || 0}
                  discountType={quote.discount_percent > 0 ? 'percent' : 'amount'}
                  discountPercent={quote.discount_percent || 0}
                  total={quote.total || 0}
                />
                {quote.deposit_required > 0 && (
                  <div className="flex justify-between text-sm text-gray-500 pt-3 mt-3 border-t">
                    <span>Deposit Required</span>
                    <span className="font-medium">{formatCurrency(quote.deposit_required)}</span>
                  </div>
                )}
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

              {/* Status changes via actions only - removed manual status dropdown per Jobber pattern */}

              {/* Custom Fields */}
              <CustomFieldsSection
                entityType="quote"
                entityId={quoteId}
                collapsible={true}
                defaultCollapsed={true}
              />
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Quote to Client</h3>
            <div className="space-y-4">
              {/* Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send via
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMethod('email')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      sendMethod === 'email'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMethod('sms')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      sendMethod === 'sms'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMethod('both')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      sendMethod === 'both'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Both
                  </button>
                </div>
              </div>

              {/* Email Input - shown for email or both */}
              {(sendMethod === 'email' || sendMethod === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder={quote?.client?.primary_contact_email || 'client@example.com'}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {quote?.client?.primary_contact_email && !sendEmail && (
                    <p className="text-xs text-gray-500 mt-1">
                      Will send to: {quote.client.primary_contact_email}
                    </p>
                  )}
                </div>
              )}

              {/* Phone Input - shown for sms or both */}
              {(sendMethod === 'sms' || sendMethod === 'both') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={sendPhone}
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder={quote?.client?.primary_contact_phone || '(512) 555-1234'}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {quote?.client?.primary_contact_phone && !sendPhone && (
                    <p className="text-xs text-gray-500 mt-1">
                      Will send to: {quote.client.primary_contact_phone}
                    </p>
                  )}
                </div>
              )}

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Add a personal note to the client..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <p className="text-sm text-gray-500">
                {sendMethod === 'email' && 'Client will receive an email with a link to view and approve the quote.'}
                {sendMethod === 'sms' && 'Client will receive a text message with a link to view and approve the quote.'}
                {sendMethod === 'both' && 'Client will receive both an email and text message with a link to view and approve the quote.'}
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setSendEmail('');
                  setSendPhone('');
                  setSendMessage('');
                  setSendMethod('email');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendQuote}
                disabled={isSending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Quote Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Quote Approved</h3>
            <p className="text-gray-600 mb-4">
              Record client approval for Quote #{quote?.quote_number}. This is typically done after receiving verbal or written confirmation.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={approvePo}
                  onChange={(e) => setApprovePo(e.target.value)}
                  placeholder="Client's PO number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="How was approval received? Any special conditions?"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApproveNotes('');
                  setApprovePo('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleApproveQuote}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Mark Approved
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Lost Modal */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Quote Lost</h3>
            <p className="text-gray-600 mb-4">
              Record why this quote was lost. This helps us improve future quotes.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lost Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a reason...</option>
                  {LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              {lostReason === 'Went with competitor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Which Competitor? <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={lostCompetitor}
                    onChange={(e) => setLostCompetitor(e.target.value)}
                    placeholder="Competitor name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLostModal(false);
                  setLostReason('');
                  setLostCompetitor('');
                  setLostNotes('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkLost}
                disabled={updateStatusMutation.isPending || !lostReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Mark Lost
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Job Conversion Modal */}
      {showMultiJobModal && quote && (
        <QuoteToJobsModal
          quote={quote}
          onClose={() => setShowMultiJobModal(false)}
          onSuccess={(result) => {
            setShowMultiJobModal(false);
            // Navigate to the first job or project
            if (result.jobIds.length > 0 && onNavigateToJob) {
              onNavigateToJob(result.jobIds[0]);
            }
          }}
        />
      )}
    </div>
  );
}
