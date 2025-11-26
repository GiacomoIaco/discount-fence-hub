import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { Task } from '../lib/goals.types';

// ============================================
// TYPES
// ============================================

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TaskWithAssignees extends Task {
  assignees?: TaskAssignee[];
  initiative?: {
    id: string;
    title: string;
    area_id: string;
  };
}

// ============================================
// QUERY KEYS
// ============================================

export const taskAssigneeKeys = {
  all: ['task-assignees'] as const,
  forTask: (taskId: string) => [...taskAssigneeKeys.all, 'task', taskId] as const,
  forUser: (userId: string) => [...taskAssigneeKeys.all, 'user', userId] as const,
  myTasks: () => [...taskAssigneeKeys.all, 'my-tasks'] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch assignees for a specific task
 */
export function useTaskAssigneesQuery(taskId: string | undefined) {
  return useQuery({
    queryKey: taskAssigneeKeys.forTask(taskId!),
    queryFn: async (): Promise<TaskAssignee[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from('task_assignees')
        .select(`
          *,
          user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!taskId,
  });
}

/**
 * Fetch all tasks assigned to the current user (via task_assignees)
 */
export function useMyTasksQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: taskAssigneeKeys.myTasks(),
    queryFn: async (): Promise<TaskWithAssignees[]> => {
      if (!user) return [];

      // Get task IDs where user is an assignee
      const { data: assignments, error: assignError } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id);

      if (assignError) {
        // Table might not exist yet
        console.warn('task_assignees query failed:', assignError);
        return [];
      }

      // Also get tasks where user is the old assigned_to
      const { data: legacyTasks, error: legacyError } = await supabase
        .from('project_tasks')
        .select(`
          *,
          initiative:project_initiatives!project_tasks_initiative_id_fkey(id, title, area_id)
        `)
        .eq('assigned_to', user.id)
        .order('updated_at', { ascending: false });

      if (legacyError) throw legacyError;

      // Combine task IDs (union)
      const assignedTaskIds = new Set(assignments?.map(a => a.task_id) || []);
      const legacyTaskIds = new Set(legacyTasks?.map(t => t.id) || []);
      const allTaskIds = [...new Set([...assignedTaskIds, ...legacyTaskIds])];

      if (allTaskIds.length === 0) return [];

      // Fetch all tasks with their assignees
      const { data: tasks, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          initiative:project_initiatives!project_tasks_initiative_id_fkey(id, title, area_id)
        `)
        .in('id', allTaskIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch assignees for each task
      const tasksWithAssignees = await Promise.all(
        (tasks || []).map(async (task) => {
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select(`
              *,
              user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
            `)
            .eq('task_id', task.id);

          return {
            ...task,
            assignees: assignees || [],
          } as TaskWithAssignees;
        })
      );

      return tasksWithAssignees;
    },
    enabled: !!user,
  });
}

/**
 * Fetch tasks for an initiative with their assignees
 */
export function useTasksWithAssigneesQuery(initiativeId: string | undefined) {
  return useQuery({
    queryKey: ['tasks-with-assignees', initiativeId],
    queryFn: async (): Promise<TaskWithAssignees[]> => {
      if (!initiativeId) return [];

      const { data: tasks, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('sort_order');

      if (error) throw error;

      // Fetch assignees for each task
      const tasksWithAssignees = await Promise.all(
        (tasks || []).map(async (task) => {
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select(`
              *,
              user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
            `)
            .eq('task_id', task.id);

          return {
            ...task,
            assignees: assignees || [],
          } as TaskWithAssignees;
        })
      );

      return tasksWithAssignees;
    },
    enabled: !!initiativeId,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Add an assignee to a task
 */
export function useAddTaskAssignee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: taskId,
          user_id: userId,
          assigned_by: user.id,
        })
        .select(`
          *,
          user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.forTask(data.task_id) });
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.myTasks() });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-assignees'] });
    },
  });
}

/**
 * Remove an assignee from a task
 */
export function useRemoveTaskAssignee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      if (error) throw error;
      return { taskId, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.forTask(data.taskId) });
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.myTasks() });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-assignees'] });
    },
  });
}

/**
 * Update all assignees for a task (replace)
 */
export function useUpdateTaskAssignees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, userIds }: { taskId: string; userIds: string[] }) => {
      if (!user) throw new Error('User not authenticated');

      // Delete existing assignees
      await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);

      // Insert new assignees
      if (userIds.length > 0) {
        const { error } = await supabase
          .from('task_assignees')
          .insert(
            userIds.map(userId => ({
              task_id: taskId,
              user_id: userId,
              assigned_by: user.id,
            }))
          );

        if (error) throw error;
      }

      return { taskId, userIds };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.forTask(data.taskId) });
      queryClient.invalidateQueries({ queryKey: taskAssigneeKeys.myTasks() });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-assignees'] });
    },
  });
}
