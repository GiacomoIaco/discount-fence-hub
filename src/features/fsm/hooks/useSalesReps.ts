import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { SalesRep, SalesRepFormData } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

export function useSalesReps() {
  return useQuery({
    queryKey: ['sales_reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as SalesRep[];
    },
  });
}

export function useSalesRep(id: string | undefined) {
  return useQuery({
    queryKey: ['sales_reps', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as SalesRep;
    },
    enabled: !!id,
  });
}

export function useCreateSalesRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SalesRepFormData) => {
      const { data: result, error } = await supabase
        .from('sales_reps')
        .insert({
          name: data.name.trim(),
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          user_id: data.user_id || null,
          territory_ids: data.territory_ids,
          product_skills: data.product_skills,
          max_daily_assessments: data.max_daily_assessments,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] });
      showSuccess('Sales rep created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create sales rep');
    },
  });
}

export function useUpdateSalesRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SalesRepFormData }) => {
      const { error } = await supabase
        .from('sales_reps')
        .update({
          name: data.name.trim(),
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          user_id: data.user_id || null,
          territory_ids: data.territory_ids,
          product_skills: data.product_skills,
          max_daily_assessments: data.max_daily_assessments,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] });
      showSuccess('Sales rep updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update sales rep');
    },
  });
}

export function useDeleteSalesRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales_reps')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_reps'] });
      showSuccess('Sales rep deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete sales rep');
    },
  });
}

// Helper to get available reps for assignment
export function useAvailableSalesReps(territoryId?: string, productType?: string) {
  return useQuery({
    queryKey: ['sales_reps', 'available', territoryId, productType],
    queryFn: async () => {
      let query = supabase
        .from('sales_reps')
        .select('*')
        .eq('is_active', true);

      const { data, error } = await query.order('name');

      if (error) throw error;

      // Filter by territory and skill in JS (Postgres array contains is tricky)
      let filtered = data as SalesRep[];

      if (territoryId) {
        filtered = filtered.filter(rep => rep.territory_ids.includes(territoryId));
      }

      if (productType) {
        filtered = filtered.filter(rep => rep.product_skills.includes(productType));
      }

      return filtered;
    },
  });
}
