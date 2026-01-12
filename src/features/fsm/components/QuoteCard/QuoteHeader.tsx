/**
 * QuoteHeader - Header component for QuoteCard
 *
 * Shows quote number, status badge, BU badge, and action buttons.
 * Actions change based on mode and quote status.
 *
 * Follows Jobber pattern:
 * - Edit Mode: Cancel | Save Quote | Save And... dropdown
 * - View Mode: Send Text (primary) | Edit | More Actions dropdown
 *
 * Manager Approval Workflow:
 * - When validation.needsApproval is true, "Send" becomes "Send for Approval"
 * - When status is pending_manager_approval, managers see Approve/Reject buttons
 */

import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Save,
  Check,
  Briefcase,
  Edit2,
  XCircle,
  Building2,
  MoreHorizontal,
  Copy,
  Archive,
  Clock,
  MessageSquare,
  Mail,
  ChevronDown,
  Eye,
  Download,
  Printer,
  FileSignature,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Ticket,
} from 'lucide-react';
import type { Quote, QuoteStatus } from '../../types';
import type { QuoteCardMode, QuoteValidation } from './types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../types';

// BU type colors
const BU_TYPE_COLORS: Record<string, string> = {
  residential: 'bg-blue-100 text-blue-700 border-blue-200',
  builders: 'bg-orange-100 text-orange-700 border-orange-200',
  commercial: 'bg-green-100 text-green-700 border-green-200',
};

// Quote type labels and colors (from migration 217c)
const QUOTE_TYPE_LABELS: Record<string, string> = {
  original: '',  // Don't show badge for original quotes
  change_order: 'Change Order',
  warranty: 'Warranty',
  revision: 'Revision',
};

