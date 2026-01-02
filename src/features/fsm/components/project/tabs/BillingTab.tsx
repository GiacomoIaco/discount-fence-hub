/**
 * BillingTab - Invoices and Payments management within a Project
 *
 * Features:
 * - List all invoices with status
 * - Show payments inline
 * - Balance due tracking
 * - Payment recording
 */

import { useState } from 'react';
import {
  Receipt,
  Plus,
  ChevronDown,
  ChevronUp,
  Send,
  DollarSign,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import type { Invoice, InvoiceStatus, Payment, PaymentMethod } from '../../../types';
import { TotalsDisplay } from '../../shared/TotalsDisplay';

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  bad_debt: 'bg-red-100 text-red-700',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Credit Card',
  check: 'Check',
  cash: 'Cash',
  ach: 'ACH Transfer',
  qbo_payment: 'QBO Payment',
};

interface BillingTabProps {
  invoices: Invoice[];
  projectId: string;
  onCreateInvoice?: () => void;
  onSendInvoice?: (invoiceId: string) => void;
  onRecordPayment?: (invoiceId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
}

export function BillingTab({
  invoices,
  projectId,
  onCreateInvoice,
  onSendInvoice,
  onRecordPayment,
  onViewInvoice,
}: BillingTabProps) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Sort invoices: past_due first, then sent, then draft, then paid
  const sortedInvoices = [...invoices].sort((a, b) => {
    const order: Record<InvoiceStatus, number> = {
      past_due: 0,
      sent: 1,
      draft: 2,
      paid: 3,
      bad_debt: 4,
    };
    return order[a.status] - order[b.status];
  });

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
  const totalBalanceDue = totalInvoiced - totalPaid;
  const hasUnpaid = invoices.some((i) => !['paid', 'bad_debt'].includes(i.status));
  const hasPastDue = invoices.some((i) => i.status === 'past_due');

