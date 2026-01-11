import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Quote, QuoteLineItem, QuoteStatus, RepUser } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface QuoteFilters {
  status?: QuoteStatus | QuoteStatus[];
  clientId?: string;
  salesRepId?: string;  // Now expects user_id, not sales_rep_id
  dateFrom?: string;
  dateTo?: string;
}

// Helper to fetch user profiles by IDs
async function fetchUserProfiles(userIds: string[]): Promise<Map<string, RepUser>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, phone')
    .in('id', userIds);

  if (error) {
    console.warn('Failed to fetch user profiles:', error);
    return new Map();
  }

  const map = new Map<string, RepUser>();
  (data || []).forEach(u => map.set(u.id, {
    id: u.id,
    name: u.full_name || u.email || 'Unknown',
    full_name: u.full_name,
    email: u.email || '',
    phone: u.phone || null,
  }));
  return map;
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
          qbo_class:qbo_classes(id, name, bu_type, location_code, labor_code)
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
        // Filter by new user_id column
        query = query.eq('sales_rep_user_id', filters.salesRepId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Collect unique user IDs for rep lookups
      const userIds = new Set<string>();
      (data || []).forEach(quote => {
        if (quote.sales_rep_user_id) userIds.add(quote.sales_rep_user_id);
      });

      // Fetch user profiles
      const userMap = await fetchUserProfiles(Array.from(userIds));

      // Merge user profiles into quotes
      const quotesWithUsers = (data || []).map(quote => ({
        ...quote,
        sales_rep_user: quote.sales_rep_user_id ? userMap.get(quote.sales_rep_user_id) : undefined,
      }));

      return quotesWithUsers as Quote[];
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
          request:service_requests(id, request_number),
          line_items:quote_line_items(*),
          qbo_class:qbo_classes(id, name, bu_type, location_code, labor_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch user profile for sales rep
      const userIds: string[] = [];
      if (data.sales_rep_user_id) userIds.push(data.sales_rep_user_id);

      const userMap = await fetchUserProfiles(userIds);

      return {
        ...data,
        sales_rep_user: data.sales_rep_user_id ? userMap.get(data.sales_rep_user_id) : undefined,
      } as Quote & { line_items: QuoteLineItem[] };
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
          community:communities(id, name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect unique user IDs for rep lookups
      const userIds = new Set<string>();
      (data || []).forEach(quote => {
        if (quote.sales_rep_user_id) userIds.add(quote.sales_rep_user_id);
      });

      // Fetch user profiles
      const userMap = await fetchUserProfiles(Array.from(userIds));

      // Merge user profiles into quotes
      const quotesWithUsers = (data || []).map(quote => ({
        ...quote,
        sales_rep_user: quote.sales_rep_user_id ? userMap.get(quote.sales_rep_user_id) : undefined,
      }));

      return quotesWithUsers as Quote[];
    },
    enabled: !!clientId,
  });
}

interface CreateQuoteData {
  request_id?: string;
  project_id?: string;
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
  sales_rep_id?: string;  // Accepts user_id for backwards compatibility

  // Quote type for change orders/alternatives (migration 217c)
  quote_type?: 'original' | 'change_order' | 'warranty' | 'revision';
  quote_group?: string;      // Groups alternative quotes together
  is_alternative?: boolean;  // True if this is an alternative to another quote
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateQuoteData) => {
      const { data: result, error } = await supabase
        .from('quotes')
        .insert({
          request_id: data.request_id || null,
          project_id: data.project_id || null,
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
          sales_rep_user_id: data.sales_rep_id || null,  // Write to user_id column
          status: 'draft',
          // Quote type for change orders/alternatives (migration 217c)
          quote_type: data.quote_type || 'original',
          quote_group: data.quote_group || null,
          is_alternative: data.is_alternative || false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
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
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
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
      method: 'email' | 'client_hub' | 'print' | 'manual';
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
          client_accepted_at: new Date().toISOString(), // Triggers computed status
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
      // Note: status is auto-computed by trigger, quote auto-converts via cascade trigger
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          quote_id: quoteId,  // This triggers cascade: Quote → converted
          client_id: quote.client_id,
          community_id: quote.community_id,
          property_id: quote.property_id,
          job_address: quote.job_address || {},
          product_type: quote.product_type,
          linear_feet: quote.linear_feet,
          description: quote.scope_summary,
          quoted_total: quote.total,
          bom_project_id: quote.bom_project_id,
          // status: computed by trigger (will be 'won')
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

      // Quote status auto-updated via cascade trigger
      // Status history is auto-recorded by trigger

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
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
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
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update line item');
    },
  });
}

/**
 * Toggle the selection of an optional line item.
 * Optional items (is_optional=true) can be selected/deselected by the customer.
 * Only selected items are included in the quote total.
 */
export function useToggleOptionalLineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_selected }: { id: string; is_selected: boolean }) => {
      const { error } = await supabase
        .from('quote_line_items')
        .update({ is_selected })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to toggle optional item');
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
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete line item');
    },
  });
}

// =============================================
// Change Order & Alternative Quote Helpers
// (From migration 217c - Request-Project Lifecycle)
// =============================================

interface CreateChangeOrderData {
  project_id: string;
  client_id: string;
  community_id?: string;
  property_id?: string;
  billing_address?: Quote['billing_address'];
  job_address?: Quote['job_address'];
  scope_summary?: string;
  sales_rep_id?: string;
}

/**
 * Creates a change order quote on an existing project.
 * Change orders skip the Request step - they go directly to Quote.
 */
