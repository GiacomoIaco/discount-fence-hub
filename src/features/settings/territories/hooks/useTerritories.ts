import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type {
  Territory,
  TerritoryWithReps,
  TerritoryFormData,
  TerritoryAssignment,
  BusinessUnit,
  SalesRep
} from '../types/territory.types';

// Location type
export interface Location {
  id: string;
  code: string;
  name: string;
  state: string;
  is_active: boolean;
}

// Fetch all locations
export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Location[];
    },
  });
}

// Fetch all territories with assigned reps
export function useTerritories(locationCode?: string) {
  return useQuery({
    queryKey: ['territories', locationCode],
    queryFn: async () => {
      let query = supabase
        .from('territories_with_reps')
        .select('*')
        .order('name');

      if (locationCode) {
        query = query.eq('location_code', locationCode);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TerritoryWithReps[];
    },
  });
}

// Fetch a single territory
export function useTerritory(id: string) {
  return useQuery({
    queryKey: ['territory', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Territory;
    },
    enabled: !!id,
  });
}

// Fetch business units
export function useBusinessUnits() {
  return useQuery({
    queryKey: ['business-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as BusinessUnit[];
    },
  });
}

// Fetch sales reps
export function useSalesReps() {
  return useQuery({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_reps')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as SalesRep[];
    },
  });
}

// Create territory
export function useCreateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (territory: TerritoryFormData) => {
      const { data, error } = await supabase
        .from('territories')
        .insert({
          name: territory.name,
          code: territory.code,
          business_unit_id: territory.business_unit_id,
          location_code: territory.location_code,
          disabled_qbo_class_ids: territory.disabled_qbo_class_ids || [],
          color: territory.color,
          description: territory.description || null,
          geometry: territory.geometry,
          zip_codes: territory.zip_codes,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Territory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
    },
  });
}

// Update territory
export function useUpdateTerritory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...territory }: TerritoryFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('territories')
        .update({
          name: territory.name,
          code: territory.code,
          business_unit_id: territory.business_unit_id,
          location_code: territory.location_code,
          disabled_qbo_class_ids: territory.disabled_qbo_class_ids || [],
          color: territory.color,
          description: territory.description || null,
          geometry: territory.geometry,
          zip_codes: territory.zip_codes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Territory;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['territory', data.id] });
    },
  });
}

// Delete territory
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
    },
  });
}

// Assign sales rep to territory
export function useAssignRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      territoryId,
      salesRepId,
      isPrimary = true
    }: {
      territoryId: string;
      salesRepId: string;
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('territory_assignments')
        .upsert({
          territory_id: territoryId,
          sales_rep_id: salesRepId,
          is_primary: isPrimary,
        }, {
          onConflict: 'territory_id,sales_rep_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as TerritoryAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
    },
  });
}

// Remove sales rep from territory
export function useUnassignRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      territoryId,
      salesRepId
    }: {
      territoryId: string;
      salesRepId: string;
    }) => {
      const { error } = await supabase
        .from('territory_assignments')
        .delete()
        .eq('territory_id', territoryId)
        .eq('sales_rep_id', salesRepId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
    },
  });
}
