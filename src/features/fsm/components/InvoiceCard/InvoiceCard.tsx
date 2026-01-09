/**
 * InvoiceCard - Unified invoice component for create/edit/view modes
 *
 * Features:
 * - Mode prop: 'create' | 'edit' | 'view'
 * - Line items management
 * - Payments tracking
 * - Send invoice workflow
 * - QBO sync integration
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Invoice, Payment, PaymentMethod } from '../../types';
import type { InvoiceCardProps, InvoiceCardMode, PaymentFormState } from './types';
import { PAYMENT_METHODS, PAYMENT_TERMS_OPTIONS } from './types';
import { useInvoiceForm } from './useInvoiceForm';
import { useSendInvoice, useRecordPayment, useUpdateInvoiceStatus } from '../../hooks/useInvoices';
import InvoiceHeader from './InvoiceHeader';
import InvoiceLineItems from './InvoiceLineItems';
import InvoicePayments from './InvoicePayments';
import InvoiceSidebar from './InvoiceSidebar';

// Record Payment Modal Component
function RecordPaymentModal({
  invoiceId,
  balanceDue,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  balanceDue: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [payment, setPayment] = useState<PaymentFormState>({
    amount: balanceDue,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'check',
    referenceNumber: '',
    notes: '',
  });

  const recordPayment = useRecordPayment();

  const handleSubmit = async () => {
    try {
      await recordPayment.mutateAsync({
        invoiceId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod as PaymentMethod,
        referenceNumber: payment.referenceNumber || undefined,
        paymentDate: payment.paymentDate,
        notes: payment.notes || undefined,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to record payment:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Record Payment</h2>

        <div className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={payment.amount}
                onChange={(e) =>
                  setPayment((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))
                }
                className="w-full pl-7 pr-3 py-2 border rounded-lg"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Balance due: ${balanceDue.toFixed(2)}
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              value={payment.paymentDate}
              onChange={(e) =>
                setPayment((p) => ({ ...p, paymentDate: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={payment.paymentMethod}
              onChange={(e) =>
                setPayment((p) => ({ ...p, paymentMethod: e.target.value }))
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              value={payment.referenceNumber}
              onChange={(e) =>
                setPayment((p) => ({ ...p, referenceNumber: e.target.value }))
              }
              placeholder="Check #, Transaction ID..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={payment.notes}
              onChange={(e) =>
                setPayment((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border rounded-lg resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={recordPayment.isPending || payment.amount <= 0}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {recordPayment.isPending ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceCard({
  mode: initialMode,
  invoiceId,
  projectId,
  jobId,
  quoteId,
  clientId,
  billingAddress,
  onSave,
  onCancel,
  onBack,
  onSend,
  onRecordPayment: onRecordPaymentProp,
}: InvoiceCardProps) {
  const [mode, setMode] = useState<InvoiceCardMode>(initialMode);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Form state
  const {
    form,
    setField,
    setFields,
    addLineItem,
    updateLineItem,
    removeLineItem,
    totals,
    validation,
    isDirty,
    save,
    isSaving,
    invoice,
    isLoading,
  } = useInvoiceForm({
    mode,
    invoiceId,
    projectId,
    jobId,
    quoteId,
    clientId,
    billingAddress,
  });

  // Mutations
  const sendInvoice = useSendInvoice();
  const updateStatus = useUpdateInvoiceStatus();

  // Handlers
  const handleSave = async () => {
    const result = await save();
    if (result) {
      onSave?.(result);
      // Switch to view mode after saving
      if (mode === 'create' || mode === 'edit') {
        setMode('view');
      }
    }
  };

  const handleCancel = () => {
    if (mode === 'edit') {
      // Switch back to view mode without saving
      setMode('view');
    } else {
      onCancel?.();
    }
  };

  const handleEdit = () => {
    setMode('edit');
  };

  const handleSend = async () => {
    if (!invoiceId && !invoice?.id) return;

    const id = invoiceId || invoice!.id;

    // For now, just mark as sent (email integration TBD)
    try {
      await sendInvoice.mutateAsync({
        id,
        method: 'email',
      });
      onSend?.(id);
    } catch (error) {
      console.error('Failed to send invoice:', error);
    }
  };

  const handleRecordPayment = () => {
    if (onRecordPaymentProp) {
      onRecordPaymentProp(invoiceId || invoice?.id || '');
    } else {
      setShowPaymentModal(true);
    }
  };

  const handleVoid = async () => {
    if (!invoiceId && !invoice?.id) return;

    if (!window.confirm('Are you sure you want to void this invoice? This cannot be undone.')) {
      return;
    }

    const id = invoiceId || invoice!.id;

    try {
      await updateStatus.mutateAsync({
        id,
        status: 'bad_debt',
        notes: 'Voided by user',
      });
    } catch (error) {
      console.error('Failed to void invoice:', error);
    }
  };

  const handleMarkBadDebt = async () => {
    if (!invoiceId && !invoice?.id) return;

    if (
      !window.confirm(
        'Are you sure you want to write off this invoice as bad debt? This will close the invoice as uncollectible.'
      )
    ) {
      return;
    }

    const id = invoiceId || invoice!.id;

    try {
      await updateStatus.mutateAsync({
        id,
        status: 'bad_debt',
        notes: 'Written off as bad debt',
      });
    } catch (error) {
      console.error('Failed to mark as bad debt:', error);
    }
  };

  // Loading state
  if (isLoading && mode !== 'create') {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <InvoiceHeader
        mode={mode}
        invoice={invoice}
        validation={validation}
        isSaving={isSaving}
        isDirty={isDirty}
        onBack={onBack}
        onCancel={handleCancel}
        onSave={handleSave}
        onEdit={handleEdit}
        onSend={handleSend}
        onRecordPayment={handleRecordPayment}
        onVoid={handleVoid}
        onMarkBadDebt={handleMarkBadDebt}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Line Items + Payments */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Client Info (view mode) */}
            {mode === 'view' && invoice?.client && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Bill To</h3>
                <p className="font-semibold text-gray-900">{invoice.client.name}</p>
                {invoice.billing_address && (
                  <div className="text-sm text-gray-600 mt-1">
                    {invoice.billing_address.line1 && <p>{invoice.billing_address.line1}</p>}
                    {invoice.billing_address.line2 && <p>{invoice.billing_address.line2}</p>}
                    <p>
                      {invoice.billing_address.city}, {invoice.billing_address.state}{' '}
                      {invoice.billing_address.zip}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Line Items */}
            <InvoiceLineItems
              mode={mode}
              lineItems={form.lineItems}
              totals={totals}
              taxRate={form.taxRate}
              discountAmount={form.discountAmount}
              onAddItem={addLineItem}
              onUpdateItem={updateLineItem}
              onRemoveItem={removeLineItem}
              onTaxRateChange={(rate) => setField('taxRate', rate)}
              onDiscountChange={(amount) => setField('discountAmount', amount)}
            />

            {/* Payments (view mode only) */}
            {mode === 'view' && invoice && (
              <InvoicePayments
                mode={mode}
                invoiceId={invoice.id}
                payments={invoice.payments || []}
                amountPaid={totals.amountPaid}
                balanceDue={totals.balanceDue}
                onRecordPayment={handleRecordPayment}
              />
            )}
          </div>
        </main>

        {/* Right: Sidebar */}
        <InvoiceSidebar
          mode={mode}
          form={form}
          invoice={invoice}
          validation={validation}
          totals={totals}
          onFieldChange={setField}
        />
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && invoice && (
        <RecordPaymentModal
          invoiceId={invoice.id}
          balanceDue={totals.balanceDue}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            // Form will refetch via React Query
          }}
        />
      )}
    </div>
  );
}
