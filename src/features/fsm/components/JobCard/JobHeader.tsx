/**
 * JobHeader - Header component for JobCard
 *
 * Shows:
 * - Back button
 * - Job number and title
 * - Status badge
 * - Action buttons (context-dependent)
 */

import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  Save,
  Edit2,
  Check,
  Receipt,
  Calendar,
  Package,
  Plus,
  AlertTriangle,
  MoreVertical,
  Printer,
  FileDown,
  X,
  Truck,
} from 'lucide-react';
import type { JobHeaderProps } from './types';
import { JOB_STATUS_COLORS } from './types';

export default function JobHeader({
  mode,
  job,
  validation,
  isSaving,
  isDirty: _isDirty,
  onBack,
  onCancel,
  onSave,
  onEdit,
  onComplete,
  onCreateInvoice,
  onSchedule,
  onSendToYard,
  onAddVisit,
  onReportIssue,
}: JobHeaderProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const status = job?.status || 'won';
  const statusConfig = JOB_STATUS_COLORS[status];

  // Determine which actions to show based on status
  const canSchedule = ['won'].includes(status);
  const canSendToYard = ['scheduled'].includes(status);
  const canComplete = ['in_progress', 'loaded'].includes(status);
  const canCreateInvoice = ['completed', 'requires_invoicing'].includes(status);
  const isTerminal = ['cancelled'].includes(status);

  return (
    <header className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'create' ? 'New Job' : job?.job_number || 'Job'}
                </h1>
                {job && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                )}
              </div>
              {job?.name && (
                <p className="text-sm text-gray-500">{job.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Create/Edit Mode Actions */}
          {mode !== 'view' && (
            <>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  disabled={isSaving}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onSave}
                disabled={isSaving || !validation.isValid}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Job
                  </>
                )}
              </button>
            </>
          )}

          {/* View Mode Actions */}
          {mode === 'view' && !isTerminal && (
            <>
              {/* Primary Action - varies by status */}
              {canSchedule && onSchedule && (
                <button
                  onClick={onSchedule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Job
                </button>
              )}

              {canSendToYard && onSendToYard && (
                <button
                  onClick={onSendToYard}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Send to Yard
                </button>
              )}

              {canComplete && onComplete && (
                <button
                  onClick={onComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Mark Complete
                </button>
              )}

              {canCreateInvoice && onCreateInvoice && (
                <button
                  onClick={onCreateInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  Create Invoice
                </button>
              )}

              {/* Edit Button */}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* More Actions Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border py-1 z-50">
                    {/* Visit & Issue Actions */}
                    {onAddVisit && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onAddVisit();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Visit
                      </button>
                    )}

                    {onReportIssue && (
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onReportIssue();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Report Issue
                      </button>
                    )}

                    <div className="border-t my-1" />

                    {/* Material Status Actions */}
                    {!['won'].includes(status) && (
                      <>
                        <button
                          onClick={() => setShowMoreMenu(false)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          View Material Status
                        </button>
                        <div className="border-t my-1" />
                      </>
                    )}

                    {/* Print & Export */}
                    <button
                      onClick={() => setShowMoreMenu(false)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Download Work Order
                    </button>
                    <button
                      onClick={() => setShowMoreMenu(false)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>

                    <div className="border-t my-1" />

                    {/* Cancel Job */}
                    {!['completed', 'requires_invoicing', 'cancelled'].includes(status) && (
                      <button
                        onClick={() => setShowMoreMenu(false)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel Job
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Validation Errors */}
      {!validation.isValid && mode !== 'view' && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Please fix the following errors:</span>
          </div>
          <ul className="mt-2 ml-6 text-sm text-red-600 list-disc">
            {Object.values(validation.errors).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
