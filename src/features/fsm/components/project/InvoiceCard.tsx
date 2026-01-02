/**
 * InvoiceCard - Unified Create/View component for Invoices
 *
 * CRITICAL UX REQUIREMENT: This component must look IDENTICAL when creating vs viewing.
 * Line items and Payments are ALWAYS visible (not on a separate page).
 *
 * Props:
 * - isEditing: true = editable fields, false = read-only
 * - invoice: existing invoice data (null for new invoice)
 * - onSave: callback when invoice is saved
 */

import { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Calendar,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { Invoice, InvoiceStatus, PaymentMethod } from '../../types';
import { TotalsDisplay } from '../shared/TotalsDisplay';

// Line item form data
interface LineItemFormData {
  id?: string;
  tempId?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

// Payment form data
interface PaymentFormData {
  id?: string;
  tempId?: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

// Invoice form data
interface InvoiceFormData {
  invoice_date: string;
  due_date: string;
  terms?: string;
  notes?: string;
  internal_notes?: string;
  line_items: LineItemFormData[];
  payments: PaymentFormData[];
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'card', label: 'Credit Card' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'ach', label: 'ACH Transfer' },
  { value: 'qbo_payment', label: 'QBO Payment' },
];

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  bad_debt: 'bg-red-100 text-red-700',
};

interface InvoiceCardProps {
  /** When true, fields are editable */
  isEditing: boolean;
  /** Existing invoice data (null for new invoice) */
  invoice?: Invoice | null;
  /** Project ID for new invoices */
  projectId?: string;
  /** Job ID for new invoices created from a job */
  jobId?: string;
  /** Callback when save is clicked */
  onSave?: (data: InvoiceFormData) => Promise<void>;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Toggle edit mode */
  onToggleEdit?: () => void;
  /** Callback to record a new payment */
  onRecordPayment?: () => void;
  /** Callback to send invoice */
  onSendInvoice?: () => void;
  /** Show compact view */
  compact?: boolean;
}

export function InvoiceCard({
  isEditing,
  invoice,
  projectId: _projectId,
  jobId: _jobId,
  onSave,
  onCancel,
  onToggleEdit,
  onRecordPayment,
  onSendInvoice,
  compact = false,
}: InvoiceCardProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    terms: 'Net 30',
    notes: '',
    internal_notes: '',
    line_items: [],
    payments: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState<PaymentFormData>({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'check',
  });

  // Initialize form data from invoice
  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date || '',
        terms: invoice.terms || 'Net 30',
        notes: invoice.notes || '',
        internal_notes: invoice.internal_notes || '',
        line_items: (invoice.line_items || []).map((item, idx) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total || 0,
          sort_order: item.sort_order || idx,
        })),
        payments: (invoice.payments || []).map((p) => ({
          id: p.id,
          amount: p.amount,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference_number: p.reference_number || '',
          notes: p.notes || '',
        })),
      });
    }
  }, [invoice]);

  // Calculate totals
  const subtotal = formData.line_items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = invoice?.tax_amount || 0;
  const discountAmount = invoice?.discount_amount || 0;
  const total = subtotal + taxAmount - discountAmount;
  const amountPaid = formData.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = total - amountPaid;

  // Status helpers
  const isPaid = invoice?.status === 'paid' || balanceDue <= 0;
  const isPastDue = invoice?.status === 'past_due';
  const isDraft = invoice?.status === 'draft' || !invoice;

  // Calculate days past due
  const getDaysPastDue = () => {
    if (!formData.due_date || isPaid) return 0;
    const due = new Date(formData.due_date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };
  const daysPastDue = getDaysPastDue();

  // Add new line item
  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        {
          tempId: `new-${Date.now()}`,
          description: '',
          quantity: 1,
          unit_price: 0,
          total: 0,
          sort_order: formData.line_items.length,
        },
      ],
    });
  };

  // Update line item
  const updateLineItem = (
    index: number,
    field: keyof LineItemFormData,
    value: string | number
  ) => {
    const updated = [...formData.line_items];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate total
    if (field === 'quantity' || field === 'unit_price') {
      updated[index] = {
        ...updated[index],
        total: updated[index].quantity * updated[index].unit_price,
      };
    }

    setFormData({ ...formData, line_items: updated });
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    const updated = formData.line_items.filter((_, i) => i !== index);
    setFormData({ ...formData, line_items: updated });
  };

  // Move line item up/down
  const moveLineItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.line_items.length) return;

    const updated = [...formData.line_items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((item, i) => {
      item.sort_order = i;
    });
    setFormData({ ...formData, line_items: updated });
  };

  // Add payment (inline)
  const addPayment = () => {
    if (newPayment.amount <= 0) return;
    setFormData({
      ...formData,
      payments: [
        ...formData.payments,
        {
          ...newPayment,
          tempId: `new-${Date.now()}`,
        },
      ],
    });
    setNewPayment({
      amount: Math.max(0, balanceDue - newPayment.amount),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'check',
    });
    setShowPaymentForm(false);
  };

  // Remove payment
  const removePayment = (index: number) => {
    const updated = formData.payments.filter((_, i) => i !== index);
    setFormData({ ...formData, payments: updated });
  };

  // Handle save
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Compact collapsed view
  if (compact && !isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className={`bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 transition-colors ${
          isPastDue ? 'border-red-300' : isPaid ? 'border-green-300' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
            <div>
              <p className="font-medium text-gray-900">
                {invoice?.invoice_number || 'New Invoice'}
              </p>
              <p className="text-sm text-gray-500">
                {formData.line_items.length} items •{' '}
                {formData.payments.length} payment(s)
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(total)}</p>
            {!isPaid && balanceDue > 0 && (
              <p className="text-sm text-red-600">Due: {formatCurrency(balanceDue)}</p>
            )}
            {isPaid && (
              <p className="text-sm text-green-600 flex items-center justify-end gap-1">
                <CheckCircle className="w-3 h-3" />
                Paid
              </p>
            )}
            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto mt-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${
        isPastDue ? 'border-red-300 ring-1 ring-red-100' : ''
      } ${isPaid ? 'border-green-300' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
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
          <div>
            <h3 className="font-semibold text-gray-900">
              {invoice?.invoice_number || 'New Invoice'}
            </h3>
            <div className="flex items-center gap-2">
              {invoice?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    INVOICE_STATUS_COLORS[invoice.status]
                  }`}
                >
                  {invoice.status.replace(/_/g, ' ')}
                </span>
              )}
              {isPastDue && daysPastDue > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                  {daysPastDue} days overdue
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {isDraft && onSendInvoice && (
                <button
                  onClick={onSendInvoice}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  Send Invoice
                </button>
              )}
              {onToggleEdit && (
                <button
                  onClick={onToggleEdit}
                  className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  Edit
                </button>
              )}
              {compact && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 hover:bg-gray-200 rounded"
                >
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Invoice Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) =>
                  setFormData({ ...formData, invoice_date: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                {formatDate(formData.invoice_date)}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p
                className={`flex items-center gap-1 ${
                  isPastDue ? 'text-red-600 font-medium' : 'text-gray-900'
                }`}
              >
                <Clock className="w-4 h-4 text-gray-400" />
                {formatDate(formData.due_date)}
              </p>
            )}
          </div>

          {/* Terms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms
            </label>
            {isEditing ? (
              <select
                value={formData.terms || ''}
                onChange={(e) =>
                  setFormData({ ...formData, terms: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
              </select>
            ) : (
              <p className="text-gray-900">{formData.terms || '-'}</p>
            )}
          </div>

          {/* Balance Due */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Balance Due
            </label>
            <p
              className={`text-lg font-bold ${
                balanceDue > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(balanceDue)}
            </p>
          </div>
        </div>
      </div>

      {/* Line Items - ALWAYS VISIBLE */}
      <div className="border-t">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              Line Items ({formData.line_items.length})
            </h4>
            {isEditing && (
              <button
                onClick={addLineItem}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                {isEditing && <th className="pb-2 w-8"></th>}
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right w-20">Qty</th>
                <th className="pb-2 font-medium text-right w-28">Unit Price</th>
                <th className="pb-2 font-medium text-right w-28">Total</th>
                {isEditing && <th className="pb-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr key={item.id || item.tempId} className="border-b last:border-0">
                  {/* Reorder buttons */}
                  {isEditing && (
                    <td className="py-2 pr-2">
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveLineItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveLineItem(idx, 'down')}
                          disabled={idx === formData.line_items.length - 1}
                          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  )}

                  {/* Description */}
                  <td className="py-2 pr-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(idx, 'description', e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="Description"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{item.description}</p>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(idx, 'quantity', Number(e.target.value))
                        }
                        className="w-16 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="1"
                      />
                    ) : (
                      <span className="text-gray-600">{item.quantity}</span>
                    )}
                  </td>

                  {/* Unit Price */}
                  <td className="py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(idx, 'unit_price', Number(e.target.value))
                        }
                        className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(item.total)}
                  </td>

                  {/* Delete button */}
                  {isEditing && (
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Empty state */}
              {formData.line_items.length === 0 && (
                <tr>
                  <td
                    colSpan={isEditing ? 6 : 4}
                    className="py-8 text-center text-gray-500"
                  >
                    {isEditing ? (
                      <button
                        onClick={addLineItem}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        + Add your first line item
                      </button>
                    ) : (
                      'No line items'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-4 bg-gray-50 border-t">
          <TotalsDisplay
            subtotal={subtotal}
            tax={taxAmount}
            discount={discountAmount}
            total={total}
            amountPaid={amountPaid}
            balanceDue={balanceDue}
            horizontal
          />
        </div>
      </div>

      {/* Payments - ALWAYS VISIBLE */}
      <div className="border-t">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              Payments ({formData.payments.length})
            </h4>
            {!isPaid && balanceDue > 0 && (
              <button
                onClick={
                  isEditing
                    ? () => setShowPaymentForm(!showPaymentForm)
                    : onRecordPayment
                }
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Record Payment
              </button>
            )}
          </div>

          {/* Payment Form (inline when editing) */}
          {isEditing && showPaymentForm && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h5 className="font-medium text-green-800 mb-3">New Payment</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={newPayment.amount || ''}
                      onChange={(e) =>
                        setNewPayment({ ...newPayment, amount: Number(e.target.value) })
                      }
                      className="w-full pl-6 pr-2 py-1.5 border rounded focus:ring-2 focus:ring-green-500 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={newPayment.payment_date}
                    onChange={(e) =>
                      setNewPayment({ ...newPayment, payment_date: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border rounded focus:ring-2 focus:ring-green-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Method</label>
                  <select
                    value={newPayment.payment_method}
                    onChange={(e) =>
                      setNewPayment({
                        ...newPayment,
                        payment_method: e.target.value as PaymentMethod,
                      })
                    }
                    className="w-full px-2 py-1.5 border rounded focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Reference #</label>
                  <input
                    type="text"
                    value={newPayment.reference_number || ''}
                    onChange={(e) =>
                      setNewPayment({ ...newPayment, reference_number: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border rounded focus:ring-2 focus:ring-green-500 text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={addPayment}
                  disabled={newPayment.amount <= 0}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Add Payment
                </button>
              </div>
            </div>
          )}

          {/* Payments List */}
          <div className="space-y-2">
            {formData.payments.map((payment, idx) => (
              <div
                key={payment.id || payment.tempId}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border"
              >
                <CreditCard className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {PAYMENT_METHOD_OPTIONS.find((o) => o.value === payment.payment_method)
                      ?.label || payment.payment_method}{' '}
                    • {formatDate(payment.payment_date)}
                    {payment.reference_number && ` • Ref: ${payment.reference_number}`}
                  </p>
                </div>
                {isEditing && (
                  <button
                    onClick={() => removePayment(idx)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Empty state */}
            {formData.payments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {!isPaid && balanceDue > 0 ? (
                  isEditing ? (
                    <button
                      onClick={() => setShowPaymentForm(true)}
                      className="text-green-600 hover:text-green-700"
                    >
                      + Record first payment
                    </button>
                  ) : (
                    <span>No payments recorded</span>
                  )
                ) : (
                  <span className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    Fully Paid
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="p-4 border-t space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (visible on invoice)
          </label>
          {isEditing ? (
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes for the invoice..."
            />
          ) : (
            <p className="text-gray-600">{formData.notes || '-'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Internal Notes (not visible to client)
          </label>
          {isEditing ? (
            <textarea
              value={formData.internal_notes}
              onChange={(e) =>
                setFormData({ ...formData, internal_notes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-50"
              placeholder="Add internal notes..."
            />
          ) : (
            formData.internal_notes && (
              <p className="text-gray-600 bg-yellow-50 p-2 rounded">
                {formData.internal_notes}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default InvoiceCard;
