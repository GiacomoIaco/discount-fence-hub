import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Crew, CrewMember, CrewFormData } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

export function useCrews() {
  return useQuery({
    queryKey: ['crews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews')
        .select(`
          *,
          territory:territories(id, name, code),
          business_unit:business_units(id, name, code),
          members:crew_members(*)
        `)
        .order('name');

      if (error) throw error;
      return data as (Crew & {
        territory: { id: string; name: string; code: string } | null;
        business_unit: { id: string; name: string; code: string } | null;
        members: CrewMember[];
      })[];
    },
  });
}

export function useCrew(id: string | undefined) {
  return useQuery({
    queryKey: ['crews', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('crews')
        .select(`
          *,
          territory:territories(id, name, code),
          business_unit:business_units(id, name, code),
          members:crew_members(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Crew & {
        territory: { id: string; name: string; code: string } | null;
        business_unit: { id: string; name: string; code: string } | null;
        members: CrewMember[];
      };
    },
    enabled: !!id,
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CrewFormData) => {
      const { data: result, error } = await supabase
        .from('crews')
        .insert({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          crew_size: data.crew_size,
          max_daily_lf: data.max_daily_lf,
          product_skills: data.product_skills,
          business_unit_id: data.business_unit_id || null,
          home_territory_id: data.home_territory_id || null,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Crew created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create crew');
    },
  });
}

export function useUpdateCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CrewFormData }) => {
      const { error } = await supabase
        .from('crews')
        .update({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          crew_size: data.crew_size,
          max_daily_lf: data.max_daily_lf,
          product_skills: data.product_skills,
          business_unit_id: data.business_unit_id || null,
          home_territory_id: data.home_territory_id || null,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Crew updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update crew');
    },
  });
}

export function useDeleteCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crews')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Crew deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete crew');
    },
  });
}

// Crew members management
export function useAddCrewMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      crewId,
      data,
    }: {
      crewId: string;
      data: { name: string; phone?: string; user_id?: string; is_lead?: boolean };
    }) => {
      const { error } = await supabase
        .from('crew_members')
        .insert({
          crew_id: crewId,
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          user_id: data.user_id || null,
          is_lead: data.is_lead || false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Crew member added');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add crew member');
    },
  });
}

export function useRemoveCrewMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('crew_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Crew member removed');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to remove crew member');
    },
  });
}
