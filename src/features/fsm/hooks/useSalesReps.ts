import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { RepUser } from '../types';

/**
 * Fetch all users who can act as sales reps.
 *
 * This includes:
 * 1. Users with role='Sales' in user_profiles
 * 2. Users with fsm_team_profiles containing 'rep' role
 *
 * Returns RepUser[] - the standard user representation.
 */
export function useSalesReps() {
  return useQuery({
    queryKey: ['sales_reps'],
    queryFn: async () => {
      // Fetch users with Sales role
      const { data: salesUsers, error: salesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, role')
        .eq('role', 'Sales');

      if (salesError) throw salesError;

      // Fetch FSM team profiles with 'rep' role
      const { data: teamProfiles, error: teamError } = await supabase
        .from('fsm_team_profiles')
        .select('user_id')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (teamError) throw teamError;

      // Collect all user IDs that qualify as reps
      const repUserIds = new Set<string>();

      // Add Sales users
      (salesUsers || []).forEach(u => repUserIds.add(u.id));

      // Add FSM team reps
      (teamProfiles || []).forEach(p => repUserIds.add(p.user_id));

      // If we have FSM team reps that aren't Sales users, fetch their profiles
      const fsmOnlyUserIds = (teamProfiles || [])
        .filter(p => !(salesUsers || []).some(u => u.id === p.user_id))
        .map(p => p.user_id);

      let allUsers = salesUsers || [];

      if (fsmOnlyUserIds.length > 0) {
        const { data: fsmUsers, error: fsmError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, phone, role')
          .in('id', fsmOnlyUserIds);

        if (fsmError) throw fsmError;
        allUsers = [...allUsers, ...(fsmUsers || [])];
      }

      // Transform to RepUser structure
      const reps: RepUser[] = allUsers.map(u => ({
        id: u.id,
        name: u.full_name || u.email || 'Unknown',
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
      }));

      // Sort by name
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
        .select('id, full_name, email, phone, role')
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
      // Get all reps first
      const { data: salesUsers, error: salesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, role')
        .eq('role', 'Sales');

      if (salesError) throw salesError;

      const { data: teamProfiles, error: teamError } = await supabase
        .from('fsm_team_profiles')
        .select('user_id')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (teamError) throw teamError;

      // Collect all rep user IDs
      const repUserIds = new Set<string>();
      (salesUsers || []).forEach(u => repUserIds.add(u.id));
      (teamProfiles || []).forEach(p => repUserIds.add(p.user_id));

      // Get FSM-only users
      const fsmOnlyUserIds = (teamProfiles || [])
        .filter(p => !(salesUsers || []).some(u => u.id === p.user_id))
        .map(p => p.user_id);

      let allUsers = salesUsers || [];

      if (fsmOnlyUserIds.length > 0) {
        const { data: fsmUsers, error: fsmError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, phone, role')
          .in('id', fsmOnlyUserIds);

        if (fsmError) throw fsmError;
        allUsers = [...allUsers, ...(fsmUsers || [])];
      }

      // Filter by territory if specified
      let filteredUserIds = new Set(allUsers.map(u => u.id));

      if (territoryId) {
        const { data: coverage, error: coverageError } = await supabase
          .from('fsm_territory_coverage')
          .select('user_id')
          .eq('territory_id', territoryId);

        if (coverageError) throw coverageError;

        const territoryUserIds = new Set((coverage || []).map(c => c.user_id));
        filteredUserIds = new Set([...filteredUserIds].filter(id => territoryUserIds.has(id)));
      }

      // Filter by product type/skill if specified
      if (productType) {
        const { data: skills, error: skillsError } = await supabase
          .from('fsm_person_skills')
          .select('user_id')
          .eq('skill_name', productType);

        if (skillsError) throw skillsError;

        const skillUserIds = new Set((skills || []).map(s => s.user_id));
        filteredUserIds = new Set([...filteredUserIds].filter(id => skillUserIds.has(id)));
      }

      // Transform to RepUser structure
      const reps: RepUser[] = allUsers
        .filter(u => filteredUserIds.has(u.id))
        .map(u => ({
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
      // First get FSM team profiles with 'rep' role
      let teamQuery = supabase
        .from('fsm_team_profiles')
        .select('user_id, assigned_qbo_class_ids')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      const { data: teamProfiles, error: teamError } = await teamQuery;
      if (teamError) throw teamError;

      // Filter by QBO class if specified
      let eligibleUserIds: string[];
      if (qboClassId) {
        // Filter to profiles that have this QBO class assigned
        eligibleUserIds = (teamProfiles || [])
          .filter(p => {
            const assignedClasses = p.assigned_qbo_class_ids || [];
            return assignedClasses.includes(qboClassId);
          })
          .map(p => p.user_id);
      } else {
        // No filter, return all rep users
        eligibleUserIds = (teamProfiles || []).map(p => p.user_id);
      }

      // Also include Sales users that might not have FSM profiles
      const { data: salesUsers, error: salesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, role')
        .eq('role', 'Sales');

      if (salesError) throw salesError;

      // Combine: FSM reps (filtered by BU) + Sales users
      const allUserIds = new Set([
        ...eligibleUserIds,
        ...(salesUsers || []).map(u => u.id),
      ]);

      // If QBO filter is active, remove Sales users not in filtered set
      // Actually, if no QBO class assigned to sales user, we might want to include them
      // For now, include all Sales users plus filtered FSM team members

      // Fetch user profiles for all
      if (allUserIds.size === 0) {
        return [] as RepUser[];
      }

      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', Array.from(allUserIds));

      if (usersError) throw usersError;

      // Transform to RepUser structure
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

// Note: Create/Update/Delete mutations removed - use FSM Team Management instead
// Manage reps through Settings > Team Management.
