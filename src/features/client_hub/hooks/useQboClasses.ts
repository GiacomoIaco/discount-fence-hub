import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { QboClass } from '../types';

// ============================================
// QBO CLASSES - Synced from QuickBooks
// ============================================

/**
 * Get all QBO classes from local cache
 * @param onlySelectable - If true, only return classes marked as selectable
 */
export function useQboClasses(onlySelectable = false) {
  return useQuery({
    queryKey: ['qbo-classes', onlySelectable],
    queryFn: async () => {
      let query = supabase
        .from('qbo_classes')
        .select('*')
        .eq('is_active', true)
        .order('fully_qualified_name');

      if (onlySelectable) {
        query = query.eq('is_selectable', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QboClass[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Sync classes from QBO API to local database
 */
export function useSyncQboClasses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/.netlify/functions/qbo-sync-classes');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['qbo-classes'] });
      showSuccess(`Synced ${result.stats.fetched} classes (${result.stats.created} new, ${result.stats.updated} updated)`);
    },
    onError: (error: Error) => {
      showError(`Sync failed: ${error.message}`);
    },
  });
}

/**
 * Toggle whether a class appears in selection dropdowns
 */
export function useUpdateQboClassSelectable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isSelectable }: { id: string; isSelectable: boolean }) => {
      const { data, error } = await supabase
        .from('qbo_classes')
        .update({ is_selectable: isSelectable })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qbo-classes'] });
    },
    onError: (error: Error) => {
      showError(`Failed to update: ${error.message}`);
    },
  });
}

/**
 * Get a single QBO class by ID
 */
export function useQboClass(id: string | null) {
  return useQuery({
    queryKey: ['qbo-class', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('qbo_classes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as QboClass;
    },
    enabled: !!id,
  });
}
