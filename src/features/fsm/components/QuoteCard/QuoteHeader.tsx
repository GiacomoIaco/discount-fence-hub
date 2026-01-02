/**
 * QuoteHeader - Header component for QuoteCard
 *
 * Shows quote number, status badge, and action buttons.
 * Actions change based on mode and quote status.
 */

import { ArrowLeft, FileText, Save, Send, Check, Briefcase, Edit2 } from 'lucide-react';
import type { Quote, QuoteStatus } from '../../types';
import type { QuoteCardMode, QuoteValidation } from './types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../types';

interface QuoteHeaderProps {
  mode: QuoteCardMode;
  quote?: Quote | null;
  validation: QuoteValidation;
  isSaving: boolean;
  isDirty: boolean;
  onBack?: () => void;
  onSave?: () => void;
  onSend?: () => void;
  onApprove?: () => void;
  onConvertToJob?: () => void;
  onEdit?: () => void;
}

export default function QuoteHeader({
  mode,
  quote,
  validation,
  isSaving,
  isDirty,
  onBack,
  onSave,
  onSend,
  onApprove,
  onConvertToJob,
  onEdit,
}: QuoteHeaderProps) {
  const status = quote?.status as QuoteStatus | undefined;
  const statusLabel = status ? QUOTE_STATUS_LABELS[status] : 'Draft';
  const statusColor = status ? QUOTE_STATUS_COLORS[status] : 'bg-gray-100 text-gray-700';

  // Determine available actions based on mode and status
  const showSaveButton = mode !== 'view';
  const showSendButton = mode !== 'view' && (status === 'draft' || status === 'pending_approval');
  const showApproveButton = mode === 'view' && status === 'sent';
  const showConvertButton = mode === 'view' && status === 'approved';
  const showEditButton = mode === 'view';

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left side: Back button + Quote info */}
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {mode === 'create' ? 'New Quote' : quote?.quote_number || 'Quote'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
                    {statusLabel}
                  </span>
                  {validation.needsApproval && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      Needs Approval
                    </span>
                  )}
                  {isDirty && (
                    <span className="text-xs text-gray-500">Unsaved changes</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Action buttons */}
          <div className="flex items-center gap-3">
            {/* Validation errors */}
            {validation.errors.length > 0 && (
              <span className="text-xs text-red-600">
                {validation.errors[0]}
              </span>
            )}

            {/* Edit button (view mode) */}
            {showEditButton && onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}

            {/* Save button (create/edit mode) */}
            {showSaveButton && onSave && (
              <button
                onClick={onSave}
                disabled={isSaving || !validation.isValid}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
            )}

            {/* Send button (create/edit mode, draft status) */}
            {showSendButton && onSend && (
              <button
                onClick={onSend}
                disabled={isSaving || !validation.isValid}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save & Send'}
              </button>
            )}

            {/* Approve button (view mode, sent status) */}
            {showApproveButton && onApprove && (
              <button
                onClick={onApprove}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check className="w-4 h-4" />
                Mark Approved
              </button>
            )}

            {/* Convert to Job button (view mode, approved status) */}
            {showConvertButton && onConvertToJob && (
              <button
                onClick={onConvertToJob}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Briefcase className="w-4 h-4" />
                Create Job
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
