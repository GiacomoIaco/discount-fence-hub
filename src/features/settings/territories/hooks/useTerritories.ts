import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type {
  Territory,
  TerritoryWithReps,
  TerritoryFormData,
  BusinessUnit,
} from '../types/territory.types';
import type { RepUser } from '../../../fsm/types';

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
export function useTerritories(businessUnitId?: string) {
  return useQuery({
    queryKey: ['territories', businessUnitId],
    queryFn: async () => {
      let query = supabase
        .from('territories_with_reps')
        .select('*')
        .order('name');

      if (businessUnitId) {
        query = query.eq('business_unit_id', businessUnitId);
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

// User profile type for join
interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

// Fetch team members who can be assigned to territories (from FSM team profiles)
export function useSalesReps() {
  return useQuery({
    queryKey: ['territory-assignable-reps'],
    queryFn: async () => {
      // Fetch FSM team profiles that have 'rep' role
      const { data: profiles, error: profileError } = await supabase
        .from('fsm_team_profiles')
        .select('user_id, fsm_roles')
        .eq('is_active', true)
        .contains('fsm_roles', ['rep']);

      if (profileError) throw profileError;
      if (!profiles || profiles.length === 0) return [];

      // Fetch user profiles for these team members
      const userIds = profiles.map(p => p.user_id);
      const { data: users, error: userError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .in('id', userIds);

      if (userError) throw userError;

      // Create a map of user_id to user profile
      const userMap = new Map<string, UserProfile>();
      (users || []).forEach(u => userMap.set(u.id, u));

      // Transform to RepUser structure
      const reps: RepUser[] = profiles
        .map(p => {
          const user = userMap.get(p.user_id);
          const name = user?.full_name || user?.email || 'Unknown';
          return {
            id: p.user_id,
            name,
            full_name: user?.full_name || null,
            email: user?.email || '',
            phone: user?.phone || null,
          };
        })
        .filter(r => r.name !== 'Unknown'); // Filter out any without user profiles

      return reps.sort((a, b) => a.name.localeCompare(b.name));
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

// Assign rep to territory (uses FSM territory coverage)
export function useAssignRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      territoryId,
      salesRepId, // This is now user_id from user_profiles
      isPrimary = false
    }: {
      territoryId: string;
      salesRepId: string;
      isPrimary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('fsm_territory_coverage')
        .upsert({
          territory_id: territoryId,
          user_id: salesRepId,
          is_primary: isPrimary,
        }, {
          onConflict: 'user_id,territory_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['fsm-team-profiles'] });
    },
  });
}

// Remove rep from territory (uses FSM territory coverage)
export function useUnassignRep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      territoryId,
      salesRepId // This is now user_id from user_profiles
    }: {
      territoryId: string;
      salesRepId: string;
    }) => {
      const { error } = await supabase
        .from('fsm_territory_coverage')
        .delete()
        .eq('territory_id', territoryId)
        .eq('user_id', salesRepId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['territories'] });
      queryClient.invalidateQueries({ queryKey: ['fsm-team-profiles'] });
    },
  });
}
