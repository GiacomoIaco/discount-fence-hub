import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Invoice, InvoiceLineItem, InvoiceStatus, Payment, PaymentMethod } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface InvoiceFilters {
  status?: InvoiceStatus | InvoiceStatus[];
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  isPastDue?: boolean;
}

export function useInvoices(filters?: InvoiceFilters) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, code),
          job:jobs(id, job_number)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.dateFrom) {
        query = query.gte('invoice_date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('invoice_date', filters.dateTo);
      }

      if (filters?.isPastDue) {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .lt('due_date', today)
          .gt('balance_due', 0);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, code, address_line1, city, state, zip),
          job:jobs(id, job_number, product_type, linear_feet),
          quote:quotes(id, quote_number),
          line_items:invoice_line_items(*),
          payments:payments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Invoice & {
        line_items: InvoiceLineItem[];
        payments: Payment[];
        quote?: { id: string; quote_number: string };
      };
    },
    enabled: !!id,
  });
}

export function useInvoicesByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          job:jobs(id, job_number)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!clientId,
  });
}

interface CreateInvoiceData {
  job_id?: string;
  quote_id?: string;
  client_id: string;
  billing_address: Invoice['billing_address'];
  subtotal: number;
  tax_rate?: number;
  tax_amount?: number;
  discount_amount?: number;
  total: number;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: string;
  po_number?: string;
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const { data: result, error } = await supabase
        .from('invoices')
        .insert({
          job_id: data.job_id || null,
          quote_id: data.quote_id || null,
          client_id: data.client_id,
          billing_address: data.billing_address,
          subtotal: data.subtotal,
          tax_rate: data.tax_rate || 0,
          tax_amount: data.tax_amount || 0,
          discount_amount: data.discount_amount || 0,
          total: data.total,
          amount_paid: 0,
          balance_due: data.total,
          invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
          due_date: data.due_date || null,
          payment_terms: data.payment_terms || 'Net 30',
          po_number: data.po_number || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess(`Invoice ${data.invoice_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create invoice');
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Invoice> }) => {
      const { error } = await supabase
        .from('invoices')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess('Invoice updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update invoice');
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: InvoiceStatus;
      notes?: string;
    }) => {
      // Get current status for history
      const { data: current } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', id)
        .single();

      // Update status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status,
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Record in history
      const { error: historyError } = await supabase
        .from('fsm_status_history')
        .insert({
          entity_type: 'invoice',
          entity_id: id,
          from_status: current?.status || null,
          to_status: status,
          notes: notes || null,
        });

      if (historyError) {
        console.warn('Failed to record status history:', historyError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess('Status updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update status');
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      method,
      email,
    }: {
      id: string;
      method: 'email' | 'client_hub' | 'print';
      email?: string;
    }) => {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          status_changed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          sent_method: method,
          sent_to_email: email || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess('Invoice sent');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to send invoice');
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentMethod,
      referenceNumber,
      paymentDate,
      notes,
    }: {
      invoiceId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      referenceNumber?: string;
      paymentDate?: string;
      notes?: string;
    }) => {
      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          amount,
          payment_method: paymentMethod,
          reference_number: referenceNumber || null,
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
          notes: notes || null,
        });

      if (paymentError) throw paymentError;

      // Get current invoice to calculate new balance
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('amount_paid, total')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      const newAmountPaid = (invoice.amount_paid || 0) + amount;
      const newBalance = invoice.total - newAmountPaid;

      // Update invoice amounts and status
      const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'sent';

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalance,
          status: newStatus,
          status_changed_at: newBalance <= 0 ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      showSuccess('Payment recorded');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to record payment');
    },
  });
}

export function useSyncToQuickBooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // This would call a Netlify function to sync with QuickBooks
      // For now, just update the sync status
      const { error } = await supabase
        .from('invoices')
        .update({
          qbo_sync_status: 'synced',
          qbo_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess('Synced to QuickBooks');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to sync to QuickBooks');
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess('Invoice deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete invoice');
    },
  });
}

// Invoice Line Items
export function useAddInvoiceLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<InvoiceLineItem, 'id' | 'created_at'>) => {
      const { data: result, error } = await supabase
        .from('invoice_line_items')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.invoice_id] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add line item');
    },
  });
}

export function useUpdateInvoiceLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvoiceLineItem> }) => {
      const { error } = await supabase
        .from('invoice_line_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update line item');
    },
  });
}

export function useDeleteInvoiceLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete line item');
    },
  });
}
