/**
 * Custom Fields Hooks
 *
 * Provides hooks for managing custom field definitions and values
 * for clients, communities, and projects.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'textarea' | 'url' | 'email' | 'phone';
export type CustomFieldEntityType = 'client' | 'community' | 'property' | 'request' | 'quote' | 'job' | 'invoice';

export interface SelectOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  entity_type: CustomFieldEntityType;
  field_name: string;
  field_label: string;
  field_type: CustomFieldType;
  options: SelectOption[] | null;
  placeholder: string | null;

  // Transferability (Jobber-style)
  is_transferable: boolean;
  transfers_to: CustomFieldEntityType[];

  // Visibility
  is_client_facing: boolean;
  show_in_reports: boolean;

  // Validation & Display
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  help_text: string | null;
  default_value: unknown;

  // Metadata
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  definition_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  value: unknown; // Can be string, number, boolean, etc.

  // Source tracking (for transferred fields)
  source_entity_type: CustomFieldEntityType | null;
  source_entity_id: string | null;

  updated_at: string;
  updated_by: string | null;
}

// Combined view for displaying fields with their values
export interface CustomFieldWithValue extends CustomFieldDefinition {
  field_value: unknown;
  value_id: string | null;
}

// ============================================
// HOOKS - DEFINITIONS
// ============================================

/**
 * Fetch all custom field definitions for an entity type
 */
export function useCustomFieldDefinitions(entityType: CustomFieldEntityType) {
  return useQuery({
    queryKey: ['custom_field_definitions', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
  });
}

/**
 * Fetch all custom field definitions (for admin)
 */
export function useAllCustomFieldDefinitions() {
  return useQuery({
    queryKey: ['custom_field_definitions', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('entity_type')
        .order('sort_order');

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
  });
}

/**
 * Create a new custom field definition
 */
export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<CustomFieldDefinition, 'id' | 'created_at' | 'created_by' | 'updated_at'>
    ) => {
      const { data: definition, error } = await supabase
        .from('custom_field_definitions')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return definition;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['custom_field_definitions', variables.entity_type],
      });
      queryClient.invalidateQueries({
        queryKey: ['custom_field_definitions', 'all'],
      });
      toast.success('Custom field created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create custom field');
    },
  });
}

/**
 * Update a custom field definition
 */
export function useUpdateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<CustomFieldDefinition, 'id' | 'created_at' | 'created_by'>>;
    }) => {
      const { data: definition, error } = await supabase
        .from('custom_field_definitions')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return definition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] });
      toast.success('Custom field updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update custom field');
    },
  });
}

/**
 * Delete (soft) a custom field definition
 */
export function useDeleteCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('custom_field_definitions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] });
      toast.success('Custom field removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove custom field');
    },
  });
}

// ============================================
// HOOKS - VALUES
// ============================================

/**
 * Fetch custom field values for a specific entity
 */
export function useCustomFieldValues(entityType: CustomFieldEntityType, entityId: string | null) {
  return useQuery({
    queryKey: ['custom_field_values', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];

      const { data, error } = await supabase
        .from('custom_field_values')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (error) throw error;
      return data as CustomFieldValue[];
    },
    enabled: !!entityId,
  });
}

/**
 * Combined hook: Fetch definitions with their values for a specific entity
 */
export function useCustomFieldsWithValues(
  entityType: CustomFieldEntityType,
  entityId: string | null
) {
  const { data: definitions, isLoading: defsLoading } = useCustomFieldDefinitions(entityType);
  const { data: values, isLoading: valsLoading } = useCustomFieldValues(entityType, entityId);

  const isLoading = defsLoading || valsLoading;

  // Merge definitions with their values
  const fields: CustomFieldWithValue[] = (definitions || []).map((def) => {
    const valueRecord = values?.find((v) => v.definition_id === def.id);
    return {
      ...def,
      field_value: valueRecord?.value ?? null,
      value_id: valueRecord?.id ?? null,
    };
  });

  return {
    data: fields,
    isLoading,
  };
}

/**
 * Upsert a custom field value
 */
export function useUpsertCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      definitionId,
      entityType,
      entityId,
      value,
    }: {
      definitionId: string;
      entityType: CustomFieldEntityType;
      entityId: string;
      value: unknown;
    }) => {
      const { data, error } = await supabase
        .from('custom_field_values')
        .upsert(
          {
            definition_id: definitionId,
            entity_type: entityType,
            entity_id: entityId,
            value: value,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'definition_id,entity_id',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['custom_field_values', variables.entityType, variables.entityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save custom field');
    },
  });
}

/**
 * Batch update multiple custom field values at once
 */
export function useBatchUpdateCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      fields,
    }: {
      entityType: CustomFieldEntityType;
      entityId: string;
      fields: { definitionId: string; value: unknown }[];
    }) => {
      // Prepare upsert data
      const upsertData = fields.map((field) => ({
        definition_id: field.definitionId,
        entity_type: entityType,
        entity_id: entityId,
        value: field.value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('custom_field_values').upsert(upsertData, {
        onConflict: 'definition_id,entity_id',
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['custom_field_values', variables.entityType, variables.entityId],
      });
      toast.success('Custom fields saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save custom fields');
    },
  });
}

// ============================================
// TRANSFER CUSTOM FIELDS (Jobber-style)
// ============================================

/**
 * Transfer custom fields from one entity to another
 * Used when converting: Quote → Job, Job → Invoice, etc.
 *
 * This calls the database function transfer_custom_fields()
 * which handles the transferability rules.
 */
export function useTransferCustomFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceEntityType,
      sourceEntityId,
      targetEntityType,
      targetEntityId,
    }: {
      sourceEntityType: CustomFieldEntityType;
      sourceEntityId: string;
      targetEntityType: CustomFieldEntityType;
      targetEntityId: string;
    }) => {
      // Call the database function
      const { data, error } = await supabase.rpc('transfer_custom_fields', {
        p_source_entity_type: sourceEntityType,
        p_source_entity_id: sourceEntityId,
        p_target_entity_type: targetEntityType,
        p_target_entity_id: targetEntityId,
      });

      if (error) throw error;
      return data as number; // Returns count of transferred fields
    },
    onSuccess: (count, variables) => {
      // Invalidate the target entity's custom field values
      queryClient.invalidateQueries({
        queryKey: ['custom_field_values', variables.targetEntityType, variables.targetEntityId],
      });
      if (count > 0) {
        toast.success(`Transferred ${count} custom field${count > 1 ? 's' : ''}`);
      }
    },
    onError: (error: Error) => {
      console.error('Failed to transfer custom fields:', error);
      // Don't show error toast - this is usually a background operation
    },
  });
}

/**
 * Fetch transferable custom fields for a source entity
 * Shows which fields will be transferred when converting
 */
export function useTransferableFields(
  sourceEntityType: CustomFieldEntityType,
  targetEntityType: CustomFieldEntityType
) {
  return useQuery({
    queryKey: ['transferable_fields', sourceEntityType, targetEntityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('entity_type', sourceEntityType)
        .eq('is_transferable', true)
        .eq('is_active', true)
        .contains('transfers_to', [targetEntityType])
        .order('sort_order');

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
  });
}
