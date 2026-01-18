// Salesperson configuration hooks for managing comparison groups
// Tracks which salespeople should be included in team averages

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../../lib/supabase';

export interface SalespersonConfig {
  id: string;
  salesperson_name: string;
  is_comparison_group: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all salesperson configs
export function useSalespersonConfigs() {
  return useQuery({
    queryKey: ['residential-salesperson-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residential_salesperson_config')
        .select('*')
        .order('salesperson_name');

      if (error) {
        throw new Error(`Failed to fetch salesperson configs: ${error.message}`);
      }

      return (data || []) as SalespersonConfig[];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Get only the comparison group members
export function useComparisonGroup() {
  return useQuery({
    queryKey: ['residential-comparison-group'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residential_salesperson_config')
        .select('salesperson_name')
        .eq('is_comparison_group', true);

      if (error) {
        throw new Error(`Failed to fetch comparison group: ${error.message}`);
      }

      return (data || []).map((r) => r.salesperson_name);
    },
    staleTime: 60 * 1000,
  });
}

// Update a salesperson's config
export function useUpdateSalespersonConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      salesperson_name,
      updates,
    }: {
      salesperson_name: string;
      updates: Partial<Pick<SalespersonConfig, 'is_comparison_group' | 'is_active' | 'notes'>>;
    }) => {
      const { data, error } = await supabase
        .from('residential_salesperson_config')
        .update(updates)
        .eq('salesperson_name', salesperson_name)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update salesperson config: ${error.message}`);
      }

      return data as SalespersonConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residential-salesperson-configs'] });
      queryClient.invalidateQueries({ queryKey: ['residential-comparison-group'] });
    },
  });
}

// Batch update comparison group (set multiple at once)
export function useBatchUpdateComparisonGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (salespersonNames: string[]) => {
      // First, set all to false
      const { error: resetError } = await supabase
        .from('residential_salesperson_config')
        .update({ is_comparison_group: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

      if (resetError) {
        throw new Error(`Failed to reset comparison group: ${resetError.message}`);
      }

      // Then set the selected ones to true
      if (salespersonNames.length > 0) {
        const { error: updateError } = await supabase
          .from('residential_salesperson_config')
          .update({ is_comparison_group: true })
          .in('salesperson_name', salespersonNames);

        if (updateError) {
          throw new Error(`Failed to update comparison group: ${updateError.message}`);
        }
      }

      return salespersonNames;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residential-salesperson-configs'] });
      queryClient.invalidateQueries({ queryKey: ['residential-comparison-group'] });
      // Also invalidate metrics that depend on comparison group
      queryClient.invalidateQueries({ queryKey: ['jobber-residential-salesperson-metrics'] });
    },
  });
}

// Insert a new salesperson config (if they're not already tracked)
export function useInsertSalespersonConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      salesperson_name: string;
      is_comparison_group?: boolean;
      is_active?: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('residential_salesperson_config')
        .insert({
          salesperson_name: config.salesperson_name,
          is_comparison_group: config.is_comparison_group ?? false,
          is_active: config.is_active ?? true,
          notes: config.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert salesperson config: ${error.message}`);
      }

      return data as SalespersonConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residential-salesperson-configs'] });
      queryClient.invalidateQueries({ queryKey: ['residential-comparison-group'] });
    },
  });
}
