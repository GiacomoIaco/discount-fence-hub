/**
 * InvoicePayments - Payment history section for InvoiceCard
 *
 * Shows:
 * - List of recorded payments
 * - Record Payment button
 * - Payment summary
 */

import {
  DollarSign,
  CreditCard,
  Banknote,
  Building2,
  Loader2,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import type { InvoicePaymentsProps, PaymentFormState } from './types';
import type { Payment } from '../../types';

// Payment method icons
const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  check: <DollarSign className="w-4 h-4" />,
  credit_card: <CreditCard className="w-4 h-4" />,
  ach: <Building2 className="w-4 h-4" />,
  cash: <Banknote className="w-4 h-4" />,
  other: <DollarSign className="w-4 h-4" />,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  check: 'Check',
  credit_card: 'Credit Card',
  ach: 'ACH / Bank Transfer',
  cash: 'Cash',
  other: 'Other',
};

export default function InvoicePayments({
  mode,
  invoiceId,
  payments,
  amountPaid,
  balanceDue,
  isLoading,
  onRecordPayment,
  onDeletePayment,
}: InvoicePaymentsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Sort payments by date (newest first)
  const sortedPayments = [...(payments || [])].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );

  const isPaid = balanceDue <= 0;

  return (
    <div className="bg-white rounded-xl border">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
          {isPaid && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" />
              Paid in Full
            </span>
          )}
        </div>

        {/* Record Payment Button (only if balance due > 0) */}
        {mode === 'view' && balanceDue > 0 && (
          <button
            onClick={onRecordPayment}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        )}
      </div>

      {/* Summary Bar */}
      <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Amount Paid</span>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(amountPaid)}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Balance Due</span>
            <p
              className={`text-lg font-semibold ${
                balanceDue > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(balanceDue)}
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="px-6 py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sortedPayments.length === 0 && (
        <div className="px-6 py-8 text-center">
          <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No payments recorded yet</p>
        </div>
      )}

      {/* Payments List */}
      {!isLoading && sortedPayments.length > 0 && (
        <div className="divide-y">
          {sortedPayments.map((payment) => (
            <div
              key={payment.id}
              className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                {/* Payment Method Icon */}
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  {PAYMENT_METHOD_ICONS[payment.payment_method] || (
                    <DollarSign className="w-5 h-5" />
                  )}
                </div>

                {/* Payment Details */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amount)}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-gray-500">
                      {formatDate(payment.payment_date)}
                    </span>
                    {payment.reference_number && (
                      <span className="text-xs text-gray-400">
                        Ref: {payment.reference_number}
                      </span>
                    )}
                  </div>
                  {payment.notes && (
                    <p className="text-xs text-gray-400 mt-1">{payment.notes}</p>
                  )}
                </div>
              </div>

              {/* Delete Button (only in view mode for non-paid invoices) */}
              {mode === 'view' && onDeletePayment && (
                <button
                  onClick={() => {
                    if (
                      window.confirm('Are you sure you want to delete this payment?')
                    ) {
                      onDeletePayment(payment.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete payment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
