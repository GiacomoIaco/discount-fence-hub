/**
 * InvoiceSidebar - Right sidebar for InvoiceCard
 *
 * Sections:
 * - INVOICE DETAILS: Dates, terms, PO number
 * - BILLING ADDRESS: Client billing info
 * - NOTES: Customer-facing and internal notes
 * - QBO SYNC: QuickBooks sync status
 */

import { useState } from 'react';
import {
  Calendar,
  MapPin,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Check,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { InvoiceSidebarProps } from './types';
import { PAYMENT_TERMS_OPTIONS, INVOICE_STATUS_COLORS } from './types';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function InvoiceSidebar({
  mode,
  form,
  invoice,
  validation: _validation,
  totals: _totals,
  onFieldChange,
}: InvoiceSidebarProps) {
  const isEditable = mode !== 'view';

  // QBO sync status
  const qboStatus = invoice?.qbo_sync_status;
  const qboSyncedAt = invoice?.qbo_synced_at;

  // Payment terms to due date helper
  const calculateDueDate = (invoiceDate: string, terms: string): string => {
    const date = new Date(invoiceDate);
    const daysMap: Record<string, number> = {
      'Due on Receipt': 0,
      'Net 15': 15,
      'Net 30': 30,
      'Net 45': 45,
      'Net 60': 60,
      '50% Deposit': 0,
    };
    const days = daysMap[terms] ?? 30;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  return (
    <aside className="w-80 bg-white border-l flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* INVOICE DETAILS Section */}
        <CollapsibleSection
          title="INVOICE DETAILS"
          icon={<Calendar className="w-4 h-4 text-gray-400" />}
          defaultOpen={true}
        >
          {/* Status (view only) */}
          {mode === 'view' && invoice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  INVOICE_STATUS_COLORS[invoice.status].bg
                } ${INVOICE_STATUS_COLORS[invoice.status].text}`}
              >
                {INVOICE_STATUS_COLORS[invoice.status].label}
              </span>
            </div>
          )}

          {/* Invoice Number (view only) */}
          {mode === 'view' && invoice?.invoice_number && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Invoice #</span>
              <span className="text-sm font-medium">{invoice.invoice_number}</span>
            </div>
          )}

          {/* Invoice Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Invoice Date</span>
            {isEditable ? (
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => {
                  onFieldChange('invoiceDate', e.target.value);
                  // Auto-update due date based on payment terms
                  const newDueDate = calculateDueDate(e.target.value, form.paymentTerms);
                  onFieldChange('dueDate', newDueDate);
                }}
                className="px-2 py-1 text-sm border rounded"
              />
            ) : (
              <span className="text-sm font-medium">
                {form.invoiceDate
                  ? new Date(form.invoiceDate).toLocaleDateString()
                  : '-'}
              </span>
            )}
          </div>

          {/* Payment Terms */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Payment Terms</span>
            {isEditable ? (
              <select
                value={form.paymentTerms}
                onChange={(e) => {
                  onFieldChange('paymentTerms', e.target.value);
                  // Auto-update due date
                  const newDueDate = calculateDueDate(form.invoiceDate, e.target.value);
                  onFieldChange('dueDate', newDueDate);
                }}
                className="px-2 py-1 text-sm border rounded"
              >
                {PAYMENT_TERMS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-medium">{form.paymentTerms}</span>
            )}
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Due Date</span>
            {isEditable ? (
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => onFieldChange('dueDate', e.target.value)}
                className="px-2 py-1 text-sm border rounded"
              />
            ) : (
              <span className={`text-sm font-medium ${
                invoice?.status === 'past_due' ? 'text-red-600' : ''
              }`}>
                {form.dueDate
                  ? new Date(form.dueDate).toLocaleDateString()
                  : '-'}
              </span>
            )}
          </div>

          {/* PO Number */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">PO #</span>
            {isEditable ? (
              <input
                type="text"
                value={form.poNumber}
                onChange={(e) => onFieldChange('poNumber', e.target.value)}
                placeholder="Optional"
                className="px-2 py-1 text-sm border rounded w-32 text-right"
              />
            ) : (
              <span className="text-sm font-medium">
                {form.poNumber || '-'}
              </span>
            )}
          </div>

          {/* Sent Date (view only) */}
          {mode === 'view' && invoice?.sent_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Sent</span>
              <span className="text-sm text-green-600">
                {new Date(invoice.sent_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </CollapsibleSection>

        {/* BILLING ADDRESS Section */}
        <CollapsibleSection
          title="BILLING ADDRESS"
          icon={<MapPin className="w-4 h-4 text-gray-400" />}
          defaultOpen={true}
        >
          {isEditable ? (
            <div className="space-y-2">
              <input
                type="text"
                value={form.billingAddress.line1 || ''}
                onChange={(e) =>
                  onFieldChange('billingAddress', {
                    ...form.billingAddress,
                    line1: e.target.value,
                  })
                }
                placeholder="Street Address"
                className="w-full px-3 py-2 text-sm border rounded"
              />
              {form.billingAddress.line2 !== undefined && (
                <input
                  type="text"
                  value={form.billingAddress.line2 || ''}
                  onChange={(e) =>
                    onFieldChange('billingAddress', {
                      ...form.billingAddress,
                      line2: e.target.value,
                    })
                  }
                  placeholder="Apt, Suite, etc."
                  className="w-full px-3 py-2 text-sm border rounded"
                />
              )}
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="text"
                  value={form.billingAddress.city || ''}
                  onChange={(e) =>
                    onFieldChange('billingAddress', {
                      ...form.billingAddress,
                      city: e.target.value,
                    })
                  }
                  placeholder="City"
                  className="col-span-2 px-3 py-2 text-sm border rounded"
                />
                <input
                  type="text"
                  value={form.billingAddress.state || ''}
                  onChange={(e) =>
                    onFieldChange('billingAddress', {
                      ...form.billingAddress,
                      state: e.target.value,
                    })
                  }
                  placeholder="TX"
                  className="col-span-1 px-3 py-2 text-sm border rounded text-center"
                  maxLength={2}
                />
                <input
                  type="text"
                  value={form.billingAddress.zip || ''}
                  onChange={(e) =>
                    onFieldChange('billingAddress', {
                      ...form.billingAddress,
                      zip: e.target.value,
                    })
                  }
                  placeholder="ZIP"
                  className="col-span-2 px-3 py-2 text-sm border rounded"
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700">
              {form.billingAddress.line1 && <p>{form.billingAddress.line1}</p>}
              {form.billingAddress.line2 && <p>{form.billingAddress.line2}</p>}
              <p>
                {form.billingAddress.city}, {form.billingAddress.state}{' '}
                {form.billingAddress.zip}
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* NOTES Section */}
        <CollapsibleSection
          title="NOTES"
          icon={<MessageSquare className="w-4 h-4 text-gray-400" />}
          defaultOpen={false}
        >
          {/* Customer-facing notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Notes (visible to customer)
            </label>
            {isEditable ? (
              <textarea
                value={form.notes}
                onChange={(e) => onFieldChange('notes', e.target.value)}
                placeholder="Payment instructions, thank you message..."
                className="w-full px-3 py-2 text-sm border rounded resize-none"
                rows={2}
              />
            ) : (
              <p className="text-sm text-gray-700">{form.notes || '-'}</p>
            )}
          </div>

          {/* Internal notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Internal Notes (not visible to customer)
            </label>
            {isEditable ? (
              <textarea
                value={form.internalNotes}
                onChange={(e) => onFieldChange('internalNotes', e.target.value)}
                placeholder="Internal tracking, follow-up reminders..."
                className="w-full px-3 py-2 text-sm border rounded resize-none"
                rows={2}
              />
            ) : (
              <p className="text-sm text-gray-700">{form.internalNotes || '-'}</p>
            )}
          </div>

          {/* Terms and Conditions */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Terms & Conditions
            </label>
            {isEditable ? (
              <textarea
                value={form.terms}
                onChange={(e) => onFieldChange('terms', e.target.value)}
                placeholder="Payment terms, late fees..."
                className="w-full px-3 py-2 text-sm border rounded resize-none"
                rows={2}
              />
            ) : (
              <p className="text-sm text-gray-700">{form.terms || '-'}</p>
            )}
          </div>
        </CollapsibleSection>

        {/* QBO SYNC Section (view only) */}
        {mode === 'view' && (
          <CollapsibleSection
            title="QUICKBOOKS SYNC"
            icon={<RefreshCw className="w-4 h-4 text-gray-400" />}
            defaultOpen={false}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                  qboStatus === 'synced'
                    ? 'bg-green-100 text-green-700'
                    : qboStatus === 'pending'
                    ? 'bg-amber-100 text-amber-700'
                    : qboStatus === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {qboStatus === 'synced' && <Check className="w-3 h-3" />}
                {qboStatus === 'error' && <AlertTriangle className="w-3 h-3" />}
                {qboStatus === 'synced' && 'Synced'}
                {qboStatus === 'pending' && 'Pending'}
                {qboStatus === 'error' && 'Error'}
                {!qboStatus && 'Not Synced'}
              </span>
            </div>

            {qboSyncedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Last Sync</span>
                <span className="text-sm text-gray-700">
                  {new Date(qboSyncedAt).toLocaleString()}
                </span>
              </div>
            )}

            {invoice?.qbo_invoice_id && (
              <a
                href={`https://app.qbo.intuit.com/app/invoice?txnId=${invoice.qbo_invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View in QuickBooks
              </a>
            )}
          </CollapsibleSection>
        )}
      </div>
    </aside>
  );
}
