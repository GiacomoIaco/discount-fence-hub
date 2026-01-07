/**
 * QuoteCard - Unified quote component for create/edit/view modes
 *
 * This component replaces both QuoteBuilderPage and QuoteDetailPage,
 * providing a single consistent UI for all quote interactions.
 *
 * Layout (Jobber pattern):
 * - Header: Quote number, status, action buttons
 * - Main content: Client section + Line items (ALWAYS visible)
 * - Right sidebar: Assignment, terms, profitability
 */

import { useState, useCallback } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import type { QuoteCardProps } from './types';
import { useQuoteForm } from './useQuoteForm';
import QuoteHeader from './QuoteHeader';
import QuoteClientSection from './QuoteClientSection';
import QuoteLineItems from './QuoteLineItems';
import QuoteSidebar from './QuoteSidebar';
import { useSendQuote, useApproveQuote, useConvertQuoteToJob, useUpdateQuoteStatus, useUpdateQuote } from '../../hooks/useQuotes';
import type { SkuSearchResult } from '../../hooks/useSkuSearch';
import { useEffectiveRateSheet, useRateSheetPrices, resolvePrice } from '../../../client_hub/hooks/usePricingResolution';
import { fetchSkuLaborCostPerFoot } from '../../hooks/useSkuLaborCost';

// Lost reason options
const LOST_REASONS = [
  'Price too high',
  'Went with competitor',
  'Project cancelled',
  'Budget constraints',
  'Timeline issues',
  'Changed requirements',
  'No response',
  'Other',
] as const;

