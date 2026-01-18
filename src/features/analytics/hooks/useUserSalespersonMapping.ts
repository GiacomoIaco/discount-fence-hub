/**
 * Hook to manage user-salesperson mapping for analytics filtering
 * Auto-matches users to their salesperson name in Jobber data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

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
 * Get list of distinct salespeople from Jobber data
 */
export function useDistinctSalespeople() {
  return useQuery({
    queryKey: ['distinct_salespeople'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .rpc('get_distinct_salespeople');

      if (error) {
        // Fallback: query directly from jobber_builder_jobs
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('jobber_builder_jobs')
          .select('effective_salesperson')
          .not('effective_salesperson', 'is', null)
          .order('effective_salesperson');

        if (fallbackError) {
          console.error('Error fetching salespeople:', fallbackError);
          return [];
        }

        // Get unique values
        const unique = [...new Set(fallbackData?.map(d => d.effective_salesperson).filter(Boolean))];
        return unique as string[];
      }

      return data?.map((d: { salesperson_name: string }) => d.salesperson_name) || [];
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
 * Hook to determine if user should see filtered analytics
 * Returns the salesperson name to filter by, or null for admin full access
 */
export function useAnalyticsFilter() {
  const { profile } = useAuth();
  const { data: mapping, isLoading } = useUserSalespersonMapping();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'sales-manager';

  return {
    // Non-admins get filtered, admins see all
    salespersonFilter: isAdmin ? null : mapping?.salesperson_name || null,
    // True if user has no mapping and is not admin
    requiresSetup: !isAdmin && !mapping && !isLoading,
    // True if mapping exists but is unverified
    isUnverified: !isAdmin && mapping && !mapping.is_verified,
    // Admin can choose to view as any salesperson
    isAdmin,
    // The user's own mapping for display
    userMapping: mapping,
    isLoading,
  };
}
