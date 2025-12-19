import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { Property, PropertyFormData, PropertyContact, PropertyStatus } from '../types';

// ============================================
// PROPERTIES
// ============================================

/**
 * Get all properties for a community
 */
export function useProperties(communityId: string | null, filters?: {
  search?: string;
  status?: PropertyStatus;
}) {
  return useQuery({
    queryKey: ['properties', communityId, filters],
    queryFn: async () => {
      if (!communityId) return [];

      let query = supabase
        .from('properties')
        .select(`
          *,
          contacts:property_contacts(
            *,
            contact_role:contact_roles(*)
          )
        `)
        .eq('community_id', communityId)
        .order('lot_number', { nullsFirst: false })
        .order('address_line1');

      if (filters?.search) {
        query = query.or(`address_line1.ilike.%${filters.search}%,lot_number.ilike.%${filters.search}%,homeowner_name.ilike.%${filters.search}%`);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Property[];
    },
    enabled: !!communityId,
  });
}

/**
 * Get a single property by ID
 */
export function useProperty(id: string | null) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          community:communities(
            *,
            client:clients(*)
          ),
          contacts:property_contacts(
            *,
            contact_role:contact_roles(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Property;
    },
    enabled: !!id,
  });
}

/**
 * Create a new property
 */
export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PropertyFormData) => {
      // Track when coordinates are provided
      const hasCoordinates = data.latitude != null && data.longitude != null;

      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          ...data,
          lot_number: data.lot_number || null,
          block_number: data.block_number || null,
          gate_code: data.gate_code || null,
          access_notes: data.access_notes || null,
          homeowner_name: data.homeowner_name || null,
          homeowner_phone: data.homeowner_phone || null,
          homeowner_email: data.homeowner_email || null,
          notes: data.notes || null,
          // Geocoding fields
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          geocoded_at: hasCoordinates ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return property;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['properties', variables.community_id] });
      queryClient.invalidateQueries({ queryKey: ['community', variables.community_id] });
      showSuccess('Property created');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Update an existing property
 */
export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PropertyFormData> }) => {
      // If coordinates are being updated, track geocoded_at
      const coordinatesProvided = 'latitude' in data || 'longitude' in data;
      const hasCoordinates = data.latitude != null && data.longitude != null;

      const { data: property, error } = await supabase
        .from('properties')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
          // Update geocoded_at only if coordinates are being changed
          ...(coordinatesProvided && {
            geocoded_at: hasCoordinates ? new Date().toISOString() : null,
          }),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return property;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['properties', result.community_id] });
      queryClient.invalidateQueries({ queryKey: ['property', result.id] });
      showSuccess('Property updated');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Delete a property
 */
export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, communityId }: { id: string; communityId: string }) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      return communityId;
    },
    onSuccess: (communityId) => {
      queryClient.invalidateQueries({ queryKey: ['properties', communityId] });
      showSuccess('Property deleted');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

// ============================================
// PROPERTY CONTACTS
// ============================================

/**
 * Create a property contact
 */
export function useCreatePropertyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<PropertyContact, 'id' | 'created_at' | 'contact_role'>) => {
      const { data: contact, error } = await supabase
        .from('property_contacts')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.property_id] });
      showSuccess('Contact added');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Delete a property contact
 */
export function useDeletePropertyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, propertyId }: { id: string; propertyId: string }) => {
      const { error } = await supabase.from('property_contacts').delete().eq('id', id);
      if (error) throw error;
      return propertyId;
    },
    onSuccess: (propertyId) => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      showSuccess('Contact removed');
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });
}

/**
 * Get property count for a community
 */
export function usePropertyCount(communityId: string | null) {
  return useQuery({
    queryKey: ['property-count', communityId],
    queryFn: async () => {
      if (!communityId) return 0;

      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!communityId,
  });
}

export interface ClientPropertyResult {
  id: string;
  address_line1: string;
  city: string | null;
  state: string;
  zip: string | null;
  lot_number: string | null;
  block_number: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  community_id: string;
  community_name: string;
}

/**
 * Get all properties for a client (via communities)
 * Used by Request Editor to show available properties when client is selected
 */
export function useClientProperties(clientId: string | null) {
  return useQuery({
    queryKey: ['client-properties', clientId],
    queryFn: async () => {
      if (!clientId) return [] as ClientPropertyResult[];

      // Properties are linked to communities, which are linked to clients
      // Join through communities to get all properties for this client
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          address_line1,
          city,
          state,
          zip,
          lot_number,
          block_number,
          status,
          latitude,
          longitude,
          community:communities!inner(
            id,
            name,
            client_id
          )
        `)
        .eq('communities.client_id', clientId)
        .order('address_line1');

      if (error) throw error;

      // Return as ClientPropertyResult objects
      return (data || []).map((p): ClientPropertyResult => {
        // Supabase !inner join returns a single object, not array
        const comm = p.community as unknown as { id: string; name: string };
        return {
          id: p.id as string,
          address_line1: p.address_line1 as string,
          city: p.city as string | null,
          state: p.state as string,
          zip: p.zip as string | null,
          lot_number: p.lot_number as string | null,
          block_number: p.block_number as string | null,
          status: p.status as string,
          latitude: p.latitude as number | null,
          longitude: p.longitude as number | null,
          community_id: comm.id,
          community_name: comm.name,
        };
      });
    },
    enabled: !!clientId,
  });
}
