import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { RepUser } from '../types';

/**
 * Fetch all users who can act as sales reps.
 *
 * Queries fsm_team_profiles where fsm_roles contains 'rep',
 * joined to user_profiles for display data.
 */
export function useSalesReps() {
  return useQuery({
    queryKey: ['sales_reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fsm_team_profiles')
        .select('user_id, user_profiles!inner(id, full_name, email, phone)')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (error) throw error;

      const reps: RepUser[] = (data || []).map((row: any) => ({
        id: row.user_id,
        name: row.user_profiles?.full_name || row.user_profiles?.email || 'Unknown',
        full_name: row.user_profiles?.full_name,
        email: row.user_profiles?.email,
        phone: row.user_profiles?.phone,
      }));

      return reps.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/**
 * Fetch a single rep by user ID
 */
export function useSalesRep(id: string | undefined) {
  return useQuery({
    queryKey: ['sales_reps', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .eq('id', id)
        .single();

      if (error) throw error;

      const rep: RepUser = {
        id: data.id,
        name: data.full_name || data.email || 'Unknown',
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
      };

      return rep;
    },
    enabled: !!id,
  });
}

/**
 * Helper to get available reps for assignment.
 *
 * Filters by territory using fsm_territory_coverage.
 * Product type filtering is handled by fsm_person_skills.
 */
export function useAvailableSalesReps(territoryId?: string, productType?: string) {
  return useQuery({
    queryKey: ['sales_reps', 'available', territoryId, productType],
    queryFn: async () => {
      // Start with FSM team profiles that have 'rep' role
      const { data: teamProfiles, error: teamError } = await supabase
        .from('fsm_team_profiles')
        .select('user_id')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (teamError) throw teamError;

      let eligibleUserIds = new Set((teamProfiles || []).map(p => p.user_id));

      // Filter by territory if specified
      if (territoryId) {
        const { data: coverage, error: coverageError } = await supabase
          .from('fsm_territory_coverage')
          .select('user_id')
          .eq('territory_id', territoryId);

        if (coverageError) throw coverageError;

        const territoryUserIds = new Set((coverage || []).map(c => c.user_id));
        eligibleUserIds = new Set([...eligibleUserIds].filter(id => territoryUserIds.has(id)));
      }

      // Filter by product type/skill if specified
      if (productType) {
        const { data: skills, error: skillsError } = await supabase
          .from('fsm_person_skills')
          .select('user_id')
          .eq('skill_name', productType);

        if (skillsError) throw skillsError;

        const skillUserIds = new Set((skills || []).map(s => s.user_id));
        eligibleUserIds = new Set([...eligibleUserIds].filter(id => skillUserIds.has(id)));
      }

      if (eligibleUserIds.size === 0) return [] as RepUser[];

      // Fetch user profiles
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', Array.from(eligibleUserIds));

      if (usersError) throw usersError;

      const reps: RepUser[] = (users || []).map(u => ({
        id: u.id,
        name: u.full_name || u.email || 'Unknown',
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
      }));

      return reps.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/**
 * Fetch reps filtered by QBO Class (Business Unit).
 *
 * Uses fsm_team_profiles.assigned_qbo_class_ids to filter.
 * When no qboClassId is provided, returns all reps.
 */
export function useRepsByQboClass(qboClassId?: string | null) {
  return useQuery({
    queryKey: ['sales_reps', 'by_qbo_class', qboClassId],
    queryFn: async () => {
      // Fetch FSM team profiles with 'rep' role
      const { data: teamProfiles, error: teamError } = await supabase
        .from('fsm_team_profiles')
        .select('user_id, assigned_qbo_class_ids')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (teamError) throw teamError;

      // Filter by QBO class if specified
      let eligibleUserIds: string[];
      if (qboClassId) {
        eligibleUserIds = (teamProfiles || [])
          .filter(p => (p.assigned_qbo_class_ids || []).includes(qboClassId))
          .map(p => p.user_id);
      } else {
        eligibleUserIds = (teamProfiles || []).map(p => p.user_id);
      }

      if (eligibleUserIds.length === 0) return [] as RepUser[];

      // Fetch user profiles
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', eligibleUserIds);

      if (usersError) throw usersError;

      const reps: RepUser[] = (users || []).map(u => ({
        id: u.id,
        name: u.full_name || u.email || 'Unknown',
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        is_active: true,
      }));

      return reps.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
