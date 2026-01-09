/**
 * useInvoiceForm - Form state management for InvoiceCard
 *
 * Handles:
 * - Form state initialization from existing invoice or props
 * - Line item management
 * - Totals calculation
 * - Validation
 * - Save logic with mutations
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  InvoiceCardMode,
  InvoiceFormState,
  LineItemFormState,
  InvoiceTotals,
  InvoiceValidation,
} from './types';
import type { Invoice, InvoiceLineItem, Payment, AddressSnapshot } from '../../types';
import {
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useAddInvoiceLineItem,
  useUpdateInvoiceLineItem,
  useDeleteInvoiceLineItem,
} from '../../hooks/useInvoices';

interface UseInvoiceFormParams {
  mode: InvoiceCardMode;
  invoiceId?: string;
  projectId?: string;
  jobId?: string;
  quoteId?: string;
  clientId?: string;
  billingAddress?: Invoice['billing_address'];
}

interface UseInvoiceFormReturn {
  // Form state
  form: InvoiceFormState;
  setField: (field: keyof InvoiceFormState, value: string | number | LineItemFormState[] | AddressSnapshot) => void;
  setFields: (fields: Partial<InvoiceFormState>) => void;

  // Line items
  addLineItem: () => void;
  updateLineItem: (index: number, data: Partial<LineItemFormState>) => void;
  removeLineItem: (index: number) => void;

  // Computed
  totals: InvoiceTotals;
  validation: InvoiceValidation;
  isDirty: boolean;

  // Actions
  save: () => Promise<Invoice | null>;
  isSaving: boolean;

  // Data
  invoice: (Invoice & { line_items: InvoiceLineItem[]; payments: Payment[] }) | null;
  isLoading: boolean;
}

const emptyLineItem: LineItemFormState = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
};

const initialFormState: InvoiceFormState = {
  projectId: '',
  jobId: '',
  quoteId: '',
  clientId: '',
  billingAddress: {
    line1: '',
    city: '',
    state: '',
    zip: '',
  },
  subtotal: 0,
  taxRate: 8.25, // Default Texas rate
  taxAmount: 0,
  discountAmount: 0,
  total: 0,
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  paymentTerms: 'Net 30',
  terms: '',
  poNumber: '',
  notes: '',
  internalNotes: '',
  lineItems: [{ ...emptyLineItem }],
};

export function useInvoiceForm({
  mode,
  invoiceId,
  projectId,
  jobId,
  quoteId,
  clientId,
  billingAddress,
}: UseInvoiceFormParams): UseInvoiceFormReturn {
  const [form, setForm] = useState<InvoiceFormState>(initialFormState);
  const [originalForm, setOriginalForm] = useState<InvoiceFormState>(initialFormState);

  // Fetch existing invoice
  const { data: invoice, isLoading } = useInvoice(invoiceId);

  // Mutations
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const addLineItemMutation = useAddInvoiceLineItem();
  const updateLineItemMutation = useUpdateInvoiceLineItem();
  const deleteLineItemMutation = useDeleteInvoiceLineItem();

  const isSaving =
    createInvoice.isPending ||
    updateInvoice.isPending ||
    addLineItemMutation.isPending ||
    updateLineItemMutation.isPending ||
    deleteLineItemMutation.isPending;

  // Initialize form from existing invoice or props
  useEffect(() => {
    if (mode === 'create') {
      // Initialize with props
      const newForm: InvoiceFormState = {
        ...initialFormState,
        projectId: projectId || '',
        jobId: jobId || '',
        quoteId: quoteId || '',
        clientId: clientId || '',
        billingAddress: billingAddress || initialFormState.billingAddress,
      };

      // Calculate due date based on payment terms
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30); // Default Net 30

      newForm.dueDate = dueDate.toISOString().split('T')[0];

      setForm(newForm);
      setOriginalForm(newForm);
    } else if (invoice) {
      // Load from existing invoice
      const lineItems: LineItemFormState[] =
        invoice.line_items?.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          amount: item.total,
        })) || [{ ...emptyLineItem }];

      const loadedForm: InvoiceFormState = {
        projectId: invoice.project_id || '',
        jobId: invoice.job_id || '',
        quoteId: invoice.quote_id || '',
        clientId: invoice.client_id || '',
        billingAddress: invoice.billing_address || initialFormState.billingAddress,
        subtotal: invoice.subtotal || 0,
        taxRate: invoice.tax_rate || 0,
        taxAmount: invoice.tax_amount || 0,
        discountAmount: invoice.discount_amount || 0,
        total: invoice.total || 0,
        invoiceDate: invoice.invoice_date || new Date().toISOString().split('T')[0],
        dueDate: invoice.due_date || '',
        paymentTerms: invoice.payment_terms || 'Net 30',
        terms: invoice.terms || '',
        poNumber: invoice.po_number || '',
        notes: invoice.notes || '',
        internalNotes: invoice.internal_notes || '',
        lineItems: lineItems.length > 0 ? lineItems : [{ ...emptyLineItem }],
      };

      setForm(loadedForm);
      setOriginalForm(loadedForm);
    }
  }, [mode, invoice, projectId, jobId, quoteId, clientId, billingAddress]);

  // Set a single field
  const setField = useCallback(
    (field: keyof InvoiceFormState, value: string | number | LineItemFormState[] | AddressSnapshot) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Set multiple fields
  const setFields = useCallback((fields: Partial<InvoiceFormState>) => {
    setForm((prev) => ({ ...prev, ...fields }));
  }, []);

  // Line item management
  const addLineItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...emptyLineItem }],
    }));
  }, []);

  const updateLineItem = useCallback((index: number, data: Partial<LineItemFormState>) => {
    setForm((prev) => {
      const newItems = [...prev.lineItems];
      const currentItem = newItems[index];

      // Update item
      newItems[index] = { ...currentItem, ...data };

      // Recalculate amount if quantity or price changed
      if (data.quantity !== undefined || data.unitPrice !== undefined) {
        const qty = data.quantity ?? currentItem.quantity;
        const price = data.unitPrice ?? currentItem.unitPrice;
        newItems[index].amount = qty * price;
      }

      return { ...prev, lineItems: newItems };
    });
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setForm((prev) => {
      const newItems = prev.lineItems.filter((_, i) => i !== index);
      // Ensure at least one item
      return {
        ...prev,
        lineItems: newItems.length > 0 ? newItems : [{ ...emptyLineItem }],
      };
    });
  }, []);

  // Calculate totals
  const totals: InvoiceTotals = useMemo(() => {
    const subtotal = form.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * (form.taxRate / 100);
    const total = subtotal + taxAmount - form.discountAmount;
    const amountPaid = invoice?.amount_paid || 0;
    const balanceDue = total - amountPaid;

    return {
      subtotal,
      taxAmount,
      discountAmount: form.discountAmount,
      total,
      amountPaid,
      balanceDue,
    };
  }, [form.lineItems, form.taxRate, form.discountAmount, invoice?.amount_paid]);

  // Validation
  const validation: InvoiceValidation = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!form.clientId) {
      errors.clientId = 'Client is required';
    }

    if (form.lineItems.length === 0 || form.lineItems.every((i) => !i.description)) {
      errors.lineItems = 'At least one line item is required';
    }

    if (!form.invoiceDate) {
      errors.invoiceDate = 'Invoice date is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [form]);

  // Check if form has changed
  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  // Save function
  const save = useCallback(async (): Promise<Invoice | null> => {
    if (!validation.isValid) {
      return null;
    }

    try {
      if (mode === 'create') {
        // Create new invoice
        const result = await createInvoice.mutateAsync({
          job_id: form.jobId || undefined,
          quote_id: form.quoteId || undefined,
          client_id: form.clientId,
          billing_address: form.billingAddress,
          subtotal: totals.subtotal,
          tax_rate: form.taxRate,
          tax_amount: totals.taxAmount,
          discount_amount: form.discountAmount,
          total: totals.total,
          invoice_date: form.invoiceDate,
          due_date: form.dueDate || undefined,
          payment_terms: form.paymentTerms,
          po_number: form.poNumber || undefined,
        });

        // Add line items
        for (const item of form.lineItems) {
          if (item.description) {
            await addLineItemMutation.mutateAsync({
              invoice_id: result.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: item.amount,
            });
          }
        }

        // Update notes/terms separately (not in create payload)
        if (form.notes || form.internalNotes || form.terms) {
          await updateInvoice.mutateAsync({
            id: result.id,
            data: {
              notes: form.notes || null,
              internal_notes: form.internalNotes || null,
              terms: form.terms || null,
            },
          });
        }

        return result;
      } else if (invoiceId) {
        // Update existing invoice
        await updateInvoice.mutateAsync({
          id: invoiceId,
          data: {
            client_id: form.clientId,
            billing_address: form.billingAddress,
            subtotal: totals.subtotal,
            tax_rate: form.taxRate,
            tax_amount: totals.taxAmount,
            discount_amount: form.discountAmount,
            total: totals.total,
            balance_due: totals.balanceDue,
            invoice_date: form.invoiceDate,
            due_date: form.dueDate || null,
            payment_terms: form.paymentTerms,
            po_number: form.poNumber || null,
            notes: form.notes || null,
            internal_notes: form.internalNotes || null,
            terms: form.terms || null,
          },
        });

        // Sync line items
        const existingIds = new Set(invoice?.line_items?.map((i) => i.id) || []);
        const formIds = new Set(form.lineItems.filter((i) => i.id).map((i) => i.id));

        // Delete removed items
        for (const existingId of existingIds) {
          if (existingId && !formIds.has(existingId)) {
            await deleteLineItemMutation.mutateAsync(existingId);
          }
        }

        // Update or create items
        for (const item of form.lineItems) {
          if (!item.description) continue;

          if (item.id) {
            // Update existing
            await updateLineItemMutation.mutateAsync({
              id: item.id,
              data: {
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total: item.amount,
              },
            });
          } else {
            // Create new
            await addLineItemMutation.mutateAsync({
              invoice_id: invoiceId,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: item.amount,
            });
          }
        }

        return invoice as Invoice;
      }

      return null;
    } catch (error) {
      console.error('Failed to save invoice:', error);
      return null;
    }
  }, [
    mode,
    invoiceId,
    validation.isValid,
    form,
    totals,
    invoice,
    createInvoice,
    updateInvoice,
    addLineItemMutation,
    updateLineItemMutation,
    deleteLineItemMutation,
  ]);

  return {
    form,
    setField,
    setFields,
    addLineItem,
    updateLineItem,
    removeLineItem,
    totals,
    validation,
    isDirty,
    save,
    isSaving,
    invoice: invoice || null,
    isLoading,
  };
}