const QUOTE_TYPE_COLORS: Record<string, string> = {
  change_order: 'bg-amber-100 text-amber-700 border-amber-200',
  warranty: 'bg-red-100 text-red-700 border-red-200',
  revision: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

interface QuoteHeaderProps {
  mode: QuoteCardMode;
  quote?: Quote | null;
  validation: QuoteValidation;
  isSaving: boolean;
  isDirty: boolean;
  isManager?: boolean;  // True if current user can approve quotes
  onBack?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  onSendEmail?: () => void;
  onSendText?: () => void;
  onApprove?: () => void;  // Client approval (after sent)
  onMarkLost?: () => void;
  onMarkAwaitingResponse?: () => void;
  onConvertToJob?: () => void;
  onEdit?: () => void;
  onClone?: () => void;
  onCreateAlternative?: () => void;  // Create alternative quote in same group
  onArchive?: () => void;
  onPreviewAsClient?: () => void;
  onCollectSignature?: () => void;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  onCreateTicket?: () => void;  // Create internal ticket linked to this quote
  // Manager approval workflow
  onRequestManagerApproval?: () => void;  // Rep requests approval (before send)
  onManagerApprove?: () => void;  // Manager approves
  onManagerReject?: () => void;   // Manager rejects (back to draft)
}

export default function QuoteHeader({
  mode,
  quote,
  validation,
  isSaving,
  isDirty,
  isManager = false,
  onBack,
  onCancel,
  onSave,
  onSendEmail,
  onSendText,
  onApprove,
  onMarkLost,
  onMarkAwaitingResponse,
  onConvertToJob,
  onEdit,
  onClone,
  onCreateAlternative,
  onArchive,
  onPreviewAsClient,
  onCollectSignature,
  onDownloadPdf,
  onPrint,
  onCreateTicket,
  onRequestManagerApproval,
  onManagerApprove,
  onManagerReject,
}: QuoteHeaderProps) {
  const [showSaveAndMenu, setShowSaveAndMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const saveAndMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (saveAndMenuRef.current && !saveAndMenuRef.current.contains(event.target as Node)) {
        setShowSaveAndMenu(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const status = quote?.status as QuoteStatus | undefined;
  const statusLabel = status ? QUOTE_STATUS_LABELS[status] : 'Draft';
  const statusColor = status ? QUOTE_STATUS_COLORS[status] : 'bg-gray-100 text-gray-700';

  // Quote type badge (change orders, warranty, etc.)
  const quoteType = quote?.quote_type || 'original';
  const quoteTypeLabel = QUOTE_TYPE_LABELS[quoteType] || '';
  const quoteTypeColor = QUOTE_TYPE_COLORS[quoteType] || '';
  const isAlternative = quote?.is_alternative || false;

  // QBO Class / Business Unit info
  const qboClass = quote?.qbo_class;
  const buLabel = qboClass?.labor_code || qboClass?.name;
  const buType = qboClass?.bu_type || 'residential';
  const buColor = BU_TYPE_COLORS[buType] || BU_TYPE_COLORS.residential;

  const isEditMode = mode === 'create' || mode === 'edit';
  const isViewMode = mode === 'view';

  // Manager approval state
  const needsManagerApproval = validation.needsApproval && !quote?.manager_approved_at;
  const isPendingManagerApproval = status === 'pending_approval';
  const hasManagerApproval = !!quote?.manager_approved_at;

  // Can convert to job only when:
  // 1. Quote is accepted by client (status === 'accepted')
  // 2. Quote hasn't already been converted (no converted_to_job_id)
  // 3. If approval was needed, it must have been granted
  const canConvertToJob =
    status === 'accepted' &&
    !quote?.converted_to_job_id &&
    (!needsManagerApproval || hasManagerApproval);
  // Can mark CLIENT accepted only after quote has been sent (awaiting_response)
  const canMarkClientAccepted = ['awaiting_response', 'changes_requested'].includes(status || '');
  // Can mark lost when not already lost/converted/archived/expired
  const canMarkLost = !['lost', 'converted', 'archived', 'expired', 'accepted'].includes(status || '');

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
                  {/* Quote type badge (Change Order, Warranty, etc.) */}
                  {quoteTypeLabel && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${quoteTypeColor}`}>
                      {quoteTypeLabel}
                    </span>
                  )}
                  {/* Alternative quote indicator */}
                  {isAlternative && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                      Alternative
                    </span>
                  )}
                  {buLabel && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${buColor}`}>
                      <Building2 className="w-3 h-3" />
                      {buLabel}
                    </span>
                  )}
                  {/* Manager approval badge */}
                  {needsManagerApproval && !isPendingManagerApproval && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      <AlertTriangle className="w-3 h-3" />
                      Needs Approval
                    </span>
                  )}
                  {hasManagerApproval && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      <ThumbsUp className="w-3 h-3" />
                      Manager Approved
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

            {/* ========== PENDING MANAGER APPROVAL BUTTONS (for managers) ========== */}
            {isPendingManagerApproval && isManager && isViewMode && (
              <>
                {onManagerReject && (
                  <button
                    onClick={onManagerReject}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                  </button>
                )}
                {onManagerApprove && (
                  <button
                    onClick={onManagerApprove}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve
                  </button>
                )}
              </>
            )}

            {/* ========== EDIT MODE BUTTONS (Jobber Image #5) ========== */}
            {isEditMode && (
              <>
                {/* Cancel button */}
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}

                {/* Save Quote button */}
                {onSave && (
                  <button
                    onClick={onSave}
                    disabled={isSaving || !validation.isValid}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Quote'}
                  </button>
                )}

                {/* Save And... dropdown */}
                <div className="relative" ref={saveAndMenuRef}>
                  <button
                    onClick={() => setShowSaveAndMenu(!showSaveAndMenu)}
                    disabled={isSaving || !validation.isValid}
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Save And...
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showSaveAndMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                      <div className="py-1">
                        <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                          Save and...
                        </div>

                        {/* Request Manager Approval - show when thresholds violated */}
                        {needsManagerApproval && onRequestManagerApproval && (
                          <button
                            onClick={() => {
                              setShowSaveAndMenu(false);
                              onRequestManagerApproval();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-orange-700 hover:bg-orange-50 border-b border-orange-100"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            Send for Approval
                            <span className="ml-auto text-xs text-orange-500">Required</span>
                          </button>
                        )}

                        {/* Regular send options - only show if no approval needed OR already approved */}
                        {(!needsManagerApproval || hasManagerApproval) && (
                          <>
                            {onSendText && (
                              <button
                                onClick={() => {
                                  setShowSaveAndMenu(false);
                                  onSendText();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <MessageSquare className="w-4 h-4" />
                                Send as Text Message
                              </button>
                            )}
                            {onSendEmail && (
                              <button
                                onClick={() => {
                                  setShowSaveAndMenu(false);
                                  onSendEmail();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Mail className="w-4 h-4" />
                                Send as Email
                              </button>
                            )}
                          </>
                        )}

                        {/* NOTE: Convert to Job removed from edit mode - only available in view mode
                            after quote is accepted and passes all approval checks */}
                        {onMarkAwaitingResponse && (
                          <button
                            onClick={() => {
                              setShowSaveAndMenu(false);
                              onMarkAwaitingResponse();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Clock className="w-4 h-4" />
                            Mark as Awaiting Response
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ========== VIEW MODE BUTTONS (Jobber Image #6) ========== */}
            {isViewMode && !isPendingManagerApproval && (
              <>
                {/* Primary action depends on approval state */}
                {needsManagerApproval && onRequestManagerApproval ? (
                  // Needs approval - show Send for Approval button
                  <button
                    onClick={onRequestManagerApproval}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Send for Approval
                  </button>
                ) : onSendText ? (
                  // No approval needed - show Send Text Message
                  <button
                    onClick={onSendText}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Text Message
                  </button>
                ) : null}

                {/* Edit button */}
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}

                {/* More Actions dropdown */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    More Actions
                  </button>
                  {showMoreMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                      <div className="py-1">
                        {/* Primary actions */}
                        {onConvertToJob && canConvertToJob && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onConvertToJob();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Briefcase className="w-4 h-4" />
                            Convert to Job
                          </button>
                        )}
                        {onClone && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onClone();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Copy className="w-4 h-4" />
                            Create Similar Quote
                          </button>
                        )}
                        {onCreateAlternative && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onCreateAlternative();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Copy className="w-4 h-4" />
                            Create Alternative Option
                          </button>
                        )}

                        {/* Send as... section - only if approval not required */}
                        {(!needsManagerApproval || hasManagerApproval) && (
                          <>
                            <div className="my-1 border-t border-gray-100" />
                            <div className="px-4 py-2 text-xs font-medium text-gray-500">
                              Send as...
                            </div>
                            {onSendEmail && (
                              <button
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  onSendEmail();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Mail className="w-4 h-4" />
                                Email
                              </button>
                            )}
                          </>
                        )}

                        {/* Mark as... section */}
                        <div className="my-1 border-t border-gray-100" />
                        <div className="px-4 py-2 text-xs font-medium text-gray-500">
                          Mark as...
                        </div>
                        {onMarkAwaitingResponse && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onMarkAwaitingResponse();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Clock className="w-4 h-4" />
                            Awaiting Response
                          </button>
                        )}
                        {onApprove && canMarkClientAccepted && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onApprove();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Check className="w-4 h-4" />
                            Accepted
                          </button>
                        )}
                        {onMarkLost && canMarkLost && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onMarkLost();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Lost
                          </button>
                        )}

                        {/* Other actions */}
                        <div className="my-1 border-t border-gray-100" />
                        {onPreviewAsClient && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onPreviewAsClient();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            Preview as Client
                          </button>
                        )}
                        {onCollectSignature && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onCollectSignature();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FileSignature className="w-4 h-4" />
                            Collect Signature
                          </button>
                        )}
                        {onDownloadPdf && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onDownloadPdf();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="w-4 h-4" />
                            Download PDF
                          </button>
                        )}
                        {onPrint && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onPrint();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </button>
                        )}
                        {onCreateTicket && (
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              onCreateTicket();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Ticket className="w-4 h-4" />
                            Create Ticket
                          </button>
                        )}

                        {/* Archive */}
                        {onArchive && !['lost', 'converted', 'archived'].includes(status || '') && (
                          <>
                            <div className="my-1 border-t border-gray-100" />
                            <button
                              onClick={() => {
                                setShowMoreMenu(false);
                                onArchive();
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ========== PENDING APPROVAL VIEW MODE (for non-managers) ========== */}
            {isViewMode && isPendingManagerApproval && !isManager && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Awaiting Manager Approval</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
