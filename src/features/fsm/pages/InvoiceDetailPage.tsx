/**
 * InvoiceDetailPage - Full page view of an invoice
 *
 * Accessible via URL: /invoices/:id
 *
 * Tabs:
 * - Overview: Invoice summary, amounts, billing info
 * - Payments: Payment history and recording
 * - Activity: Status history, QBO sync status
 */

import { useState } from 'react';
import {
  ArrowLeft,
  Send,
  Receipt,
  Building2,
  MapPin,
  AlertCircle,
  History,
  DollarSign,
  CreditCard,
  Wrench,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useInvoice, useSendInvoice, useRecordPayment, useSyncToQuickBooks } from '../hooks/useInvoices';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '../types';
import { InvoiceProgress } from '../components/shared/WorkflowProgress';
import { TotalsDisplay } from '../components/shared/TotalsDisplay';

type Tab = 'overview' | 'payments' | 'activity';

interface InvoiceDetailPageProps {
  invoiceId: string;
  onBack: () => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToQuote?: (quoteId: string) => void;
  onEditInvoice?: (invoiceId: string) => void;
}

export default function InvoiceDetailPage({
  invoiceId,
  onBack,
  onNavigateToJob,
  onNavigateToQuote,
}: InvoiceDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { data: invoice, isLoading, error } = useInvoice(invoiceId);
  const sendInvoice = useSendInvoice();
  const recordPayment = useRecordPayment();
  const syncToQbo = useSyncToQuickBooks();

  // Send modal state
  const [sendMethod, setSendMethod] = useState<'email' | 'client_hub' | 'print'>('email');
  const [sendEmail, setSendEmail] = useState('');

  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('check');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

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

  const handleSend = async () => {
    if (!invoice) return;
    await sendInvoice.mutateAsync({
      id: invoice.id,
      method: sendMethod,
      email: sendMethod === 'email' ? sendEmail : undefined,
    });
    setShowSendModal(false);
  };

  const handleRecordPayment = async () => {
    if (!invoice || !paymentAmount) return;
    await recordPayment.mutateAsync({
      invoiceId: invoice.id,
      amount: parseFloat(paymentAmount),
      paymentMethod,
      referenceNumber: paymentReference || undefined,
      paymentDate,
      notes: paymentNotes || undefined,
    });
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentNotes('');
  };

  const handleSyncToQbo = async () => {
    if (!invoice) return;
    await syncToQbo.mutateAsync(invoice.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </button>
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error?.message || 'Invoice not found'}
        </div>
      </div>
    );
  }

  const isPastDue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.balance_due > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </button>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Receipt className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {invoice.invoice_number}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </span>
                  {isPastDue && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                      Past Due
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-gray-500">
                  {invoice.client && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {invoice.client.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    {formatCurrency(invoice.total)}
                  </span>
                </div>
                {/* Workflow Progress */}
                <div className="mt-3">
                  <InvoiceProgress
                    status={invoice.status}
                    sentAt={invoice.sent_at}
                    balanceDue={invoice.balance_due}
                    compact
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Send Button */}
              {invoice.status === 'draft' && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                  Send Invoice
                </button>
              )}

              {/* Record Payment Button */}
              {invoice.status !== 'draft' && invoice.balance_due > 0 && (
                <button
                  onClick={() => {
                    setPaymentAmount(invoice.balance_due.toFixed(2));
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Record Payment
                </button>
              )}

              {/* Sync to QBO Button */}
              {invoice.status !== 'draft' && !invoice.qbo_invoice_id && (
                <button
                  onClick={handleSyncToQbo}
                  disabled={syncToQbo.isPending}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncToQbo.isPending ? 'animate-spin' : ''}`} />
                  Sync to QBO
                </button>
              )}

              {/* Status changes via actions only - removed manual status dropdown per Jobber pattern */}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1 border-t">
          {(['overview', 'payments', 'activity'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'payments' && `Payments${invoice.payments?.length ? ` (${invoice.payments.length})` : ''}`}
              {tab === 'activity' && 'Activity'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Amounts Card */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  Invoice Amounts
                </h3>
                <TotalsDisplay
                  subtotal={invoice.subtotal || 0}
                  tax={invoice.tax_amount || 0}
                  taxRate={invoice.tax_rate || 0}
                  discount={invoice.discount_amount || 0}
                  total={invoice.total || 0}
                  amountPaid={invoice.amount_paid || 0}
                  balanceDue={invoice.balance_due || 0}
                />
              </div>

              {/* Line Items */}
              {invoice.line_items && invoice.line_items.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-500 border-b">
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-right">Qty</th>
                          <th className="pb-2 text-right">Price</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.line_items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-3">{item.description}</td>
                            <td className="py-3 text-right">{item.quantity}</td>
                            <td className="py-3 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Billing Address */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Bill To
                </h3>
                <p className="font-medium text-gray-900">{invoice.client?.name}</p>
                <p className="whitespace-pre-line text-gray-600 mt-1">
                  {formatAddress(invoice.billing_address)}
                </p>
              </div>

              {/* Invoice Details */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Invoice Date</span>
                    <span>{formatDate(invoice.invoice_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due Date</span>
                    <span className={isPastDue ? 'text-red-600 font-medium' : ''}>
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Terms</span>
                    <span>{invoice.payment_terms}</span>
                  </div>
                  {invoice.po_number && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">PO Number</span>
                      <span>{invoice.po_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Entities */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Related
                </h3>
                <div className="space-y-2">
                  {invoice.job && (
                    <button
                      onClick={() => onNavigateToJob?.(invoice.job!.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <Wrench className="w-4 h-4 text-orange-600" />
                      <div>
                        <p className="font-medium text-gray-900">{invoice.job.job_number}</p>
                        <p className="text-sm text-gray-500">Job</p>
                      </div>
                    </button>
                  )}
                  {invoice.quote && (
                    <button
                      onClick={() => onNavigateToQuote?.(invoice.quote!.id)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <FileText className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">{invoice.quote.quote_number}</p>
                        <p className="text-sm text-gray-500">Quote</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* QBO Sync Status */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  QuickBooks
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sync Status</span>
                    <span className={`font-medium ${
                      invoice.qbo_sync_status === 'synced'
                        ? 'text-green-600'
                        : invoice.qbo_sync_status === 'error'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      {invoice.qbo_sync_status || 'Not synced'}
                    </span>
                  </div>
                  {invoice.qbo_synced_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Synced At</span>
                      <span>{formatDateTime(invoice.qbo_synced_at)}</span>
                    </div>
                  )}
                  {invoice.qbo_sync_error && (
                    <div className="mt-2 p-2 bg-red-50 text-red-700 text-xs rounded">
                      {invoice.qbo_sync_error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg border">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Payment History</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.payments?.length || 0} payments recorded
                </p>
              </div>
              {invoice.balance_due > 0 && (
                <button
                  onClick={() => {
                    setPaymentAmount(invoice.balance_due.toFixed(2));
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </div>
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="divide-y">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-gray-500">
                          {PAYMENT_METHOD_LABELS[payment.payment_method]} - {formatDate(payment.payment_date)}
                          {payment.reference_number && ` â€¢ Ref: ${payment.reference_number}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p>No payments recorded</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Activity History
            </h3>
            <div className="space-y-4">
              {invoice.sent_at && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                  <div>
                    <p>Invoice sent via <strong>{invoice.sent_method}</strong></p>
                    <p className="text-gray-500">{formatDateTime(invoice.sent_at)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                <div>
                  <p>Status changed to <strong>{INVOICE_STATUS_LABELS[invoice.status]}</strong></p>
                  <p className="text-gray-500">{formatDateTime(invoice.status_changed_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5" />
                <div>
                  <p>Invoice created</p>
                  <p className="text-gray-500">{formatDateTime(invoice.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Send Invoice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Send Method
                </label>
                <select
                  value={sendMethod}
                  onChange={(e) => setSendMethod(e.target.value as typeof sendMethod)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="email">Email</option>
                  <option value="client_hub">Client Portal</option>
                  <option value="print">Print/Download</option>
                </select>
              </div>
              {sendMethod === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="client@example.com"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendInvoice.isPending || (sendMethod === 'email' && !sendEmail)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendInvoice.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference # (Check #, Transaction ID)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={recordPayment.isPending || !paymentAmount}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
