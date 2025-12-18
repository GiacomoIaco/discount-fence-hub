import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Crew, CrewMember, CrewFormData, RepCrewAlignment } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

export function useCrews() {
  return useQuery({
    queryKey: ['crews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Crew[];
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
          crew_type: data.crew_type || 'standard',
          lead_user_id: data.lead_user_id || null,
          is_active: data.is_active,
          // Subcontractor fields
          is_subcontractor: data.is_subcontractor || false,
          lead_name: data.lead_name?.trim() || null,
          lead_phone: data.lead_phone?.trim() || null,
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
          crew_type: data.crew_type || 'standard',
          lead_user_id: data.lead_user_id || null,
          is_active: data.is_active,
          // Subcontractor fields
          is_subcontractor: data.is_subcontractor || false,
          lead_name: data.lead_name?.trim() || null,
          lead_phone: data.lead_phone?.trim() || null,
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

// ============================================
// REP-CREW ALIGNMENTS
// ============================================

export function useRepCrewAlignments(repUserId?: string) {
  return useQuery({
    queryKey: ['rep_crew_alignments', repUserId],
    queryFn: async () => {
      let query = supabase
        .from('rep_crew_alignments')
        .select(`
          *,
          crew:crews(id, name, code, is_subcontractor, product_skills)
        `)
        .eq('is_active', true);

      if (repUserId) {
        query = query.eq('rep_user_id', repUserId);
      }

      const { data, error } = await query.order('priority');

      if (error) throw error;
      return data as (RepCrewAlignment & {
        crew: { id: string; name: string; code: string; is_subcontractor: boolean; product_skills: string[] };
      })[];
    },
    enabled: repUserId !== undefined,
  });
}

export function useAllRepCrewAlignments() {
  return useQuery({
    queryKey: ['rep_crew_alignments_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rep_crew_alignments')
        .select(`
          *,
          crew:crews(id, name, code, is_subcontractor)
        `)
        .eq('is_active', true)
        .order('priority');

      if (error) throw error;
      return data as (RepCrewAlignment & {
        crew: { id: string; name: string; code: string; is_subcontractor: boolean };
      })[];
    },
  });
}

export function useSetRepCrewAlignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      repUserId,
      crewIds,
    }: {
      repUserId: string;
      crewIds: string[];
    }) => {
      // Delete existing alignments for this rep
      await supabase
        .from('rep_crew_alignments')
        .delete()
        .eq('rep_user_id', repUserId);

      // Insert new alignments
      if (crewIds.length > 0) {
        const { error } = await supabase
          .from('rep_crew_alignments')
          .insert(
            crewIds.map((crewId, idx) => ({
              rep_user_id: repUserId,
              crew_id: crewId,
              priority: idx + 1,
              is_active: true,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments'] });
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments_all'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('Crew alignments updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update crew alignments');
    },
  });
}

export function useAddRepCrewAlignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      repUserId,
      crewId,
      priority,
    }: {
      repUserId: string;
      crewId: string;
      priority?: number;
    }) => {
      const { error } = await supabase
        .from('rep_crew_alignments')
        .insert({
          rep_user_id: repUserId,
          crew_id: crewId,
          priority: priority || 1,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments'] });
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments_all'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add crew alignment');
    },
  });
}

export function useRemoveRepCrewAlignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ repUserId, crewId }: { repUserId: string; crewId: string }) => {
      const { error } = await supabase
        .from('rep_crew_alignments')
        .delete()
        .eq('rep_user_id', repUserId)
        .eq('crew_id', crewId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments'] });
      queryClient.invalidateQueries({ queryKey: ['rep_crew_alignments_all'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to remove crew alignment');
    },
  });
}
