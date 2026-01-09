/**
 * InvoiceHeader - Header for InvoiceCard
 *
 * Shows:
 * - Back button + Invoice number
 * - Status badge
 * - Context-aware action buttons
 * - "More Actions" dropdown
 */

import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Send,
  Edit2,
  Save,
  X,
  DollarSign,
  Ban,
  Trash2,
  ChevronDown,
  Printer,
  Download,
  RefreshCw,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import type { Invoice } from '../../types';
import type { InvoiceHeaderProps } from './types';
import { INVOICE_STATUS_COLORS } from './types';

export default function InvoiceHeader({
  mode,
  invoice,
  validation,
  isSaving,
  isDirty,
  onBack,
  onCancel,
  onSave,
  onEdit,
  onSend,
  onRecordPayment,
  onVoid,
  onMarkBadDebt,
}: InvoiceHeaderProps) {
  const [showMoreActions, setShowMoreActions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreActions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const status = invoice?.status || 'draft';
  const statusColors = INVOICE_STATUS_COLORS[status];
  const isPaid = status === 'paid';
  const isBadDebt = status === 'bad_debt';
  const isEditable = mode !== 'view' && !isPaid && !isBadDebt;
  const canSend = status === 'draft' && mode === 'view';
  const canRecordPayment = ['sent', 'past_due'].includes(status);

  // Determine title
  const title =
    mode === 'create'
      ? 'New Invoice'
      : invoice?.invoice_number
      ? `Invoice ${invoice.invoice_number}`
      : 'Invoice';

  return (
    <header className="sticky top-0 z-10 bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Back + Title + Status */}
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-green-500" />
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>

          {/* Status Badge */}
          {mode !== 'create' && invoice && (
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors.bg} ${statusColors.text}`}
            >
              {statusColors.label}
            </span>
          )}

          {/* Past Due Warning */}
          {status === 'past_due' && (
            <span className="flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Past Due
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Edit Mode Actions */}
          {mode !== 'view' && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!validation.isValid || isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Invoice'}
              </button>
            </>
          )}

          {/* View Mode Actions */}
          {mode === 'view' && invoice && (
            <>
              {/* Send Button (draft only) */}
              {canSend && onSend && (
                <button
                  onClick={onSend}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Invoice
                </button>
              )}

              {/* Record Payment Button */}
              {canRecordPayment && onRecordPayment && (
                <button
                  onClick={onRecordPayment}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  Record Payment
                </button>
              )}

              {/* Edit Button (not paid/bad_debt) */}
              {!isPaid && !isBadDebt && onEdit && (
                <button
                  onClick={onEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* More Actions Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  More
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showMoreActions && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                    {/* Send Options */}
                    {status === 'draft' && (
                      <button
                        onClick={() => {
                          onSend?.();
                          setShowMoreActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Send as Email
                      </button>
                    )}

                    {/* Resend (if already sent) */}
                    {['sent', 'past_due'].includes(status) && (
                      <button
                        onClick={() => {
                          onSend?.();
                          setShowMoreActions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resend Invoice
                      </button>
                    )}

                    {/* Download/Print */}
                    <button
                      onClick={() => {
                        // TODO: Implement PDF download
                        alert('Download PDF coming soon');
                        setShowMoreActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                    <button
                      onClick={() => {
                        window.print();
                        setShowMoreActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={() => {
                        // TODO: Implement duplicate
                        alert('Duplicate invoice coming soon');
                        setShowMoreActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate Invoice
                    </button>

                    <div className="border-t my-1" />

                    {/* Void/Write Off */}
                    {!isPaid && !isBadDebt && (
                      <>
                        <button
                          onClick={() => {
                            onVoid?.();
                            setShowMoreActions(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                        >
                          <Ban className="w-4 h-4" />
                          Void Invoice
                        </button>
                        <button
                          onClick={() => {
                            onMarkBadDebt?.();
                            setShowMoreActions(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Write Off as Bad Debt
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
