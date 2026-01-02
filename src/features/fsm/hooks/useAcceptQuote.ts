import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Quote, QuoteAcceptanceStatus } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

/**
 * Accept a quote - marks quote as accepted and supersedes other pending quotes
 * in the same project
 */
export function useAcceptQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId }: { quoteId: string }) => {
      // Try to use the database function first (if migration 203 applied)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_quote', {
        p_quote_id: quoteId,
      });

      if (rpcError) {
        // If function doesn't exist, fall back to manual update
        if (rpcError.code === '42883') {
          console.warn('accept_quote function not found, using manual update');

          // Get the quote's project_id
          const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('id, project_id')
            .eq('id', quoteId)
            .single();

          if (quoteError) throw quoteError;

          // Update the quote to accepted
          const { error: updateError } = await supabase
            .from('quotes')
            .update({
              acceptance_status: 'accepted' as QuoteAcceptanceStatus,
              accepted_at: new Date().toISOString(),
            })
            .eq('id', quoteId);

          if (updateError) throw updateError;

          // If there's a project, supersede other pending quotes
          if (quote.project_id) {
            await supabase
              .from('quotes')
              .update({
                acceptance_status: 'superseded' as QuoteAcceptanceStatus,
                superseded_by_quote_id: quoteId,
              })
              .eq('project_id', quote.project_id)
              .neq('id', quoteId)
              .eq('acceptance_status', 'pending');

            // Update project with accepted_quote_id
            await supabase
              .from('projects')
              .update({ accepted_quote_id: quoteId })
              .eq('id', quote.project_id);
          }

          return { success: true };
        }
        throw rpcError;
      }

      return rpcResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project_full'] });
      showSuccess('Quote accepted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to accept quote');
    },
  });
}

/**
 * Decline a quote with optional reason
 */
export function useDeclineQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quoteId,
      reason,
    }: {
      quoteId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('quotes')
        .update({
          acceptance_status: 'declined' as QuoteAcceptanceStatus,
          declined_at: new Date().toISOString(),
          declined_reason: reason || null,
        })
        .eq('id', quoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess('Quote declined');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to decline quote');
    },
  });
}

/**
 * Create a revision of a quote (new version)
 */
export function useCreateQuoteRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ originalQuoteId }: { originalQuoteId: string }) => {
      // Get the original quote with line items
      const { data: original, error: fetchError } = await supabase
        .from('quotes')
        .select(`
          *,
          line_items:quote_line_items(*)
        `)
        .eq('id', originalQuoteId)
        .single();

      if (fetchError) throw fetchError;

      // Get max version number for this project
      const { data: maxVersion } = await supabase
        .from('quotes')
        .select('version_number')
        .eq('project_id', original.project_id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const newVersion = (maxVersion?.version_number || 1) + 1;

      // Create new quote (copy of original)
      const { data: newQuote, error: insertError } = await supabase
        .from('quotes')
        .insert({
          // Copy most fields from original
          project_id: original.project_id,
          client_id: original.client_id,
          property_id: original.property_id,
          community_id: original.community_id,
          qbo_class_id: original.qbo_class_id,
          sales_rep_user_id: original.sales_rep_user_id,
          product_type: original.product_type,
          linear_feet: original.linear_feet,
          subtotal: original.subtotal,
          tax_amount: original.tax_amount,
          discount_amount: original.discount_amount,
          total: original.total,
          deposit_required: original.deposit_required,
          notes: original.notes,
          internal_notes: original.internal_notes,
          // Set version tracking
          version_number: newVersion,
          is_revision_of_quote_id: originalQuoteId,
          acceptance_status: 'pending',
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Copy line items
      if (original.line_items && original.line_items.length > 0) {
        const lineItemsCopy = original.line_items.map((item: Record<string, unknown>) => ({
          quote_id: newQuote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          sku_id: item.sku_id,
          sku_code: item.sku_code,
          product_type: item.product_type,
          sort_order: item.sort_order,
        }));

        const { error: lineItemsError } = await supabase
          .from('quote_line_items')
          .insert(lineItemsCopy);

        if (lineItemsError) {
          // Rollback: delete the new quote
          await supabase.from('quotes').delete().eq('id', newQuote.id);
          throw lineItemsError;
        }
      }

      // Mark original as superseded
      await supabase
        .from('quotes')
        .update({
          superseded_by_quote_id: newQuote.id,
          acceptance_status: 'superseded',
        })
        .eq('id', originalQuoteId);

      return newQuote as Quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['project_quotes'] });
      showSuccess('Quote revision created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create quote revision');
    },
  });
}