  const toggleExpand = (invoiceId: string) => {
    setExpandedInvoiceId(expandedInvoiceId === invoiceId ? null : invoiceId);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Calculate days past due
  const getDaysPastDue = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-900 mb-2">No Invoices Yet</h3>
        <p className="text-gray-500 mb-4">
          Create an invoice after jobs are completed
        </p>
        {onCreateInvoice && (
          <button
            onClick={onCreateInvoice}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
          <div className="text-sm text-gray-500">Invoices</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(totalInvoiced)}
          </div>
          <div className="text-sm text-gray-500">Total Invoiced</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalPaid)}
          </div>
          <div className="text-sm text-gray-500">Total Paid</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div
            className={`text-2xl font-bold ${
              totalBalanceDue > 0 ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {formatCurrency(totalBalanceDue)}
          </div>
          <div className="text-sm text-gray-500">Balance Due</div>
        </div>
      </div>

      {/* Alerts */}
      {hasPastDue && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-700 font-medium">
            There are overdue invoices that need attention
          </p>
        </div>
      )}

      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Invoices ({invoices.length})</h3>
        {onCreateInvoice && (
          <button
            onClick={onCreateInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        )}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {sortedInvoices.map((invoice) => {
          const isExpanded = expandedInvoiceId === invoice.id;
          const payments = (invoice.payments || []) as Payment[];
          const lineItems = (invoice.line_items || []) as Array<{
            id: string;
            description: string;
            quantity: number;
            unit_price: number;
            total: number;
          }>;
          const balanceDue = (invoice.total_amount || 0) - (invoice.amount_paid || 0);
          const isPaid = invoice.status === 'paid';
          const isPastDue = invoice.status === 'past_due';
          const daysPastDue = isPastDue ? getDaysPastDue(invoice.due_date) : 0;

          return (
            <div
              key={invoice.id}
              className={`bg-white rounded-lg border overflow-hidden ${
                isPastDue ? 'border-red-300 ring-1 ring-red-100' : ''
              } ${isPaid ? 'border-green-300' : ''}`}
            >
              {/* Invoice Header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(invoice.id)}
              >
                {/* Status Icon */}
                <div
                  className={`p-2 rounded-lg ${
                    isPaid
                      ? 'bg-green-100'
                      : isPastDue
                      ? 'bg-red-100'
                      : 'bg-gray-100'
                  }`}
                >
                  {isPaid ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : isPastDue ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : (
                    <Receipt className="w-5 h-5 text-gray-600" />
                  )}
                </div>

                {/* Invoice Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {invoice.invoice_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}
                    >
                      {invoice.status.replace(/_/g, ' ')}
                    </span>
                    {isPastDue && daysPastDue > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                        {daysPastDue} days overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(invoice.invoice_date)}
                    </span>
                    {invoice.due_date && (
                      <span
                        className={
                          isPastDue ? 'text-red-600 font-medium' : ''
                        }
                      >
                        Due: {formatDate(invoice.due_date)}
                      </span>
                    )}
                    {invoice.job && (
                      <span>Job: {invoice.job.job_number}</span>
                    )}
                  </div>
                </div>

                {/* Amounts */}
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {formatCurrency(invoice.total_amount || 0)}
                  </p>
                  {!isPaid && balanceDue > 0 && (
                    <p className="text-sm text-red-600 font-medium">
                      Due: {formatCurrency(balanceDue)}
                    </p>
                  )}
                  {isPaid && (
                    <p className="text-sm text-green-600 flex items-center justify-end gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Paid
                    </p>
                  )}
                </div>

                {/* Expand Icon */}
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t">
                  {/* Line Items */}
                  {lineItems.length > 0 && (
                    <div className="p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Line Items</h4>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm text-gray-500 border-b">
                            <th className="pb-2 font-medium">Description</th>
                            <th className="pb-2 font-medium text-right">Qty</th>
                            <th className="pb-2 font-medium text-right">Price</th>
                            <th className="pb-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, idx) => (
                            <tr key={item.id || idx} className="border-b last:border-0">
                              <td className="py-2 text-gray-900">{item.description}</td>
                              <td className="py-2 text-right text-gray-600">
                                {item.quantity}
                              </td>
                              <td className="py-2 text-right text-gray-600">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="py-2 text-right font-medium">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="px-4 pb-4">
                    <TotalsDisplay
                      subtotal={invoice.subtotal || invoice.total_amount || 0}
                      taxAmount={invoice.tax_amount || 0}
                      discountAmount={invoice.discount_amount || 0}
                      total={invoice.total_amount || 0}
                      amountPaid={invoice.amount_paid || 0}
                      showPaymentInfo
                      layout="horizontal"
                    />
                  </div>

                  {/* Payments List */}
                  {payments.length > 0 && (
                    <div className="p-4 bg-gray-50">
                      <h4 className="font-medium text-gray-900 mb-3">
                        Payments ({payments.length})
                      </h4>
                      <div className="space-y-2">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center gap-4 p-3 bg-white rounded-lg border"
                          >
                            <CreditCard className="w-4 h-4 text-green-600" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {formatCurrency(payment.amount)}
                              </p>
                              <p className="text-sm text-gray-500">
                                {PAYMENT_METHOD_LABELS[payment.payment_method] ||
                                  payment.payment_method}{' '}
                                • {formatDate(payment.payment_date)}
                                {payment.reference_number &&
                                  ` • Ref: ${payment.reference_number}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {invoice.status === 'draft' && onSendInvoice && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendInvoice(invoice.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4" />
                        Send Invoice
                      </button>
                    )}
                    {!isPaid && balanceDue > 0 && onRecordPayment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecordPayment(invoice.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <DollarSign className="w-4 h-4" />
                        Record Payment
                      </button>
                    )}
                    {onViewInvoice && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewInvoice(invoice.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        View Full Details
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BillingTab;
