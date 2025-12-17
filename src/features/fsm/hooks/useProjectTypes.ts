import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { ProjectType, ProjectTypeFormData } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

export function useProjectTypes(businessUnitId?: string) {
  return useQuery({
    queryKey: ['project_types', businessUnitId],
    queryFn: async () => {
      let query = supabase
        .from('project_types')
        .select(`
          *,
          business_unit:business_units(id, name, code)
        `)
        .order('display_order')
        .order('name');

      if (businessUnitId) {
        query = query.eq('business_unit_id', businessUnitId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as (ProjectType & {
        business_unit: { id: string; name: string; code: string };
      })[];
    },
  });
}

export function useProjectType(id: string | undefined) {
  return useQuery({
    queryKey: ['project_types', 'detail', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('project_types')
        .select(`
          *,
          business_unit:business_units(id, name, code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ProjectType & {
        business_unit: { id: string; name: string; code: string };
      };
    },
    enabled: !!id,
  });
}

export function useCreateProjectType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProjectTypeFormData) => {
      const { data: result, error } = await supabase
        .from('project_types')
        .insert({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          business_unit_id: data.business_unit_id,
          description: data.description?.trim() || null,
          display_order: data.display_order || 0,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_types'] });
      showSuccess('Project type created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create project type');
    },
  });
}

export function useUpdateProjectType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProjectTypeFormData }) => {
      const { error } = await supabase
        .from('project_types')
        .update({
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          business_unit_id: data.business_unit_id,
          description: data.description?.trim() || null,
          display_order: data.display_order || 0,
          is_active: data.is_active,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_types'] });
      showSuccess('Project type updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update project type');
    },
  });
}

export function useDeleteProjectType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_types'] });
      showSuccess('Project type deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete project type');
    },
  });
}
