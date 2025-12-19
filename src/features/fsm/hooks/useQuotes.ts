import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Quote, QuoteLineItem, QuoteStatus } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface QuoteFilters {
  status?: QuoteStatus | QuoteStatus[];
  clientId?: string;
  salesRepId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useQuotes(filters?: QuoteFilters) {
  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name, code),
          community:communities(id, name),
          sales_rep:sales_reps(id, name),
          qbo_class:qbo_classes(id, name, bu_type, location_code)
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

      if (filters?.salesRepId) {
        query = query.eq('sales_rep_id', filters.salesRepId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Quote[];
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name, code, address_line1, city, state, zip, primary_contact_email, primary_contact_phone, primary_contact_name),
          community:communities(id, name),
          property:properties(id, address_line1, city, state, zip),
          sales_rep:sales_reps(id, name, email, phone),
          request:service_requests(id, request_number),
          line_items:quote_line_items(*),
          qbo_class:qbo_classes(id, name, bu_type, location_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Quote & { line_items: QuoteLineItem[] };
    },
    enabled: !!id,
  });
}

export function useQuotesByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['quotes', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          community:communities(id, name),
          sales_rep:sales_reps(id, name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!clientId,
  });
}

interface CreateQuoteData {
  request_id?: string;
  bom_project_id?: string;
  client_id: string;
  community_id?: string;
  property_id?: string;
  billing_address?: Quote['billing_address'];
  job_address?: Quote['job_address'];
  product_type?: string;
  linear_feet?: number;
  scope_summary?: string;
  valid_until?: string;
  payment_terms?: string;
  deposit_required?: number;
  deposit_percent?: number;
  sales_rep_id?: string;
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateQuoteData) => {
      const { data: result, error } = await supabase
        .from('quotes')
        .insert({
          request_id: data.request_id || null,
          bom_project_id: data.bom_project_id || null,
          client_id: data.client_id,
          community_id: data.community_id || null,
          property_id: data.property_id || null,
          billing_address: data.billing_address || null,
          job_address: data.job_address || null,
          product_type: data.product_type || null,
          linear_feet: data.linear_feet || null,
          scope_summary: data.scope_summary || null,
          valid_until: data.valid_until || null,
          payment_terms: data.payment_terms || 'Net 30',
          deposit_required: data.deposit_required || 0,
          deposit_percent: data.deposit_percent || 0,
          sales_rep_id: data.sales_rep_id || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess(`Quote ${data.quote_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create quote');
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Quote> }) => {
      const { error } = await supabase
        .from('quotes')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess('Quote updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update quote');
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: QuoteStatus;
      notes?: string;
    }) => {
      // Get current status for history
      const { data: current } = await supabase
        .from('quotes')
        .select('status')
        .eq('id', id)
        .single();

      // Update status
      const { error: updateError } = await supabase
        .from('quotes')
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
          entity_type: 'quote',
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
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess('Status updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update status');
    },
  });
}

export function useSendQuote() {
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
        .from('quotes')
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
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess('Quote sent');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to send quote');
    },
  });
}

export function useApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('quotes')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approval_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess('Quote approved');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to approve quote');
    },
  });
}

export function useConvertQuoteToJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      // Get quote data
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      // Create job from quote
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          quote_id: quoteId,
          client_id: quote.client_id,
          community_id: quote.community_id,
          property_id: quote.property_id,
          job_address: quote.job_address || {},
          product_type: quote.product_type,
          linear_feet: quote.linear_feet,
          description: quote.scope_summary,
          quoted_total: quote.total,
          bom_project_id: quote.bom_project_id,
          status: 'won',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Transfer custom fields from quote to job (Jobber-style)
      try {
        await supabase.rpc('transfer_custom_fields', {
          p_source_entity_type: 'quote',
          p_source_entity_id: quoteId,
          p_target_entity_type: 'job',
          p_target_entity_id: job.id,
        });
      } catch (transferError) {
        // Log but don't fail the conversion if transfer fails
        console.warn('Failed to transfer custom fields:', transferError);
      }

      // Update quote status
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_to_job_id: job.id,
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess(`Job ${job.job_number} created from quote`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to convert quote to job');
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess('Quote deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete quote');
    },
  });
}

// Quote Line Items
export function useAddQuoteLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<QuoteLineItem, 'id' | 'created_at'>) => {
      const { data: result, error } = await supabase
        .from('quote_line_items')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.quote_id] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add line item');
    },
  });
}

export function useUpdateQuoteLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuoteLineItem> }) => {
      const { error } = await supabase
        .from('quote_line_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update line item');
    },
  });
}

export function useDeleteQuoteLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete line item');
    },
  });
}
