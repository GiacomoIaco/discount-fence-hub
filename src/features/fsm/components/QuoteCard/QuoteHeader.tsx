/**
 * QuoteHeader - Header component for QuoteCard
 *
 * Shows quote number, status badge, BU badge, and action buttons.
 * Actions change based on mode and quote status.
 *
 * Follows Jobber pattern:
 * - Primary actions as buttons (Save, Send, Create Job)
 * - Secondary actions in "More" dropdown (Clone, Archive, Request Changes, etc.)
 */

import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Save,
  Send,
  Check,
  Briefcase,
  Edit2,
  XCircle,
  Building2,
  MoreVertical,
  Copy,
  Archive,
  Clock,
  DollarSign,
  MessageSquare,
  Bell,
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
  onMarkLost?: () => void;
  onConvertToJob?: () => void;
  onEdit?: () => void;
  // New Jobber-style actions
  onClone?: () => void;
  onArchive?: () => void;
  onRequestChanges?: () => void;
  onScheduleFollowUp?: () => void;
  onRequestDeposit?: () => void;
  onSendReminder?: () => void;
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
  onMarkLost,
  onConvertToJob,
  onEdit,
  onClone,
  onArchive,
  onRequestChanges,
  onScheduleFollowUp,
  onRequestDeposit,
  onSendReminder,
}: QuoteHeaderProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const status = quote?.status as QuoteStatus | undefined;
  const statusLabel = status ? QUOTE_STATUS_LABELS[status] : 'Draft';
  const statusColor = status ? QUOTE_STATUS_COLORS[status] : 'bg-gray-100 text-gray-700';

  // QBO Class / Business Unit info
  const qboClass = quote?.qbo_class;
  const buLabel = qboClass?.labor_code || qboClass?.name;
  const buType = qboClass?.bu_type || 'residential';
  const buColor = BU_TYPE_COLORS[buType] || BU_TYPE_COLORS.residential;

  // Determine available actions based on mode and status
  const showSaveButton = mode !== 'view';
  const showSendButton = mode !== 'view' && (status === 'draft' || status === 'pending_approval');
  const showApproveButton = mode === 'view' && status === 'sent';
  const showMarkLostButton = mode === 'view' && ['draft', 'sent', 'follow_up', 'changes_requested', 'pending_approval'].includes(status || '');
  const showConvertButton = mode === 'view' && status === 'approved';
  const showEditButton = mode === 'view';

  // More menu actions - show in view mode when quote exists
  const showMoreMenu_ = mode === 'view' && quote;

  // Build more menu items based on status
  const moreMenuItems: Array<{
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    divider?: boolean;
  }> = [];

  if (showMoreMenu_) {
    // Request Changes - when sent or follow_up
    if (['sent', 'follow_up'].includes(status || '') && onRequestChanges) {
      moreMenuItems.push({
        label: 'Request Changes',
        icon: <MessageSquare className="w-4 h-4" />,
        onClick: onRequestChanges,
      });
    }

    // Schedule Follow-up - when sent
    if (['sent', 'follow_up'].includes(status || '') && onScheduleFollowUp) {
      moreMenuItems.push({
        label: 'Schedule Follow-up',
        icon: <Clock className="w-4 h-4" />,
        onClick: onScheduleFollowUp,
      });
    }

    // Send Reminder - when sent
    if (['sent', 'follow_up'].includes(status || '') && onSendReminder) {
      moreMenuItems.push({
        label: 'Send Reminder',
        icon: <Bell className="w-4 h-4" />,
        onClick: onSendReminder,
      });
    }

    // Request Deposit - when approved
    if (status === 'approved' && onRequestDeposit) {
      moreMenuItems.push({
        label: 'Request Deposit',
        icon: <DollarSign className="w-4 h-4" />,
        onClick: onRequestDeposit,
      });
    }

    // Clone - always available (view mode)
    if (onClone) {
      if (moreMenuItems.length > 0) {
        moreMenuItems.push({ label: '', icon: null, divider: true });
      }
      moreMenuItems.push({
        label: 'Clone Quote',
        icon: <Copy className="w-4 h-4" />,
        onClick: onClone,
      });
    }

    // Archive - when not already archived/lost/converted
    if (!['lost', 'converted', 'archived'].includes(status || '') && onArchive) {
      moreMenuItems.push({
        label: 'Archive',
        icon: <Archive className="w-4 h-4" />,
        onClick: onArchive,
        danger: true,
      });
    }
  }

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
                  {buLabel && (
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${buColor}`}>
                      <Building2 className="w-3 h-3" />
                      {buLabel}
                    </span>
                  )}
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

            {/* Mark Lost button (view mode, certain statuses) */}
            {showMarkLostButton && onMarkLost && (
              <button
                onClick={onMarkLost}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Mark Lost
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

            {/* More Actions dropdown (view mode) */}
            {showMoreMenu_ && moreMenuItems.length > 0 && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                    <div className="py-1">
                      {moreMenuItems.map((item, index) =>
                        item.divider ? (
                          <div key={index} className="my-1 border-t border-gray-100" />
                        ) : (
                          <button
                            key={index}
                            onClick={() => {
                              setShowMoreMenu(false);
                              item.onClick?.();
                            }}
                            disabled={item.disabled}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2 text-sm text-left
                              ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
                              ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
