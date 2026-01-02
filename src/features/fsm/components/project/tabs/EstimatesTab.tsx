/**
 * EstimatesTab - Quotes management within a Project
 *
 * Features:
 * - List all quotes with acceptance status
 * - Accept/decline quotes
 * - Create new quotes
 * - Convert accepted quote to jobs
 * - Version tracking (revisions)
 */

import { useState } from 'react';
import {
  FileText,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Copy,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type { Quote, QuoteAcceptanceStatus, QuoteLineItem } from '../../../types';
import { useAcceptQuote, useDeclineQuote, useCreateQuoteRevision } from '../../../hooks/useAcceptQuote';
import { TotalsDisplay } from '../../shared/TotalsDisplay';

const ACCEPTANCE_STATUS_COLORS: Record<QuoteAcceptanceStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  superseded: 'bg-gray-100 text-gray-500',
};

const ACCEPTANCE_STATUS_ICONS: Record<QuoteAcceptanceStatus, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle,
  declined: XCircle,
  superseded: AlertCircle,
};

interface EstimatesTabProps {
  quotes: Quote[];
  projectId: string;
  onCreateQuote?: () => void;
  onEditQuote?: (quoteId: string) => void;
  onConvertToJobs?: (quoteId: string) => void;
  onViewQuote?: (quoteId: string) => void;
}

