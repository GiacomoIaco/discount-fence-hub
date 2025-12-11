import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { ClientContact, CommunityContact, ContactRole, ContactEntityType } from '../types';

// ============================================
// CONTACT ROLES
// ============================================

/**
 * Get all contact roles, optionally filtered by entity type
 */
export function useContactRoles(entityType?: ContactEntityType) {
  return useQuery({
    queryKey: ['contact-roles', entityType],
    queryFn: async () => {
      let query = supabase
        .from('contact_roles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      // Filter by entity type if provided
      if (entityType) {
        query = query.contains('entity_types', [entityType]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContactRole[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - roles don't change often
  });
}

// ============================================
// CLIENT CONTACTS (supplements useClients.ts)
// ============================================

/**
 * Get all contacts for a client with role information
 */
export function useClientContacts(clientId: string | null) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          *,
          contact_role:contact_roles(*)
        `)
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as ClientContact[];
    },
    enabled: !!clientId,
  });
}

/**
 * Update an existing client contact
 */
export function useUpdateClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientContact> }) => {
      const { data: result, error } = await supabase
        .from('client_contacts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', result.client_id] });
      queryClient.invalidateQueries({ queryKey: ['client', result.client_id] });
      showSuccess('Contact updated');
    },
    onError: (error) => {
      showError(error.message);
    },
  });
}

// ============================================
// COMMUNITY CONTACTS (supplements useCommunities.ts)
// ============================================

/**
 * Get all contacts for a community with role information
 */
export function useCommunityContacts(communityId: string | null) {
  return useQuery({
    queryKey: ['community-contacts', communityId],
    queryFn: async () => {
      if (!communityId) return [];

      const { data, error } = await supabase
        .from('community_contacts')
        .select(`
          *,
          contact_role:contact_roles(*)
        `)
        .eq('community_id', communityId)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as CommunityContact[];
    },
    enabled: !!communityId,
  });
}

/**
 * Update an existing community contact
 */
export function useUpdateCommunityContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CommunityContact> }) => {
      const { data: result, error } = await supabase
        .from('community_contacts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['community-contacts', result.community_id] });
      queryClient.invalidateQueries({ queryKey: ['community', result.community_id] });
      showSuccess('Contact updated');
    },
    onError: (error) => {
      showError(error.message);
    },
  });
}
