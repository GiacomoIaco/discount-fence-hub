import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  FsmTeamProfile,
  FsmTerritoryCoverage,
  FsmWorkSchedule,
  FsmPersonSkill,
  FsmTeamMember,
  FsmTeamProfileFormData,
  DayOfWeek,
  SkillProficiency,
} from '../types';
import { showSuccess, showError } from '../../../lib/toast';

// ============================================
// FSM TEAM PROFILES
// ============================================

export function useFsmTeamProfiles() {
  return useQuery({
    queryKey: ['fsm_team_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fsm_team_profiles')
        .select(`
          *,
          crew:crews(id, name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (FsmTeamProfile & {
        crew: { id: string; name: string; code: string } | null;
      })[];
    },
  });
}

// Use the view for complete team member data
export function useFsmTeamFull() {
  return useQuery({
    queryKey: ['fsm_team_full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fsm_team_full')
        .select('*');

      if (error) throw error;
      return data as FsmTeamMember[];
    },
  });
}

export function useFsmTeamProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['fsm_team_profiles', userId],
    queryFn: async () => {
      if (!userId) return null;

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('fsm_team_profiles')
        .select(`
          *,
          crew:crews(id, name, code)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Get territory coverage
      const { data: territories, error: terrError } = await supabase
        .from('fsm_territory_coverage')
        .select(`
          *,
          territory:territories(id, name, code)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (terrError) throw terrError;

      // Get work schedule
      const { data: schedule, error: schedError } = await supabase
        .from('fsm_work_schedules')
        .select('*')
        .eq('user_id', userId);

      if (schedError) throw schedError;

      // Get skills
      const { data: skills, error: skillsError } = await supabase
        .from('fsm_person_skills')
        .select(`
          *,
          project_type:project_types(id, name, code, business_unit_id)
        `)
        .eq('user_id', userId);

      if (skillsError) throw skillsError;

      return {
        profile: profile as FsmTeamProfile | null,
        territories: territories as (FsmTerritoryCoverage & {
          territory: { id: string; name: string; code: string };
        })[],
        schedule: schedule as FsmWorkSchedule[],
        skills: skills as (FsmPersonSkill & {
          project_type: { id: string; name: string; code: string; business_unit_id: string };
        })[],
      };
    },
    enabled: !!userId,
  });
}

export function useCreateFsmTeamProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FsmTeamProfileFormData) => {
      // Create profile
      const { data: profile, error: profileError } = await supabase
        .from('fsm_team_profiles')
        .insert({
          user_id: data.user_id,
          fsm_roles: data.fsm_roles,
          business_unit_ids: data.business_unit_ids,
          max_daily_assessments: data.max_daily_assessments,
          crew_id: data.crew_id || null,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Create territory coverage
      if (data.territory_coverage?.length) {
        const { error: terrError } = await supabase
          .from('fsm_territory_coverage')
          .insert(
            data.territory_coverage.map((tc) => ({
              user_id: data.user_id,
              territory_id: tc.territory_id,
              coverage_days: tc.coverage_days?.length ? tc.coverage_days : null,
              is_primary: tc.is_primary,
              is_active: true,
            }))
          );

        if (terrError) throw terrError;
      }

      // Create work schedule
      if (data.work_schedule?.length) {
        const { error: schedError } = await supabase
          .from('fsm_work_schedules')
          .insert(
            data.work_schedule.map((ws) => ({
              user_id: data.user_id,
              day_of_week: ws.day_of_week,
              start_time: ws.start_time,
              end_time: ws.end_time,
            }))
          );

        if (schedError) throw schedError;
      }

      // Create skills
      if (data.skills?.length) {
        const { error: skillsError } = await supabase
          .from('fsm_person_skills')
          .insert(
            data.skills.map((s) => ({
              user_id: data.user_id,
              project_type_id: s.project_type_id,
              proficiency: s.proficiency,
            }))
          );

        if (skillsError) throw skillsError;
      }

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('Team profile created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create team profile');
    },
  });
}

export function useUpdateFsmTeamProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: FsmTeamProfileFormData }) => {
      // Update or create profile
      const { error: profileError } = await supabase
        .from('fsm_team_profiles')
        .upsert({
          user_id: userId,
          fsm_roles: data.fsm_roles,
          business_unit_ids: data.business_unit_ids,
          max_daily_assessments: data.max_daily_assessments,
          crew_id: data.crew_id || null,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (profileError) throw profileError;

      // Replace territory coverage
      await supabase
        .from('fsm_territory_coverage')
        .delete()
        .eq('user_id', userId);

      if (data.territory_coverage?.length) {
        const { error: terrError } = await supabase
          .from('fsm_territory_coverage')
          .insert(
            data.territory_coverage.map((tc) => ({
              user_id: userId,
              territory_id: tc.territory_id,
              coverage_days: tc.coverage_days?.length ? tc.coverage_days : null,
              is_primary: tc.is_primary,
              is_active: true,
            }))
          );

        if (terrError) throw terrError;
      }

      // Replace work schedule
      await supabase
        .from('fsm_work_schedules')
        .delete()
        .eq('user_id', userId);

      if (data.work_schedule?.length) {
        const { error: schedError } = await supabase
          .from('fsm_work_schedules')
          .insert(
            data.work_schedule.map((ws) => ({
              user_id: userId,
              day_of_week: ws.day_of_week,
              start_time: ws.start_time,
              end_time: ws.end_time,
            }))
          );

        if (schedError) throw schedError;
      }

      // Replace skills
      await supabase
        .from('fsm_person_skills')
        .delete()
        .eq('user_id', userId);

      if (data.skills?.length) {
        const { error: skillsError } = await supabase
          .from('fsm_person_skills')
          .insert(
            data.skills.map((s) => ({
              user_id: userId,
              project_type_id: s.project_type_id,
              proficiency: s.proficiency,
            }))
          );

        if (skillsError) throw skillsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('Team profile updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update team profile');
    },
  });
}

export function useDeleteFsmTeamProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Delete related data first
      await supabase.from('fsm_territory_coverage').delete().eq('user_id', userId);
      await supabase.from('fsm_work_schedules').delete().eq('user_id', userId);
      await supabase.from('fsm_person_skills').delete().eq('user_id', userId);

      // Delete profile
      const { error } = await supabase
        .from('fsm_team_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('Team profile deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete team profile');
    },
  });
}

// ============================================
// TERRITORY COVERAGE HELPERS
// ============================================

export function useAddTerritoryCoverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      territoryId,
      coverageDays,
      isPrimary,
    }: {
      userId: string;
      territoryId: string;
      coverageDays?: DayOfWeek[];
      isPrimary?: boolean;
    }) => {
      const { error } = await supabase
        .from('fsm_territory_coverage')
        .insert({
          user_id: userId,
          territory_id: territoryId,
          coverage_days: coverageDays?.length ? coverageDays : null,
          is_primary: isPrimary || false,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add territory');
    },
  });
}

export function useRemoveTerritoryCoverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, territoryId }: { userId: string; territoryId: string }) => {
      const { error } = await supabase
        .from('fsm_territory_coverage')
        .delete()
        .eq('user_id', userId)
        .eq('territory_id', territoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to remove territory');
    },
  });
}

// ============================================
// SKILLS HELPERS
// ============================================

export function useAddPersonSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      projectTypeId,
      proficiency,
    }: {
      userId: string;
      projectTypeId: string;
      proficiency: SkillProficiency;
    }) => {
      const { error } = await supabase
        .from('fsm_person_skills')
        .insert({
          user_id: userId,
          project_type_id: projectTypeId,
          proficiency,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add skill');
    },
  });
}

export function useUpdatePersonSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      projectTypeId,
      proficiency,
    }: {
      userId: string;
      projectTypeId: string;
      proficiency: SkillProficiency;
    }) => {
      const { error } = await supabase
        .from('fsm_person_skills')
        .update({ proficiency, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('project_type_id', projectTypeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update skill');
    },
  });
}

export function useRemovePersonSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, projectTypeId }: { userId: string; projectTypeId: string }) => {
      const { error } = await supabase
        .from('fsm_person_skills')
        .delete()
        .eq('user_id', userId)
        .eq('project_type_id', projectTypeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to remove skill');
    },
  });
}

// ============================================
// WORK SCHEDULE HELPERS
// ============================================

export function useSetWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      schedule,
    }: {
      userId: string;
      schedule: { day_of_week: DayOfWeek; start_time: string; end_time: string }[];
    }) => {
      // Delete existing schedule
      await supabase.from('fsm_work_schedules').delete().eq('user_id', userId);

      // Insert new schedule
      if (schedule.length) {
        const { error } = await supabase
          .from('fsm_work_schedules')
          .insert(
            schedule.map((s) => ({
              user_id: userId,
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
            }))
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('Work schedule updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update work schedule');
    },
  });
}

// ============================================
// AVAILABLE REPS BY TERRITORY
// ============================================

export function useAvailableRepsByTerritory(territoryId?: string) {
  return useQuery({
    queryKey: ['available_reps_by_territory', territoryId],
    queryFn: async () => {
      let query = supabase.from('available_reps_by_territory').select('*');

      if (territoryId) {
        query = query.eq('territory_id', territoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as {
        user_id: string;
        name: string;
        max_daily_assessments: number;
        territory_id: string;
        territory_name: string;
        coverage_days: DayOfWeek[] | null;
      }[];
    },
  });
}

// ============================================
// CREWS WITH LEADS VIEW
// ============================================

export function useCrewsWithLeads() {
  return useQuery({
    queryKey: ['crews_with_leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews_with_leads')
        .select('*');

      if (error) throw error;
      return data as {
        id: string;
        name: string;
        code: string;
        crew_type: string;
        crew_size: number;
        max_daily_lf: number;
        home_territory_id: string | null;
        business_unit_id: string | null;
        lead_user_id: string | null;
        lead_email: string | null;
        lead_name: string | null;
        home_territory_name: string | null;
        business_unit_name: string | null;
        is_active: boolean;
      }[];
    },
  });
}

// ============================================
// INLINE UPDATE HELPERS (for Team List)
// ============================================

export function useUpdateAssignedBUs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      assignedQboClassIds,
    }: {
      userId: string;
      assignedQboClassIds: string[];
    }) => {
      const { error } = await supabase
        .from('fsm_team_profiles')
        .update({
          assigned_qbo_class_ids: assignedQboClassIds,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      showSuccess('BU assignments updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update BU assignments');
    },
  });
}
