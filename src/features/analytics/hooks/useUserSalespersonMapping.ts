/**
 * Hook to manage user-salesperson mapping for analytics filtering
 * Auto-matches users to their salesperson name in Jobber data
 *
 * @deprecated The `user_salesperson_mapping` table is deprecated.
 * New code should use `fsm_team_profiles.jobber_salesperson_names` instead.
 * Legacy hooks (useUserSalespersonMapping, useAllSalespersonMappings,
 * useUpdateSalespersonMapping, useDeleteSalespersonMapping) remain for
 * backward compatibility with UserSalespersonMappingAdmin.tsx.
 * Use useFsmSalespersonNames() and useAnalyticsFilter() for new code.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { usePermission } from '../../../contexts/PermissionContext';

interface SalespersonMapping {
  id: string;
  user_id: string;
  salesperson_name: string;
  match_type: 'exact' | 'fuzzy' | 'manual';
  match_confidence: number;
  is_verified: boolean;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

interface SalespersonMappingWithProfile extends SalespersonMapping {
  profiles?: {
    full_name: string;
    email: string;
    role: string;
  };
}

/**
 * Get the current user's salesperson mapping
 */
export function useUserSalespersonMapping() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user_salesperson_mapping', user?.id],
    queryFn: async (): Promise<SalespersonMapping | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_salesperson_mapping')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching salesperson mapping:', error);
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get all salesperson mappings (admin only)
 */
export function useAllSalespersonMappings() {
  return useQuery({
    queryKey: ['all_salesperson_mappings'],
    queryFn: async (): Promise<SalespersonMappingWithProfile[]> => {
      const { data, error } = await supabase
        .from('user_salesperson_mapping')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all mappings:', error);
        throw error;
      }

      return data || [];
    },
    staleTime: 60000,
  });
}

/**
 * Get list of salespeople who are in the comparison group
 * Used by MobileAnalyticsView for the "view as" dropdown
 */
export function useDistinctSalespeople() {
  return useQuery({
    queryKey: ['distinct_salespeople_comparison_group'],
    queryFn: async (): Promise<string[]> => {
      // Query from residential_salesperson_config where is_comparison_group = true
      const { data, error } = await supabase
        .from('residential_salesperson_config')
        .select('salesperson_name')
        .eq('is_comparison_group', true)
        .order('salesperson_name');

      if (error) {
        console.error('Error fetching comparison group salespeople:', error);
        return [];
      }

      return data?.map(d => d.salesperson_name).filter(Boolean) || [];
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get list of ALL salespeople from both Residential and Builder Jobber accounts
 * Used by the admin mapping UI to link users to any salesperson
 * Deduplicates by name (same person may appear in both)
 */
export function useAllJobberSalespeople() {
  return useQuery({
    queryKey: ['all_jobber_salespeople'],
    queryFn: async (): Promise<string[]> => {
      // Query from both residential and builder tables in parallel
      const [residentialResult, builderResult] = await Promise.all([
        // Residential: from opportunities table
        supabase
          .from('jobber_residential_opportunities')
          .select('salesperson')
          .not('salesperson', 'is', null)
          .neq('salesperson', ''),
        // Builder: from jobs table
        supabase
          .from('jobber_builder_jobs')
          .select('effective_salesperson')
          .not('effective_salesperson', 'is', null)
          .neq('effective_salesperson', ''),
      ]);

      const allNames: string[] = [];

      // Add residential salespeople
      if (!residentialResult.error && residentialResult.data) {
        residentialResult.data.forEach(d => {
          if (d.salesperson) allNames.push(d.salesperson);
        });
      }

      // Add builder salespeople
      if (!builderResult.error && builderResult.data) {
        builderResult.data.forEach(d => {
          if (d.effective_salesperson) allNames.push(d.effective_salesperson);
        });
      }

      // Deduplicate and sort
      const unique = [...new Set(allNames)].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      return unique;
    },
    staleTime: 300000, // Cache for 5 minutes
  });
}

/**
 * Create or update a salesperson mapping (admin)
 */
export function useUpdateSalespersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      salespersonName,
      isVerified = false,
    }: {
      userId: string;
      salespersonName: string;
      isVerified?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('user_salesperson_mapping')
        .upsert({
          user_id: userId,
          salesperson_name: salespersonName,
          match_type: 'manual',
          match_confidence: 1.0,
          is_verified: isVerified,
          verified_by: isVerified ? user?.id : null,
          verified_at: isVerified ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_salesperson_mapping'] });
      queryClient.invalidateQueries({ queryKey: ['all_salesperson_mappings'] });
    },
  });
}

/**
 * Delete a salesperson mapping (admin)
 */
export function useDeleteSalespersonMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_salesperson_mapping')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_salesperson_mapping'] });
      queryClient.invalidateQueries({ queryKey: ['all_salesperson_mappings'] });
    },
  });
}

/**
 * Get Jobber salesperson names from fsm_team_profiles (new source of truth)
 */
export function useFsmSalespersonNames() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['fsm_salesperson_names', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('fsm_team_profiles')
        .select('jobber_salesperson_names')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching FSM salesperson names:', error);
      }

      return data?.jobber_salesperson_names || [];
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });
}

/**
 * Hook to determine if user should see filtered analytics
 * Returns the salesperson name to filter by, or null for admin full access
 *
 * Reads from fsm_team_profiles.jobber_salesperson_names (source of truth).
 */
export function useAnalyticsFilter() {
  const { hasPermission } = usePermission();
  const { data: fsmNames, isLoading } = useFsmSalespersonNames();

  const isAdmin = hasPermission('view_analytics');

  // FSM team profiles is the source of truth for salesperson names
  const salespersonName = fsmNames?.[0] || null;

  return {
    // Non-admins get filtered, admins see all
    salespersonFilter: isAdmin ? null : salespersonName,
    // True if user has no mapping and is not admin
    requiresSetup: !isAdmin && !salespersonName && !isLoading,
    // Admin can choose to view as any salesperson
    isAdmin,
    isLoading,
  };
}
