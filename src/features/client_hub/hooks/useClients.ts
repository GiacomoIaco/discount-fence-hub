import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Client, ClientFormData, Geography, ClientContact, UserProfile } from '../types';
import toast from 'react-hot-toast';

// ============================================
// CLIENTS
// ============================================

export function useClients(filters?: {
  search?: string;
  qbo_class_id?: string;
  client_type?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: async () => {
      // Fetch clients (no FK to qbo_classes, so we can't join)
      let query = supabase
        .from('clients')
        .select(`
          *,
          communities:communities(count)
        `)
        // Note: We sort client-side below to handle company_name || name logic
        .order('name');

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`);
      }
      if (filters?.qbo_class_id) {
        query = query.eq('default_qbo_class_id', filters.qbo_class_id);
      }
      if (filters?.client_type) {
        query = query.eq('client_type', filters.client_type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch all QBO classes for lookup (no FK relationship exists)
      const { data: qboClasses } = await supabase
        .from('qbo_classes')
        .select('id, name, fully_qualified_name');

      const qboClassMap = new Map(
        (qboClasses || []).map((qc: any) => [qc.id, qc])
      );

      // Transform and sort by display name (company_name || name)
      const transformed = (data || []).map((client: any) => {
        const qboClass = client.default_qbo_class_id
          ? qboClassMap.get(client.default_qbo_class_id)
          : null;
        return {
          ...client,
          communities_count: client.communities?.[0]?.count || 0,
          qbo_class_name: qboClass?.name || null,
          qbo_class_full_name: qboClass?.fully_qualified_name || null,
        };
      });

      // Sort by display name (company_name takes precedence over name)
      transformed.sort((a: any, b: any) => {
        const nameA = (a.company_name || a.name || '').toLowerCase();
        const nameB = (b.company_name || b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      return transformed as Client[];
    },
  });
}

export function useClient(id: string | null) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      if (!id) return null;

      // Fetch client (no FK to qbo_classes, so we can't join)
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

      // Fetch QBO class separately if client has one assigned
      let qboClassName = null;
      let qboClassFullName = null;
      if (data.default_qbo_class_id) {
        const { data: qboClass } = await supabase
          .from('qbo_classes')
          .select('name, fully_qualified_name')
          .eq('id', data.default_qbo_class_id)
          .single();

        if (qboClass) {
          qboClassName = qboClass.name;
          qboClassFullName = qboClass.fully_qualified_name;
        }
      }

      // Add QBO class name to the client object
      const clientWithQbo = {
        ...data,
        qbo_class_name: qboClassName,
        qbo_class_full_name: qboClassFullName,
      };

      return clientWithQbo as Client & { communities: any[] };
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Convert empty strings to null for fields with unique constraints
      const sanitizedData = {
        ...data,
        code: data.code?.trim() || null,
        company_name: data.company_name?.trim() || null,
        status: 'active' as const,
      };

      const { data: client, error } = await supabase
        .from('clients')
        .insert(sanitizedData)
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
      // Convert empty strings to null for fields with unique constraints
      const sanitizedData = {
        ...data,
        ...(data.code !== undefined && { code: data.code?.trim() || null }),
        ...(data.company_name !== undefined && { company_name: data.company_name?.trim() || null }),
        updated_at: new Date().toISOString(),
      };

      const { data: client, error } = await supabase
        .from('clients')
        .update(sanitizedData)
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
      console.error('Client update error:', error);
      // Handle specific error cases
      if (error.code === '23505') {
        toast.error('A client with this code already exists');
      } else {
        toast.error(error.message || 'Failed to update client');
      }
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
// CLIENT CREW PREFERENCES (S-006)
// ============================================

export interface ClientCrewPreference {
  id: string;
  client_id: string;
  crew_id: string;
  skill_categories: string[];
  priority: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  crew?: {
    id: string;
    name: string;
    code: string;
    is_subcontractor: boolean;
  };
}

export function useClientCrewPreferences(clientId: string | null) {
  return useQuery({
    queryKey: ['client_crew_preferences', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_crew_preferences')
        .select(`
          *,
          crew:crews(id, name, code, is_subcontractor)
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('priority');

      if (error) throw error;
      return data as ClientCrewPreference[];
    },
    enabled: !!clientId,
  });
}

export function useSetClientCrewPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, crewIds }: { clientId: string; crewIds: string[] }) => {
      // Delete existing preferences
      await supabase
        .from('client_crew_preferences')
        .delete()
        .eq('client_id', clientId);

      // Insert new preferences with priority order
      if (crewIds.length > 0) {
        const inserts = crewIds.map((crewId, index) => ({
          client_id: clientId,
          crew_id: crewId,
          priority: index + 1,
          is_active: true,
        }));

        const { error } = await supabase
          .from('client_crew_preferences')
          .insert(inserts);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client_crew_preferences', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.clientId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update crew preferences');
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
        .order('full_name');

      if (filters?.role) {
        query = query.eq('role', filters.role);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
  });
}

