import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Client, ClientFormData, Geography, ClientContact, UserProfile } from '../types';
import toast from 'react-hot-toast';

// ============================================
// CLIENTS
// ============================================

export function useClients(filters?: {
  search?: string;
  business_unit?: string;
  client_type?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select(`
          *,
          communities:communities(count)
        `)
        .order('name');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      if (filters?.business_unit) {
        query = query.eq('business_unit', filters.business_unit);
      }
      if (filters?.client_type) {
        query = query.eq('client_type', filters.client_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform communities count
      return (data || []).map((client: any) => ({
        ...client,
        communities_count: client.communities?.[0]?.count || 0,
      })) as Client[];
    },
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          contacts:client_contacts(
            *,
            contact_role:contact_roles(*)
          ),
          communities:communities(
            *,
            geography:geographies(*),
            contacts:community_contacts(
              *,
              contact_role:contact_roles(*)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Client & { communities: any[] };
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          ...data,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create client');
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      const { data: client, error } = await supabase
        .from('clients')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return client;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.id] });
      toast.success('Client updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update client');
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete client');
    },
  });
}

// ============================================
// CLIENT CONTACTS
// ============================================

export function useCreateClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ClientContact, 'id' | 'created_at'>) => {
      const { data: contact, error } = await supabase
        .from('client_contacts')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client', variables.client_id] });
      toast.success('Contact added');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add contact');
    },
  });
}

export function useDeleteClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from('client_contacts').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      toast.success('Contact removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove contact');
    },
  });
}

// ============================================
// GEOGRAPHIES
// ============================================

export function useGeographies() {
  return useQuery({
    queryKey: ['geographies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geographies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Geography[];
    },
  });
}

export function useCreateGeography() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Geography, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: geo, error } = await supabase
        .from('geographies')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return geo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographies'] });
      toast.success('Geography created');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create geography');
    },
  });
}

export function useUpdateGeography() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Geography> }) => {
      const { data: geo, error } = await supabase
        .from('geographies')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return geo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographies'] });
      toast.success('Geography updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update geography');
    },
  });
}

// ============================================
// USER PROFILES (for rep assignments)
// ============================================

export function useUserProfiles(filters?: { role?: string }) {
  return useQuery({
    queryKey: ['user_profiles', filters],
    queryFn: async () => {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('display_name');

      if (filters?.role) {
        query = query.eq('role', filters.role);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
  });
}
