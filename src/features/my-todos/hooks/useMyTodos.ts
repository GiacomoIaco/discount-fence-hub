import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

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

export interface TaskWithDetails {
  id: string;
  initiative_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  initiative?: {
    id: string;
    title: string;
    area_id: string;
    area?: {
      id: string;
      name: string;
      function?: {
        id: string;
        name: string;
        color?: string;
      };
    };
  };
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  assignees?: TaskAssignee[];
}

export interface MyTasksData {
  createdByMe: TaskWithDetails[];
  assignedToMe: TaskWithDetails[];
  assignedByMe: TaskWithDetails[];
}

export interface TaskStats {
  totalCreated: number;
  totalAssigned: number;
  totalAssignedByMe: number;
  completedThisWeek: number;
  overdueCount: number;
  inProgressCount: number;
}

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all tasks relevant to the current user:
 * - Tasks they created
 * - Tasks assigned to them (via task_assignees or assigned_to)
 * - Tasks they assigned to others
 */
export function useMyTodosQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-todos', user?.id],
    queryFn: async (): Promise<MyTasksData> => {
      if (!user) throw new Error('User not authenticated');

      // Fetch tasks created by the user
      const { data: createdByMe, error: createdError } = await supabase
        .from('project_tasks')
        .select(`
          *,
          initiative:project_initiatives(
            id, title, area_id,
            area:project_areas(
              id, name,
              function:project_functions(id, name, color)
            )
          ),
          assigned_user:user_profiles!project_tasks_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (createdError) {
        // created_by column might not exist yet
        console.warn('created_by query failed:', createdError);
      }

      // Fetch tasks assigned to the user (via assigned_to)
      const { data: assignedToMe, error: assignedError } = await supabase
        .from('project_tasks')
        .select(`
          *,
          initiative:project_initiatives(
            id, title, area_id,
            area:project_areas(
              id, name,
              function:project_functions(id, name, color)
            )
          ),
          assigned_user:user_profiles!project_tasks_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('assigned_to', user.id)
        .order('updated_at', { ascending: false });

      if (assignedError) throw assignedError;

      // Also check task_assignees for additional assignments
      let additionalAssignedTasks: TaskWithDetails[] = [];
      try {
        const { data: taskAssignments } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        if (taskAssignments && taskAssignments.length > 0) {
          const additionalTaskIds = taskAssignments
            .map(a => a.task_id)
            .filter(id => !assignedToMe?.some(t => t.id === id));

          if (additionalTaskIds.length > 0) {
            const { data: additionalTasks } = await supabase
              .from('project_tasks')
              .select(`
                *,
                initiative:project_initiatives(
                  id, title, area_id,
                  area:project_areas(
                    id, name,
                    function:project_functions(id, name, color)
                  )
                ),
                assigned_user:user_profiles!project_tasks_assigned_to_fkey(id, full_name, avatar_url)
              `)
              .in('id', additionalTaskIds);

            additionalAssignedTasks = additionalTasks || [];
          }
        }
      } catch (e) {
        // task_assignees table might not exist yet
        console.warn('task_assignees query failed:', e);
      }

      // Fetch tasks assigned by user to others (where user is in assigned_by of task_assignees)
      let assignedByMe: TaskWithDetails[] = [];
      try {
        const { data: assignedByMeLinks } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('assigned_by', user.id)
          .neq('user_id', user.id); // Not assigned to themselves

        if (assignedByMeLinks && assignedByMeLinks.length > 0) {
          const taskIds = [...new Set(assignedByMeLinks.map(a => a.task_id))];
          const { data: tasks } = await supabase
            .from('project_tasks')
            .select(`
              *,
              initiative:project_initiatives(
                id, title, area_id,
                area:project_areas(
                  id, name,
                  function:project_functions(id, name, color)
                )
              ),
              assigned_user:user_profiles!project_tasks_assigned_to_fkey(id, full_name, avatar_url)
            `)
            .in('id', taskIds);

          assignedByMe = tasks || [];
        }
      } catch (e) {
        console.warn('assigned_by query failed:', e);
      }

      // Merge assigned tasks (avoiding duplicates)
      const allAssignedToMe = [...(assignedToMe || [])];
      additionalAssignedTasks.forEach(task => {
        if (!allAssignedToMe.some(t => t.id === task.id)) {
          allAssignedToMe.push(task);
        }
      });

      // Fetch assignees for all tasks
      const allTaskIds = [
        ...(createdByMe || []).map(t => t.id),
        ...allAssignedToMe.map(t => t.id),
        ...assignedByMe.map(t => t.id),
      ];

      let assigneesMap: Record<string, TaskAssignee[]> = {};
      if (allTaskIds.length > 0) {
        try {
          const { data: allAssignees } = await supabase
            .from('task_assignees')
            .select(`
              *,
              user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
            `)
            .in('task_id', allTaskIds);

          if (allAssignees) {
            allAssignees.forEach(a => {
              if (!assigneesMap[a.task_id]) {
                assigneesMap[a.task_id] = [];
              }
              assigneesMap[a.task_id].push(a);
            });
          }
        } catch (e) {
          console.warn('Failed to fetch assignees:', e);
        }
      }

      // Attach assignees to tasks
      const attachAssignees = (tasks: TaskWithDetails[]) =>
        tasks.map(task => ({
          ...task,
          assignees: assigneesMap[task.id] || [],
        }));

      return {
        createdByMe: attachAssignees(createdByMe || []),
        assignedToMe: attachAssignees(allAssignedToMe),
        assignedByMe: attachAssignees(assignedByMe),
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
  const allTasksMap = new Map<string, TaskWithDetails>();
  [...data.createdByMe, ...data.assignedToMe, ...data.assignedByMe].forEach(task => {
    allTasksMap.set(task.id, task);
  });
  const allTasks = Array.from(allTasksMap.values());

  const completedThisWeek = allTasks.filter(task => {
    if (task.status !== 'done') return false;
    const completedAt = task.completed_at ? new Date(task.completed_at) : new Date(task.updated_at);
    return completedAt >= weekAgo;
  }).length;

  const inProgressCount = allTasks.filter(task =>
    task.status === 'in_progress'
  ).length;

  // Check for overdue tasks (past due_date and not done)
  const overdueCount = allTasks.filter(task => {
    if (task.status === 'done') return false;
    if (!task.due_date) return false;
    return new Date(task.due_date) < now;
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

// ============================================
// MUTATIONS
// ============================================

/**
 * Update a task's status
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set completed_at when marking as done
      if (status === 'done') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from('project_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

/**
 * Update task order for drag-drop reordering
 */
export function useUpdateTaskOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: { id: string; order: number }[]) => {
      const updates = tasks.map(({ id, order }) =>
        supabase
          .from('project_tasks')
          .update({ sort_order: order })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} task(s)`);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
    },
  });
}

/**
 * Update any field on a task (for inline editing)
 */
export function useUpdateTaskField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: unknown }) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      initiative_id,
      title,
      description,
      due_date,
      assignees = [],
    }: {
      initiative_id: string;
      title: string;
      description?: string;
      due_date?: string;
      assignees?: string[];
    }) => {
      if (!user) throw new Error('User not authenticated');

      // Create the task
      const { data: task, error } = await supabase
        .from('project_tasks')
        .insert({
          initiative_id,
          title,
          description,
          due_date,
          status: 'todo',
          sort_order: 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add assignees if provided
      if (assignees.length > 0) {
        const assigneeInserts = assignees.map(userId => ({
          task_id: task.id,
          user_id: userId,
          assigned_by: user.id,
        }));

        await supabase.from('task_assignees').insert(assigneeInserts);

        // Also set assigned_to for backward compatibility (first assignee)
        await supabase
          .from('project_tasks')
          .update({ assigned_to: assignees[0] })
          .eq('id', task.id);
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

/**
 * Create a personal initiative (no area required, only visible in My To-Dos)
 */
export function useCreatePersonalInitiative() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      title,
      description,
      is_private = false,
      header_color,
    }: {
      title: string;
      description?: string;
      is_private?: boolean;
      header_color?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_initiatives')
        .insert({
          title,
          description,
          is_personal: true,
          is_private,
          header_color,
          status: 'active',
          priority: 'medium',
          progress_percent: 0,
          color_status: 'green',
          is_active: true,
          created_by: user.id,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['personal-initiatives'] });
    },
  });
}

export interface PersonalInitiative {
  id: string;
  title: string;
  description: string | null;
  is_private: boolean;
  header_color: string | null;
  sort_order: number;
}

/**
 * Fetch personal initiatives created by the user
 */
export function usePersonalInitiativesQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['personal-initiatives', user?.id],
    queryFn: async (): Promise<PersonalInitiative[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('project_initiatives')
        .select('id, title, description, is_private, header_color, sort_order')
        .eq('created_by', user.id)
        .eq('is_personal', true)
        .is('archived_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        // is_personal column might not exist yet
        console.warn('personal initiatives query failed:', error);
        return [];
      }

      return (data || []).map(d => ({
        ...d,
        is_private: d.is_private ?? false,
        header_color: d.header_color ?? null,
        sort_order: d.sort_order ?? 0,
      }));
    },
    enabled: !!user,
  });
}

/**
 * Update a personal initiative
 */
export function useUpdatePersonalInitiative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; description?: string; is_private?: boolean; header_color?: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('project_initiatives')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-initiatives'] });
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
    },
  });
}

/**
 * Reorder personal initiatives
 */
export function useReorderPersonalInitiatives() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (initiatives: { id: string; sort_order: number }[]) => {
      const updates = initiatives.map(({ id, sort_order }) =>
        supabase
          .from('project_initiatives')
          .update({ sort_order })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} initiative(s)`);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-initiatives'] });
    },
  });
}

/**
 * Reorder tasks within an initiative
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: { id: string; sort_order: number }[]) => {
      const updates = tasks.map(({ id, sort_order }) =>
        supabase
          .from('project_tasks')
          .update({ sort_order })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} task(s)`);
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
    },
  });
}

/**
 * Archive a personal initiative
 */
export function useArchivePersonalInitiative() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (initiativeId: string) => {
      const { data, error } = await supabase
        .from('project_initiatives')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', initiativeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-initiatives'] });
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
    },
  });
}