export default function QuoteCard({
  mode: initialMode,
  projectId,
  clientId,
  communityId,
  propertyId,
  requestId,
  requestData,
  quoteId,
  onSave,
  onCancel: _onCancel,
  onBack,
  onConvertToJob,
  onSend,
  onApprove,
}: QuoteCardProps) {
  // Allow mode switching (view -> edit)
  const [mode, setMode] = useState(initialMode);

  // Mark Lost modal state
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostCompetitor, setLostCompetitor] = useState('');
  const [lostNotes, setLostNotes] = useState('');

  // Form state management
  const {
    form,
    setField,
    setFields,
    addLineItem,
    updateLineItem,
    removeLineItem,
    addCustomField,
    updateCustomField,
    removeCustomField,
    totals,
    validation,
    save,
    isSaving,
    isDirty,
    quote,
    isLoading,
  } = useQuoteForm({
    mode,
    quoteId,
    projectId,
    requestId,
    requestData,
    clientId,
    communityId,
    propertyId,
  });

  // Rate sheet pricing context (includes QBO Class for BU default fallback)
  const pricingContext = {
    communityId: form.communityId || null,
    clientId: form.clientId || null,
    qboClassId: quote?.qbo_class_id || null,
  };
  const { data: effectiveRateSheet } = useEffectiveRateSheet(pricingContext);
  const { data: rateSheetPrices } = useRateSheetPrices(pricingContext);

  // Flag for warning UI: no rate sheet found
  const hasNoRateSheet = !effectiveRateSheet?.rateSheetId && (form.clientId || form.communityId);

  // Mutations for quote actions
  const sendMutation = useSendQuote();
  const approveMutation = useApproveQuote();
  const convertMutation = useConvertQuoteToJob();
  const updateStatusMutation = useUpdateQuoteStatus();
  const updateQuoteMutation = useUpdateQuote();

  // Handle save - switches to view mode after successful save
  const handleSave = useCallback(async () => {
    try {
      const savedId = await save();
      if (savedId) {
        // Switch to view mode after successful save
        setMode('view');
        if (onSave) {
          onSave(quote as any);
        }
      }
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert(`Error saving quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [save, onSave, quote]);

  // Handle save and send via email
  const handleSaveAndSendEmail = useCallback(async () => {
    try {
      const savedId = await save();
      if (savedId) {
        await sendMutation.mutateAsync({
          id: savedId,
          method: 'email',
        });
        onSend?.(savedId);
        onBack?.();
      }
    } catch (error) {
      console.error('Failed to save and send quote:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [save, sendMutation, onSend, onBack]);

  // Handle save and send via text
  // TODO: Implement SMS sending when backend supports it
  const handleSaveAndSendText = useCallback(async () => {
    try {
      const savedId = await save();
      if (savedId) {
        // For now, SMS shows a message - actual SMS integration TBD
        alert('SMS sending is not yet implemented. The quote has been saved. Use email to send for now.');
        onSend?.(savedId);
      }
    } catch (error) {
      console.error('Failed to save quote:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [save, onSend]);

  // Handle send text (view mode - no save)
  // TODO: Implement SMS sending when backend supports it
  const handleSendText = useCallback(async () => {
    if (!quoteId) return;
    // For now, SMS shows a message - actual SMS integration TBD
    alert('SMS sending is not yet implemented. Use email to send for now.');
  }, [quoteId]);

  // Handle send email (view mode - no save)
  const handleSendEmail = useCallback(async () => {
    if (!quoteId) return;
    try {
      await sendMutation.mutateAsync({
        id: quoteId,
        method: 'email',
      });
      onSend?.(quoteId);
    } catch (error) {
      console.error('Failed to send quote:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [quoteId, sendMutation, onSend]);

  // Handle mark awaiting response
  const handleMarkAwaitingResponse = useCallback(async () => {
    if (!quoteId) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: quoteId,
        status: 'follow_up',
        notes: 'Marked as awaiting response',
      });
    } catch (error) {
      console.error('Failed to mark quote as awaiting response:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [quoteId, updateStatusMutation]);

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    if (mode === 'edit') {
      // Switch back to view mode
      setMode('view');
    } else if (_onCancel) {
      _onCancel();
    } else if (onBack) {
      onBack();
    }
  }, [mode, _onCancel, onBack]);

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (!quoteId) return;
    try {
      await approveMutation.mutateAsync({ id: quoteId });
      onApprove?.(quoteId);
    } catch (error) {
      console.error('Failed to approve quote:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [quoteId, approveMutation, onApprove]);

  // Handle convert to job
  const handleConvertToJob = useCallback(async () => {
    if (!quoteId) return;
    try {
      await convertMutation.mutateAsync(quoteId);
      onConvertToJob?.(quoteId);
    } catch (error) {
      console.error('Failed to convert quote to job:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [quoteId, convertMutation, onConvertToJob]);

  // Handle mark lost
  const handleMarkLost = useCallback(async () => {
    if (!quoteId || !lostReason) return;
    try {
      // Update status to lost and store reason
      await updateStatusMutation.mutateAsync({
        id: quoteId,
        status: 'lost',
        notes: `Reason: ${lostReason}${lostCompetitor ? `. Lost to: ${lostCompetitor}` : ''}${lostNotes ? `. ${lostNotes}` : ''}`,
      });
      // Also store the lost reason details separately
      await updateQuoteMutation.mutateAsync({
        id: quoteId,
        data: {
          lost_reason: lostReason,
          lost_to_competitor: lostCompetitor || null,
        },
      });
      setShowLostModal(false);
      setLostReason('');
      setLostCompetitor('');
      setLostNotes('');
    } catch (error) {
      console.error('Failed to mark quote as lost:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [quoteId, lostReason, lostCompetitor, lostNotes, updateStatusMutation, updateQuoteMutation]);

  // Handle edit mode switch
  const handleEdit = useCallback(() => {
    setMode('edit');
  }, []);

  // Handle SKU selection with rate sheet resolution and BU-specific labor cost
  const handleSkuSelect = useCallback(async (index: number, sku: SkuSearchResult | null) => {
    if (!sku) {
      updateLineItem(index, {
        sku_id: null,
        description: '',
        unit_price: 0,
        unit_cost: 0,
        pricing_source: null,
      });
      return;
    }

    // Material cost: standard_cost_per_foot is already per 1 LF (pre-computed)
    const materialCost = sku.standard_cost_per_foot || 0;

    // Labor cost: Fetch from sku_labor_costs_v2 based on quote's QBO class
    // This ensures we get the correct labor rate for the Business Unit
    let laborCost = 0;
    const qboClassId = quote?.qbo_class_id;

    if (qboClassId) {
      // Fetch BU-specific labor cost from sku_labor_costs_v2
      laborCost = await fetchSkuLaborCostPerFoot(sku.id, qboClassId);
    }

    // Fallback: If no QBO class or no labor cost found, use the stored labor cost
    // (divided by 100 since it's stored per 100 LF)
    if (laborCost === 0 && sku.standard_labor_cost) {
      laborCost = sku.standard_labor_cost / 100;
    }

    const totalUnitCost = materialCost + laborCost;

    // Default: use cost as price (only if no rate sheet - will show warning)
    let unitPrice = totalUnitCost;
    let pricingSource = 'No Rate Sheet - Using Cost';

    // Resolve price from rate sheet (priority: community > client > BU default)
    if (rateSheetPrices?.items && rateSheetPrices.rateSheet) {
      const resolved = resolvePrice(
        sku.id,
        totalUnitCost,
        rateSheetPrices.items,
        rateSheetPrices.rateSheet,
        rateSheetPrices.source
      );
      unitPrice = resolved.price;
      if (resolved.rateSheetName) {
        const sourceLabel = resolved.source === 'bu' ? 'BU Default' :
                           resolved.source === 'client' ? 'Client' :
                           resolved.source === 'community' ? 'Community' : '';
        pricingSource = `${sourceLabel} Rate Sheet: ${resolved.rateSheetName}`;
      } else if (resolved.pricingMethod === 'cost_only') {
        pricingSource = 'No Rate Sheet - Using Cost';
      }
    }

    updateLineItem(index, {
      sku_id: sku.id,
      sku_code: sku.sku_code,
      product_type_code: sku.product_type_code,
      description: sku.sku_name,
      unit_type: 'LF',
      unit_price: unitPrice,
      unit_cost: totalUnitCost,
      material_unit_cost: materialCost,
      labor_unit_cost: laborCost,
      pricing_source: pricingSource,
      line_type: 'material',
    });
  }, [updateLineItem, rateSheetPrices, quote?.qbo_class_id]);

  // Handle sidebar field changes
  const handleSidebarFieldChange = useCallback((field: string, value: string) => {
    setField(field as keyof typeof form, value);
  }, [setField]);

  // Handle client/property changes
  const handleClientChange = useCallback((newClientId: string, newCommunityId?: string) => {
    setFields({
      clientId: newClientId,
      communityId: newCommunityId || '',
      propertyId: '',
    });
  }, [setFields]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <QuoteHeader
        mode={mode}
        quote={quote}
        validation={validation}
        isSaving={isSaving || sendMutation.isPending || updateStatusMutation.isPending}
        isDirty={isDirty}
        onBack={onBack}
        onCancel={handleCancel}
        onSave={handleSave}
        // Edit mode: Save And... dropdown actions
        onSendEmail={mode !== 'view' ? handleSaveAndSendEmail : handleSendEmail}
        onSendText={mode !== 'view' ? handleSaveAndSendText : handleSendText}
        onMarkAwaitingResponse={handleMarkAwaitingResponse}
        // View mode actions
        onApprove={handleApprove}
        onMarkLost={() => setShowLostModal(true)}
        onConvertToJob={handleConvertToJob}
        onEdit={handleEdit}
        // TODO: Implement these handlers
        // onClone={() => { /* Clone quote */ }}
        // onArchive={() => { /* Archive quote */ }}
        // onPreviewAsClient={() => { /* Open preview */ }}
        // onCollectSignature={() => { /* Signature flow */ }}
        // onDownloadPdf={() => { /* Generate PDF */ }}
        // onPrint={() => { /* Print quote */ }}
      />

      {/* Main Layout: Content + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto space-y-6">
          {/* Client & Property Section - HIDDEN when project-linked (shown in ProjectContextHeader instead) */}
          {!projectId && (
            <QuoteClientSection
              mode={mode}
              clientId={form.clientId}
              communityId={form.communityId}
              propertyId={form.propertyId}
              projectId={projectId}
              onClientChange={handleClientChange}
              onCommunityChange={(id) => setFields({ communityId: id, propertyId: '' })}
              onPropertyChange={(id) => setField('propertyId', id)}
            />
          )}

          {/* Scope Summary (editable in create/edit modes) */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Scope Summary</h2>
            {mode !== 'view' ? (
              <textarea
                value={form.scopeSummary}
                onChange={(e) => setField('scopeSummary', e.target.value)}
                rows={3}
                placeholder="Describe the work to be done..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">
                {form.scopeSummary || 'No scope summary provided.'}
              </p>
            )}
          </div>

          {/* No Rate Sheet Warning */}
          {hasNoRateSheet && mode !== 'view' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">No Rate Sheet Found</h4>
                <p className="text-sm text-amber-700 mt-1">
                  No rate sheet is configured for this client or their Business Unit.
                  Prices shown are at cost (0% margin).
                </p>
                <p className="text-sm text-amber-600 mt-2">
                  Set a rate sheet in Client Settings, or configure a default rate sheet for the Business Unit in Settings.
                </p>
              </div>
            </div>
          )}

          {/* Line Items - ALWAYS VISIBLE */}
          <QuoteLineItems
            mode={mode}
            lineItems={form.lineItems}
            totals={totals}
            onAddItem={addLineItem}
            onUpdateItem={updateLineItem}
            onRemoveItem={removeLineItem}
            onSkuSelect={handleSkuSelect}
            discountPercent={form.discountPercent}
            depositPercent={form.depositPercent}
            onDiscountChange={(value) => setField('discountPercent', value)}
            onDepositChange={(value) => setField('depositPercent', value)}
          />

          {/* Notes Section */}
          {(mode !== 'view' || form.clientFacingNotes || form.internalNotes) && (
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h2 className="text-lg font-semibold">Notes</h2>

              {(mode !== 'view' || form.clientFacingNotes) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client-Facing Notes
                  </label>
                  {mode !== 'view' ? (
                    <textarea
                      value={form.clientFacingNotes}
                      onChange={(e) => setField('clientFacingNotes', e.target.value)}
                      rows={3}
                      placeholder="Notes visible to the client..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{form.clientFacingNotes}</p>
                  )}
                </div>
              )}

              {(mode !== 'view' || form.internalNotes) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  {mode !== 'view' ? (
                    <textarea
                      value={form.internalNotes}
                      onChange={(e) => setField('internalNotes', e.target.value)}
                      rows={3}
                      placeholder="Private notes for your team..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-yellow-50"
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap bg-yellow-50 p-3 rounded-lg">
                      {form.internalNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <QuoteSidebar
          mode={mode}
          productType={form.productType}
          linearFeet={form.linearFeet}
          validUntil={form.validUntil}
          paymentTerms={form.paymentTerms}
          taxRate={form.taxRate}
          salesRepId={form.salesRepId}
          qboClassId={quote?.qbo_class_id || null}
          totals={totals}
          validation={validation}
          onFieldChange={handleSidebarFieldChange}
          quoteDates={quote ? {
            created_at: quote.created_at,
            sent_at: quote.sent_at,
            viewed_at: quote.viewed_at,
            client_approved_at: quote.client_approved_at,
            expires_at: quote.valid_until,
          } : undefined}
          customFields={form.customFields}
          onAddCustomField={addCustomField}
          onUpdateCustomField={updateCustomField}
          onRemoveCustomField={removeCustomField}
        />
      </div>

      {/* Mark Lost Modal */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Quote Lost</h3>
            <p className="text-gray-600 mb-4">
              Record why this quote was lost. This helps us improve future quotes.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lost Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a reason...</option>
                  {LOST_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
              {lostReason === 'Went with competitor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Which Competitor? <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={lostCompetitor}
                    onChange={(e) => setLostCompetitor(e.target.value)}
                    placeholder="Competitor name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLostModal(false);
                  setLostReason('');
                  setLostCompetitor('');
                  setLostNotes('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkLost}
                disabled={updateStatusMutation.isPending || !lostReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Mark Lost
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
