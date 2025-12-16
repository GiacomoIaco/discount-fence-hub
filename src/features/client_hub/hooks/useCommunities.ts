import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Community, CommunityFormData, CommunityContact } from '../types';
import toast from 'react-hot-toast';

// ============================================
// COMMUNITIES
// ============================================

export function useCommunities(filters?: {
  search?: string;
  client_id?: string;
  geography_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['communities', filters],
    queryFn: async () => {
      let query = supabase
        .from('communities')
        .select(`
          *,
          client:clients(id, name, code),
          geography:geographies(id, name, code)
        `)
        .order('name');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      if (filters?.client_id) {
        query = query.eq('client_id', filters.client_id);
      }
      if (filters?.geography_id) {
        query = query.eq('geography_id', filters.geography_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Community[];
    },
  });
}

export function useCommunity(id: string | null) {
  return useQuery({
    queryKey: ['community', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('communities')
        .select(`
          *,
          client:clients(*),
          geography:geographies(*),
          contacts:community_contacts(
            *,
            contact_role:contact_roles(*)
          ),
          default_rep:user_profiles!communities_default_rep_id_fkey(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Community;
    },
    enabled: !!id,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CommunityFormData) => {
      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          ...data,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return community;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.client_id] });
      toast.success('Community created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create community');
    },
  });
}

export function useUpdateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CommunityFormData> }) => {
      const { data: community, error } = await supabase
        .from('communities')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return community;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community', variables.id] });
      toast.success('Community updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update community');
    },
  });
}

export function useDeleteCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('communities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Community deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete community');
    },
  });
}

// ============================================
// COMMUNITY CONTACTS
// ============================================

export function useCreateCommunityContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CommunityContact, 'id' | 'created_at'>) => {
      const { data: contact, error } = await supabase
        .from('community_contacts')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community', variables.community_id] });
      toast.success('Contact added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add contact');
    },
  });
}

export function useDeleteCommunityContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, communityId }: { id: string; communityId: string }) => {
      const { error } = await supabase.from('community_contacts').delete().eq('id', id);
      if (error) throw error;
      return communityId;
    },
    onSuccess: (communityId) => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      toast.success('Contact removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove contact');
    },
  });
}

// ============================================
// APPROVED SKUs
// ============================================

export function useUpdateCommunitySkus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      communityId,
      approved_sku_ids,
      restrict_skus
    }: {
      communityId: string;
      approved_sku_ids: string[];
      restrict_skus: boolean;
    }) => {
      const { data, error } = await supabase
        .from('communities')
        .update({
          approved_sku_ids,
          restrict_skus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', communityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community', variables.communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success('Approved SKUs updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update SKUs');
    },
  });
}
