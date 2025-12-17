import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { SkillTag, SkillTagFormData, CrewSkillTag, SkillProficiency } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

// ============================================
// SKILL TAGS
// ============================================

export function useSkillTags(filters?: { isActive?: boolean }) {
  return useQuery({
    queryKey: ['skill_tags', filters],
    queryFn: async () => {
      let query = supabase
        .from('skill_tags')
        .select('*')
        .order('display_order', { ascending: true });

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SkillTag[];
    },
  });
}

export function useSkillTag(id: string | undefined) {
  return useQuery({
    queryKey: ['skill_tags', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('skill_tags')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as SkillTag;
    },
    enabled: !!id,
  });
}

export function useCreateSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SkillTagFormData) => {
      const { data: result, error } = await supabase
        .from('skill_tags')
        .insert({
          name: data.name,
          code: data.code || null,
          description: data.description || null,
          color: data.color || '#6B7280',
          triggers_pm: data.triggers_pm || false,
          display_order: data.display_order || 0,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return result as SkillTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill_tags'] });
      showSuccess('Skill tag created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create skill tag');
    },
  });
}

export function useUpdateSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SkillTagFormData> }) => {
      const { error } = await supabase
        .from('skill_tags')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill_tags'] });
      showSuccess('Skill tag updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update skill tag');
    },
  });
}

export function useDeleteSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('skill_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill_tags'] });
      showSuccess('Skill tag deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete skill tag');
    },
  });
}

// ============================================
// CREW SKILL TAGS
// ============================================

export function useCrewSkillTags(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew_skill_tags', crewId],
    queryFn: async () => {
      if (!crewId) return [];

      const { data, error } = await supabase
        .from('crew_skill_tags')
        .select(`
          *,
          skill_tag:skill_tags(*)
        `)
        .eq('crew_id', crewId);

      if (error) throw error;
      return data as CrewSkillTag[];
    },
    enabled: !!crewId,
  });
}

export function useAddCrewSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      crewId,
      skillTagId,
      proficiency = 'standard',
    }: {
      crewId: string;
      skillTagId: string;
      proficiency?: SkillProficiency;
    }) => {
      const { data, error } = await supabase
        .from('crew_skill_tags')
        .insert({
          crew_id: crewId,
          skill_tag_id: skillTagId,
          proficiency,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crew_skill_tags', variables.crewId] });
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Skill added to crew');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add skill to crew');
    },
  });
}

export function useUpdateCrewSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      crewId,
      proficiency,
    }: {
      id: string;
      crewId: string;
      proficiency: SkillProficiency;
    }) => {
      const { error } = await supabase
        .from('crew_skill_tags')
        .update({ proficiency })
        .eq('id', id);

      if (error) throw error;
      return crewId;
    },
    onSuccess: (crewId) => {
      queryClient.invalidateQueries({ queryKey: ['crew_skill_tags', crewId] });
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Skill proficiency updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update skill');
    },
  });
}

export function useRemoveCrewSkillTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, crewId }: { id: string; crewId: string }) => {
      const { error } = await supabase
        .from('crew_skill_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return crewId;
    },
    onSuccess: (crewId) => {
      queryClient.invalidateQueries({ queryKey: ['crew_skill_tags', crewId] });
      queryClient.invalidateQueries({ queryKey: ['crews'] });
      showSuccess('Skill removed from crew');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to remove skill');
    },
  });
}

// ============================================
// FIND CREWS BY SKILLS
// ============================================

/**
 * Find crews that have ALL the specified skill tags
 */
export function useCrewsBySkillTags(skillTagIds: string[]) {
  return useQuery({
    queryKey: ['crews_by_skills', skillTagIds],
    queryFn: async () => {
      if (!skillTagIds.length) return [];

      // Get all crews with their skill tags
      const { data: crewsWithSkills, error } = await supabase
        .from('crews')
        .select(`
          *,
          skill_tags:crew_skill_tags(
            skill_tag_id,
            proficiency,
            skill_tag:skill_tags(id, name, code, color)
          )
        `)
        .eq('is_active', true);

      if (error) throw error;

      // Filter crews that have ALL required skills
      const matchingCrews = (crewsWithSkills || []).filter(crew => {
        const crewSkillIds = (crew.skill_tags || []).map((st: any) => st.skill_tag_id);
        return skillTagIds.every(requiredId => crewSkillIds.includes(requiredId));
      });

      return matchingCrews;
    },
    enabled: skillTagIds.length > 0,
  });
}