export function EstimatesTab({
  quotes,
  projectId,
  onCreateQuote,
  onEditQuote,
  onConvertToJobs,
  onViewQuote,
}: EstimatesTabProps) {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const acceptQuote = useAcceptQuote();
  const declineQuote = useDeclineQuote();
  const createRevision = useCreateQuoteRevision();

  // Sort quotes: accepted first, then pending, then others
  const sortedQuotes = [...quotes].sort((a, b) => {
    const order: Record<QuoteAcceptanceStatus, number> = {
      accepted: 0,
      pending: 1,
      declined: 2,
      superseded: 3,
    };
    return (
      order[a.acceptance_status || 'pending'] - order[b.acceptance_status || 'pending']
    );
  });

  // Check if any quote is already accepted
  const hasAcceptedQuote = quotes.some((q) => q.acceptance_status === 'accepted');

  const toggleExpand = (quoteId: string) => {
    setExpandedQuoteId(expandedQuoteId === quoteId ? null : quoteId);
  };

  const handleAccept = (quoteId: string) => {
    acceptQuote.mutate({ quoteId });
  };

  const handleDecline = (quoteId: string) => {
    declineQuote.mutate(
      { quoteId, reason: declineReason },
      {
        onSuccess: () => {
          setShowDeclineModal(null);
          setDeclineReason('');
        },
      }
    );
  };

  const handleCreateRevision = (quoteId: string) => {
    createRevision.mutate({ originalQuoteId: quoteId });
  };

  if (quotes.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-medium text-gray-900 mb-2">No Estimates Yet</h3>
        <p className="text-gray-500 mb-4">Create your first estimate for this project</p>
        {onCreateQuote && (
          <button
            onClick={onCreateQuote}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Estimate
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Estimates ({quotes.length})</h3>
          {hasAcceptedQuote && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Quote accepted - ready for jobs
            </p>
          )}
        </div>
        {onCreateQuote && (
          <button
            onClick={onCreateQuote}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Estimate
          </button>
        )}
      </div>

      {/* Quotes List */}
      <div className="space-y-3">
        {sortedQuotes.map((quote) => {
          const isExpanded = expandedQuoteId === quote.id;
          const acceptanceStatus: QuoteAcceptanceStatus =
            quote.acceptance_status || 'pending';
          const StatusIcon = ACCEPTANCE_STATUS_ICONS[acceptanceStatus];
          const lineItems = (quote.line_items || []) as QuoteLineItem[];
          const isPending = acceptanceStatus === 'pending';
          const isAccepted = acceptanceStatus === 'accepted';
          const isSuperseded = acceptanceStatus === 'superseded';

          return (
            <div
              key={quote.id}
              className={`bg-white rounded-lg border overflow-hidden ${
                isAccepted ? 'border-green-300 ring-1 ring-green-100' : ''
              }`}
            >
              {/* Quote Header (always visible) */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(quote.id)}
              >
                {/* Status Icon */}
                <div
                  className={`p-2 rounded-lg ${
                    isAccepted
                      ? 'bg-green-100'
                      : isPending
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                  }`}
                >
                  <StatusIcon
                    className={`w-5 h-5 ${
                      isAccepted
                        ? 'text-green-600'
                        : isPending
                        ? 'text-yellow-600'
                        : 'text-gray-500'
                    }`}
                  />
                </div>

                {/* Quote Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {quote.quote_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACCEPTANCE_STATUS_COLORS[acceptanceStatus]}`}
                    >
                      {acceptanceStatus.charAt(0).toUpperCase() +
                        acceptanceStatus.slice(1)}
                    </span>
                    {quote.version_number && quote.version_number > 1 && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs">
                        v{quote.version_number}
                      </span>
                    )}
                    {isSuperseded && quote.superseded_by_quote_id && (
                      <span className="text-xs text-gray-500">
                        (superseded by newer version)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{lineItems.length} line items</span>
                    <span>{quote.product_type || 'Mixed'}</span>
                    {quote.created_at && (
                      <span>
                        {new Date(quote.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${(quote.total || 0).toLocaleString()}
                  </p>
                  {quote.deposit_required && quote.deposit_required > 0 && (
                    <p className="text-sm text-gray-500">
                      Deposit: ${quote.deposit_required.toLocaleString()}
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

              {/* Expanded Content - Line Items ALWAYS visible when expanded */}
              {isExpanded && (
                <div className="border-t">
                  {/* Line Items Table */}
                  <div className="p-4">
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
                            <td className="py-2">
                              <p className="font-medium text-gray-900">
                                {item.description}
                              </p>
                              {item.sku_code && (
                                <p className="text-xs text-gray-500">
                                  SKU: {item.sku_code}
                                </p>
                              )}
                            </td>
                            <td className="py-2 text-right text-gray-600">
                              {item.quantity}
                            </td>
                            <td className="py-2 text-right text-gray-600">
                              ${(item.unit_price || 0).toFixed(2)}
                            </td>
                            <td className="py-2 text-right font-medium">
                              ${(item.total || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="px-4 pb-4">
                    <TotalsDisplay
                      subtotal={quote.subtotal || 0}
                      taxAmount={quote.tax_amount || 0}
                      discountAmount={quote.discount_amount || 0}
                      total={quote.total || 0}
                      layout="horizontal"
                    />
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {/* Accept/Decline for pending quotes */}
                    {isPending && !hasAcceptedQuote && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(quote.id);
                          }}
                          disabled={acceptQuote.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          Accept Quote
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeclineModal(quote.id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </>
                    )}

                    {/* Convert to Jobs for accepted quotes */}
                    {isAccepted && onConvertToJobs && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onConvertToJobs(quote.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Create Jobs from Quote
                      </button>
                    )}

                    {/* Edit (for draft/pending) */}
                    {isPending && onEditQuote && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditQuote(quote.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    )}

                    {/* Create Revision */}
                    {(isPending || isAccepted) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateRevision(quote.id);
                        }}
                        disabled={createRevision.isPending}
                        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4" />
                        Create Revision
                      </button>
                    )}

                    {/* View Details */}
                    {onViewQuote && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewQuote(quote.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        View Full Details
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Decline Reason Display */}
                  {quote.declined_reason && (
                    <div className="px-4 pb-4">
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">
                          <strong>Decline Reason:</strong> {quote.declined_reason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Decline Quote</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for declining this quote:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeclineModal(null);
                  setDeclineReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecline(showDeclineModal)}
                disabled={declineQuote.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {declineQuote.isPending ? 'Declining...' : 'Decline Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstimatesTab;
