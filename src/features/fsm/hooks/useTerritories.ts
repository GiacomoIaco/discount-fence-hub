import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Territory, TerritoryFormData } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

export function useTerritories() {
  return useQuery({
    queryKey: ['territories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*, business_unit:business_units(id, name, code)')
        .order('name');

      if (error) throw error;
      return data as (Territory & { business_unit: { id: string; name: string; code: string } | null })[];
    },
  });
}

export function useTerritory(id: string | undefined) {
  return useQuery({
    queryKey: ['territories', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('territories')
        .select('*, business_unit:business_units(id, name, code)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Territory & { business_unit: { id: string; name: string; code: string } | null };
    },
    enabled: !!id,
  });
}

export function useCreateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TerritoryFormData) => {
      const zipCodes = data.zip_codes
        .split(',')
        .map(z => z.trim())
        .filter(z => z.length > 0);

      const { data: result, error } = await supabase
        .from('territories')
        .insert({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          zip_codes: zipCodes,
          business_unit_id: data.business_unit_id || null,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      showSuccess('Territory created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create territory');
    },
  });
}

export function useUpdateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TerritoryFormData }) => {
      const zipCodes = data.zip_codes
        .split(',')
        .map(z => z.trim())
        .filter(z => z.length > 0);

      const { error } = await supabase
        .from('territories')
        .update({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          zip_codes: zipCodes,
          business_unit_id: data.business_unit_id || null,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      showSuccess('Territory updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update territory');
    },
  });
}

export function useDeleteTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('territories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      showSuccess('Territory deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete territory');
    },
  });
}
