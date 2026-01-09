/**
 * useQuoteForm - State management hook for QuoteCard
 *
 * Handles:
 * - Form state initialization from quote or request data
 * - Line item CRUD operations
 * - Totals calculation
 * - Validation
 * - Save logic with proper mutation handling
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQuote,
  useCreateQuote,
  useUpdateQuote,
  useAddQuoteLineItem,
  useUpdateQuoteLineItem,
  useDeleteQuoteLineItem,
} from '../../hooks/useQuotes';
import type {
  QuoteCardMode,
  QuoteCardProps,
  QuoteFormState,
  LineItemFormState,
  QuoteTotals,
  QuoteValidation,
  CustomField,
} from './types';
import { DEFAULT_LINE_ITEM } from './types';
interface UseQuoteFormOptions {
  mode: QuoteCardMode;
  quoteId?: string;
  projectId?: string;
  requestId?: string;
  requestData?: QuoteCardProps['requestData'];
  clientId?: string;
  communityId?: string;
  propertyId?: string;
}
interface UseQuoteFormReturn {
  // Form state
  form: QuoteFormState;
  setField: <K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) => void;
  setFields: (updates: Partial<QuoteFormState>) => void;
  // Line items
  addLineItem: () => void;
  updateLineItem: (index: number, updates: Partial<LineItemFormState>) => void;
  removeLineItem: (index: number) => void;
  // Custom fields
  addCustomField: () => void;
  updateCustomField: (id: string, field: 'label' | 'value', value: string) => void;
  removeCustomField: (id: string) => void;
  // Calculations
  totals: QuoteTotals;
  validation: QuoteValidation;
  // Save
  save: () => Promise<string | null>;
  isSaving: boolean;
  isDirty: boolean;
  // Quote data
  quote: ReturnType<typeof useQuote>['data'];
  isLoading: boolean;
}
const initialFormState: QuoteFormState = {
  clientId: '',
  communityId: '',
  propertyId: '',
  jobTitle: '',
  productType: '',
  linearFeet: '',
  scopeSummary: '',
  validUntil: '',
  paymentTerms: 'Net 30',
  depositPercent: '0',
  discountPercent: '0',
  taxRate: '8.25',
  salesRepId: '',
  clientFacingNotes: '',
  internalNotes: '',
  lineItems: [],
  customFields: [],
};
export function useQuoteForm(options: UseQuoteFormOptions): UseQuoteFormReturn {
  const { mode, quoteId, projectId, requestId, requestData, clientId, communityId, propertyId } = options;
  // Query client for explicit invalidation
  const queryClient = useQueryClient();
  // Load existing quote for edit/view modes
  const { data: quote, isLoading: isLoadingQuote } = useQuote(mode !== 'create' ? quoteId : undefined);
  // Mutations
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const addLineItemMutation = useAddQuoteLineItem();
  const updateLineItemMutation = useUpdateQuoteLineItem();
  const deleteLineItemMutation = useDeleteQuoteLineItem();
  // Form state
  const [form, setForm] = useState<QuoteFormState>(initialFormState);
  const [isDirty, setIsDirty] = useState(false);
  const [originalLineItemIds, setOriginalLineItemIds] = useState<string[]>([]);
  // Track if we've initialized from props (to prevent re-initialization)
  const hasInitializedFromProps = useRef(false);
  // Reset initialization flag when mode changes to something other than create
  useEffect(() => {
    if (mode !== 'create') {
      hasInitializedFromProps.current = false;
    }
  }, [mode]);
  // Initialize form from existing quote
  useEffect(() => {
    if (quote && mode !== 'create') {
      const lineItems = (quote.line_items || []).map(li => ({
        id: li.id,
        line_type: li.line_type,
        description: li.description,
        quantity: li.quantity,
        unit_type: li.unit_type || 'EA',
        unit_price: li.unit_price,
        unit_cost: li.unit_cost || 0,
        sku_id: li.sku_id || null,
        pricing_source: null,
        isNew: false,
      }));
      setForm({
        clientId: quote.client_id || '',
        communityId: quote.community_id || '',
        propertyId: quote.property_id || '',
        jobTitle: '',
        productType: quote.product_type || '',
        linearFeet: quote.linear_feet?.toString() || '',
        scopeSummary: quote.scope_summary || '',
        validUntil: quote.valid_until || '',
        paymentTerms: quote.payment_terms || 'Net 30',
        depositPercent: quote.deposit_percent?.toString() || '0',
        discountPercent: quote.discount_percent?.toString() || '0',
        taxRate: ((quote.tax_rate || 0.0825) * 100).toString(),
        salesRepId: quote.sales_rep_user_id || '',
        clientFacingNotes: '',
        internalNotes: '',
        lineItems,
        customFields: [],
      });
      setOriginalLineItemIds(lineItems.filter(li => li.id).map(li => li.id!));
      setIsDirty(false);
    }
  }, [quote, mode]);
  // Initialize form from request data or project context (create mode)
  // This effect runs once when entering create mode with valid props
  useEffect(() => {
    // Only initialize in create mode when we haven't already initialized
    if (mode !== 'create' || hasInitializedFromProps.current) {
      return;
    }
    // Check if we have meaningful props to initialize from
    const hasPropsToInit = clientId || communityId || propertyId || requestData;
    if (hasPropsToInit) {
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 30);
      setForm(prev => ({
        ...prev,
        clientId: clientId || requestData?.client_id || '',
        communityId: communityId || requestData?.community_id || '',
        propertyId: propertyId || requestData?.property_id || '',
        productType: requestData?.product_type || '',
        linearFeet: requestData?.linear_feet?.toString() || '',
        scopeSummary: requestData?.description || '',
        validUntil: validDate.toISOString().split('T')[0],
      }));
      // Mark as initialized so we don't re-run
      hasInitializedFromProps.current = true;
    }
  }, [mode, clientId, communityId, propertyId, requestData]);
  // Field setters
  const setField = useCallback(<K extends keyof QuoteFormState>(key: K, value: QuoteFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);
  const setFields = useCallback((updates: Partial<QuoteFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);
  // Line item operations
  const addLineItem = useCallback(() => {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...DEFAULT_LINE_ITEM }],
    }));
    setIsDirty(true);
  }, []);
  const updateLineItem = useCallback((index: number, updates: Partial<LineItemFormState>) => {
    setForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    }));
    setIsDirty(true);
  }, []);
  const removeLineItem = useCallback((index: number) => {
    setForm(prev => {
      const item = prev.lineItems[index];
      if (item.id) {
        // Mark for deletion instead of removing immediately
        return {
          ...prev,
          lineItems: prev.lineItems.map((li, i) =>
            i === index ? { ...li, isDeleted: true } : li
          ),
        };
      } else {
        // New item, just remove from array
        return {
          ...prev,
          lineItems: prev.lineItems.filter((_, i) => i !== index),
        };
      }
    });
    setIsDirty(true);
  }, []);

  // Custom field operations
  const addCustomField = useCallback(() => {
    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: '',
      value: '',
      isNew: true,
    };
    setForm(prev => ({
      ...prev,
      customFields: [...prev.customFields, newField],
    }));
    setIsDirty(true);
  }, []);

  const updateCustomField = useCallback((id: string, field: 'label' | 'value', value: string) => {
    setForm(prev => ({
      ...prev,
      customFields: prev.customFields.map(cf =>
        cf.id === id ? { ...cf, [field]: value } : cf
      ),
    }));
    setIsDirty(true);
  }, []);

  const removeCustomField = useCallback((id: string) => {
    setForm(prev => ({
      ...prev,
      customFields: prev.customFields.filter(cf => cf.id !== id),
    }));
    setIsDirty(true);
  }, []);

  // Calculate totals
  const totals = useMemo((): QuoteTotals => {
    const activeItems = form.lineItems.filter(li => !li.isDeleted);
    const subtotal = activeItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const materialCost = activeItems.reduce((sum, item) => {
      // Use separate material cost if available, otherwise fallback to unit_cost
      const matCost = item.material_unit_cost ?? item.unit_cost;
      return sum + (item.quantity * matCost);
    }, 0);
    // Use separate labor cost field which properly tracks labor component
    const laborCost = activeItems
      .reduce((sum, item) => {
      const labCost = item.labor_unit_cost ?? 0;
      return sum + (item.quantity * labCost);
    }, 0);
    const discountPercent = parseFloat(form.discountPercent) || 0;
    const taxRate = parseFloat(form.taxRate) || 0;
    const depositPercent = parseFloat(form.depositPercent) || 0;
    const discountAmount = subtotal * discountPercent / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * taxRate / 100;
    const total = taxableAmount + taxAmount;
    const grossProfit = total - materialCost - laborCost;
    // Clamp margin to fit in database column (numeric(5,2) allows -999.99 to 999.99)
    const rawMargin = total > 0 ? (grossProfit / total * 100) : 0;
    const marginPercent = Math.max(-999.99, Math.min(999.99, rawMargin));
    const depositAmount = total * depositPercent / 100;
    return {
      subtotal,
      materialCost,
      laborCost,
      discountAmount,
      taxAmount,
      total,
      grossProfit,
      marginPercent,
      depositAmount,
    };
  }, [form.lineItems, form.discountPercent, form.taxRate, form.depositPercent]);
  // Validation
  const validation = useMemo((): QuoteValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const approvalReasons: string[] = [];
    if (!form.clientId) {
      errors.push('Client is required');
    }
    const activeItems = form.lineItems.filter(li => !li.isDeleted);
    if (activeItems.length === 0) {
      warnings.push('No line items added');
    }
    // Approval thresholds
    if (totals.marginPercent < 15 && activeItems.length > 0) {
      approvalReasons.push(`Margin (${totals.marginPercent.toFixed(1)}%) below 15%`);
    }
    if (parseFloat(form.discountPercent) > 10) {
      approvalReasons.push(`Discount (${form.discountPercent}%) exceeds 10%`);
    }
    if (totals.total > 25000) {
      approvalReasons.push(`Total ($${totals.total.toLocaleString()}) exceeds $25,000`);
    }
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      needsApproval: approvalReasons.length > 0,
      approvalReasons,
    };
  }, [form.clientId, form.lineItems, form.discountPercent, totals]);
  // Save function
  const save = useCallback(async (): Promise<string | null> => {
    if (!validation.isValid) {
      console.error('[QuoteForm] Validation failed:', validation.errors);
      return null;
    }
    const activeItems = form.lineItems.filter(li => !li.isDeleted);
    console.log('[QuoteForm] Starting save with', activeItems.length, 'active line items');
    try {
      let savedQuoteId: string;
      if (mode === 'create') {
        // Create new quote
        const result = await createMutation.mutateAsync({
          request_id: requestId || undefined,
          project_id: projectId || undefined,
          client_id: form.clientId,
          community_id: form.communityId || undefined,
          property_id: form.propertyId || undefined,
          product_type: form.productType || undefined,
          linear_feet: form.linearFeet ? parseFloat(form.linearFeet) : undefined,
          scope_summary: form.scopeSummary || undefined,
          valid_until: form.validUntil || undefined,
          payment_terms: form.paymentTerms,
          deposit_percent: parseFloat(form.depositPercent) || 0,
          deposit_required: totals.depositAmount,
          sales_rep_id: form.salesRepId || undefined,
        });
        savedQuoteId = result.id;
        console.log('[QuoteForm] Created quote:', savedQuoteId);
        // Add line items
        for (let i = 0; i < activeItems.length; i++) {
          const item = activeItems[i];
          console.log('[QuoteForm] Adding line item', i + 1, ':', item.description);
          await addLineItemMutation.mutateAsync({
            quote_id: savedQuoteId,
            line_type: item.line_type,
            description: item.description,
            quantity: item.quantity,
            unit_type: item.unit_type,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost,
            total_price: item.quantity * item.unit_price,
            sort_order: i,
            is_visible_to_client: true,
            group_name: null,
            material_id: null,
            labor_code_id: null,
            sku_id: item.sku_id || null,
            is_optional: false,
            is_selected: true,
          });
        }
        // Update totals
        await updateMutation.mutateAsync({
          id: savedQuoteId,
          data: {
            subtotal: totals.subtotal,
            tax_rate: parseFloat(form.taxRate) / 100,
            tax_amount: totals.taxAmount,
            discount_percent: parseFloat(form.discountPercent) || 0,
            discount_amount: totals.discountAmount,
            total: totals.total,
            total_material_cost: totals.materialCost,
            total_labor_cost: totals.laborCost,
            margin_percent: totals.marginPercent,
            requires_approval: validation.needsApproval,
            approval_reason: validation.needsApproval ? validation.approvalReasons.join('; ') : null,
          },
        });
      } else {
        // Update existing quote
        savedQuoteId = quoteId!;
        await updateMutation.mutateAsync({
          id: savedQuoteId,
          data: {
            client_id: form.clientId,
            community_id: form.communityId || null,
            property_id: form.propertyId || null,
            product_type: form.productType || null,
            linear_feet: form.linearFeet ? parseFloat(form.linearFeet) : null,
            scope_summary: form.scopeSummary || null,
            valid_until: form.validUntil || null,
            payment_terms: form.paymentTerms,
            deposit_percent: parseFloat(form.depositPercent) || 0,
            deposit_required: totals.depositAmount,
            sales_rep_user_id: form.salesRepId || null,
            tax_rate: parseFloat(form.taxRate) / 100,
            discount_percent: parseFloat(form.discountPercent) || 0,
            discount_amount: totals.discountAmount,
            subtotal: totals.subtotal,
            tax_amount: totals.taxAmount,
            total: totals.total,
            total_material_cost: totals.materialCost,
            total_labor_cost: totals.laborCost,
            margin_percent: totals.marginPercent,
            requires_approval: validation.needsApproval,
            approval_reason: validation.needsApproval ? validation.approvalReasons.join('; ') : null,
          },
        });
        // Handle line items: delete, update, add
        const currentIds = form.lineItems.filter(li => li.id && !li.isDeleted).map(li => li.id!);
        // Delete removed items
        for (const id of originalLineItemIds.filter(id => !currentIds.includes(id))) {
          await deleteLineItemMutation.mutateAsync(id);
        }
        // Delete marked-for-deletion items
        for (const item of form.lineItems.filter(li => li.id && li.isDeleted)) {
          await deleteLineItemMutation.mutateAsync(item.id!);
        }
        // Update existing and add new items
        let sortOrder = 0;
        for (const item of activeItems) {
          if (item.id) {
            await updateLineItemMutation.mutateAsync({
              id: item.id,
              data: {
                line_type: item.line_type,
                description: item.description,
                quantity: item.quantity,
                unit_type: item.unit_type,
                unit_price: item.unit_price,
                unit_cost: item.unit_cost,
                total_price: item.quantity * item.unit_price,
                sort_order: sortOrder,
                sku_id: item.sku_id || null,
              },
            });
          } else {
            await addLineItemMutation.mutateAsync({
              quote_id: savedQuoteId,
              line_type: item.line_type,
              description: item.description,
              quantity: item.quantity,
              unit_type: item.unit_type,
              unit_price: item.unit_price,
              unit_cost: item.unit_cost,
              total_price: item.quantity * item.unit_price,
              sort_order: sortOrder,
              is_visible_to_client: true,
              group_name: null,
              material_id: null,
              labor_code_id: null,
              sku_id: item.sku_id || null,
              is_optional: false,
              is_selected: true,
            });
          }
          sortOrder++;
        }
      }
      console.log('[QuoteForm] Save completed:', savedQuoteId);
      setIsDirty(false);
      // Explicitly invalidate and refetch project_quotes to ensure list updates
      // before the parent component changes state (fixes timing issue)
      if (projectId) {
        await queryClient.invalidateQueries({ queryKey: ['project_quotes', projectId] });
        await queryClient.refetchQueries({ queryKey: ['project_quotes', projectId] });
      }
      // Also invalidate general quotes list
      await queryClient.invalidateQueries({ queryKey: ['quotes'] });
      return savedQuoteId;
    } catch (error) {
      console.error('[QuoteForm] Save failed:', error);
      throw error;
    }
  }, [
    mode, quoteId, projectId, requestId, form, totals, validation,
    originalLineItemIds, createMutation, updateMutation,
    addLineItemMutation, updateLineItemMutation, deleteLineItemMutation,
    queryClient,
  ]);
  const isSaving = createMutation.isPending || updateMutation.isPending ||
    addLineItemMutation.isPending || updateLineItemMutation.isPending ||
    deleteLineItemMutation.isPending;
  return {
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
    isLoading: isLoadingQuote,
  };
}
