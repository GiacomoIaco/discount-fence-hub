import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { InitiativeWithDetails } from '../../leadership/lib/leadership';

export interface MyTodosData {
  createdByMe: InitiativeWithDetails[];
  assignedToMe: InitiativeWithDetails[];
  assignedByMe: InitiativeWithDetails[];
}

export interface TaskStats {
  totalCreated: number;
  totalAssigned: number;
  totalAssignedByMe: number;
  completedThisWeek: number;
  overdueCount: number;
}

/**
 * Fetch all tasks relevant to the current user:
 * - Tasks they created
 * - Tasks assigned to them
 * - Tasks they assigned to others
 */
export function useMyTodosQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-todos', user?.id],
    queryFn: async (): Promise<MyTodosData> => {
      if (!user) throw new Error('User not authenticated');

      // Fetch tasks created by the user
      const { data: createdByMe, error: createdError } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('created_by', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (createdError) throw createdError;

      // Fetch tasks assigned to the user
      const { data: assignedToMe, error: assignedError } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('assigned_to', user.id)
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (assignedError) throw assignedError;

      // Fetch tasks assigned by the user to others
      const { data: assignedByMe, error: assignedByError } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('assigned_by', user.id)
        .neq('assigned_to', user.id) // Don't include tasks assigned to self
        .is('archived_at', null)
        .order('updated_at', { ascending: false });

      if (assignedByError) {
        // assigned_by column might not exist yet - return empty array
        console.warn('assigned_by query failed (column may not exist yet):', assignedByError);
      }

      return {
        createdByMe: createdByMe || [],
        assignedToMe: assignedToMe || [],
        assignedByMe: assignedByMe || [],
      };
    },
    enabled: !!user,
  });
}

/**
 * Calculate stats for the user's tasks
 */
export function useMyTodosStats() {
  const { data } = useMyTodosQuery();

  if (!data) {
    return {
      totalCreated: 0,
      totalAssigned: 0,
      totalAssignedByMe: 0,
      completedThisWeek: 0,
      overdueCount: 0,
      inProgressCount: 0,
    };
  }

  // Calculate stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Combine all tasks (deduplicated by id)
  const allTasksMap = new Map<string, InitiativeWithDetails>();
  [...data.createdByMe, ...data.assignedToMe, ...data.assignedByMe].forEach(task => {
    allTasksMap.set(task.id, task);
  });
  const allTasks = Array.from(allTasksMap.values());

  const completedThisWeek = allTasks.filter(task => {
    if (task.status !== 'completed') return false;
    const updatedAt = new Date(task.updated_at);
    return updatedAt >= weekAgo;
  }).length;

  const inProgressCount = allTasks.filter(task =>
    task.status === 'active' || task.status === 'at_risk'
  ).length;

  // Check for overdue tasks (past target_date and not completed)
  const overdueCount = allTasks.filter(task => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    if (!task.target_date) return false;
    return new Date(task.target_date) < now;
  }).length;

  return {
    totalCreated: data.createdByMe.length,
    totalAssigned: data.assignedToMe.length,
    totalAssignedByMe: data.assignedByMe.length,
    completedThisWeek,
    overdueCount,
    inProgressCount,
  };
}

/**
 * Update a task's status quickly from My To-Dos view
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('project_initiatives')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['leadership'] });
    },
  });
}