export function useCreateChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChangeOrderData) => {
      const { data: result, error } = await supabase
        .from('quotes')
        .insert({
          project_id: data.project_id,
          client_id: data.client_id,
          community_id: data.community_id || null,
          property_id: data.property_id || null,
          billing_address: data.billing_address || null,
          job_address: data.job_address || null,
          scope_summary: data.scope_summary || null,
          sales_rep_user_id: data.sales_rep_id || null,
          status: 'draft',
          quote_type: 'change_order',  // Mark as change order
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess(`Change Order ${data.quote_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create change order');
    },
  });
}

interface CreateAlternativeQuoteData {
  original_quote_id: string;  // The quote to create an alternative for
  scope_summary?: string;     // Different scope for this alternative
}

/**
 * Creates an alternative quote in the same quote_group as the original.
 * When one alternative is accepted, the trigger auto-declines the others.
 */
export function useCreateAlternativeQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAlternativeQuoteData) => {
      // First, get the original quote to copy from
      const { data: original, error: fetchError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', data.original_quote_id)
        .single();

      if (fetchError) throw fetchError;
      if (!original) throw new Error('Original quote not found');

      // Use original quote's ID as the group if not already set
      const quoteGroup = original.quote_group || original.id;

      // Update original to have quote_group if it didn't have one
      if (!original.quote_group) {
        await supabase
          .from('quotes')
          .update({ quote_group: quoteGroup })
          .eq('id', original.id);
      }

      // Create the alternative
      const { data: result, error } = await supabase
        .from('quotes')
        .insert({
          project_id: original.project_id,
          request_id: original.request_id,
          client_id: original.client_id,
          community_id: original.community_id,
          property_id: original.property_id,
          billing_address: original.billing_address,
          job_address: original.job_address,
          product_type: original.product_type,
          linear_feet: original.linear_feet,
          scope_summary: data.scope_summary || original.scope_summary,
          valid_until: original.valid_until,
          payment_terms: original.payment_terms,
          sales_rep_user_id: original.sales_rep_user_id,
          status: 'draft',
          quote_type: original.quote_type,
          quote_group: quoteGroup,       // Same group as original
          is_alternative: true,          // Mark as alternative
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess(`Alternative Quote ${data.quote_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create alternative quote');
    },
  });
}

/**
 * Fetch all quotes in the same quote_group (alternatives).
 * Returns all quotes including the current one.
 */
export function useQuoteAlternatives(quoteGroup: string | null | undefined) {
  return useQuery({
    queryKey: ['quote_alternatives', quoteGroup],
    queryFn: async () => {
      if (!quoteGroup) return [];

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          total,
          is_alternative,
          scope_summary,
          created_at,
          client_accepted_at,
          archived_at
        `)
        .eq('quote_group', quoteGroup)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!quoteGroup,
  });
}

// ============================================
// Manager Approval Workflow Hooks
// ============================================

/**
 * Fetch quote approval settings for a business unit.
 * Falls back to global default if no BU-specific settings exist.
 */
export function useQuoteApprovalSettings(qboClassId?: string | null) {
  return useQuery({
    queryKey: ['quote_approval_settings', qboClassId],
    queryFn: async () => {
      // Try BU-specific settings first
      if (qboClassId) {
        const { data: buSettings, error: buError } = await supabase
          .from('quote_approval_settings')
          .select('*')
          .eq('qbo_class_id', qboClassId)
          .single();

        if (!buError && buSettings) {
          return buSettings;
        }
      }

      // Fall back to global default (qbo_class_id IS NULL)
      const { data: globalSettings, error: globalError } = await supabase
        .from('quote_approval_settings')
        .select('*')
        .is('qbo_class_id', null)
        .single();

      if (globalError) {
        console.warn('No approval settings found:', globalError);
        return null;
      }

      return globalSettings;
    },
  });
}

/**
 * Check if current user is a manager who can approve quotes.
 * Checks user role and FSM team profile roles.
 */
export function useIsQuoteApprover() {
  return useQuery({
    queryKey: ['current_user_is_approver'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check user_profiles for admin/sales_manager role
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'admin' || profile?.role === 'sales_manager') {
        return true;
      }

      // Check FSM team profile for sales_manager role
      const { data: fsmProfile } = await supabase
        .from('fsm_team_profiles')
        .select('fsm_roles')
        .eq('user_id', user.id)
        .single();

      if (fsmProfile?.fsm_roles?.includes('sales_manager')) {
        return true;
      }

      return false;
    },
  });
}

/**
 * Request manager approval for a quote.
 * Sets approval_requested_at and changes status to pending_manager_approval.
 */
export function useRequestManagerApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('quotes')
        .update({
          approval_requested_at: new Date().toISOString(),
          approval_requested_by: user?.id || null,
          manager_approval_notes: notes || null,
          // Status will be computed by trigger
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess('Quote sent for manager approval');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to request approval');
    },
  });
}

/**
 * Manager approves a quote.
 * Sets manager_approved_at and clears manager_rejected_at.
 */
export function useManagerApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('quotes')
        .update({
          manager_approved_at: new Date().toISOString(),
          manager_approved_by: user?.id || null,
          manager_rejected_at: null,  // Clear any previous rejection
          manager_approval_notes: notes || null,
          requires_approval: false,  // Mark as no longer requiring approval
          // Status will be computed - back to draft (now sendable)
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess('Quote approved - ready to send to client');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to approve quote');
    },
  });
}

/**
 * Manager rejects a quote.
 * Sets manager_rejected_at and returns quote to draft status.
 */
export function useManagerRejectQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('quotes')
        .update({
          manager_rejected_at: new Date().toISOString(),
          manager_approved_by: user?.id || null,  // Track who rejected
          manager_approved_at: null,  // Clear any previous approval
          approval_requested_at: null,  // Clear request so it goes back to draft
          manager_approval_notes: notes || null,
          // Status will be computed - back to draft
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess('Quote rejected - returned to rep for revision');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to reject quote');
    },
  });
}
