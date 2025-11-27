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
  owner_id: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  due_date: string | null;
  sort_order: number;
  completed_at: string | null;
  is_high_priority: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  initiative?: {
    id: string;
    title: string;
    area_id: string;
    is_personal?: boolean;
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
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  assignees?: TaskAssignee[];
  // Role indicators for current user
  isOwner?: boolean;
  isAssignee?: boolean;
  isCreator?: boolean;
  isInMyFunction?: boolean;
}

export interface MyTasksData {
  tasks: TaskWithDetails[];
  // Keep these for backwards compatibility during transition
  createdByMe: TaskWithDetails[];
  assignedToMe: TaskWithDetails[];
  assignedByMe: TaskWithDetails[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface TaskStats {
  totalTasks: number;
  totalOwned: number;
  totalAssigned: number;
  totalInMyFunctions: number;
  completedThisWeek: number;
  overdueCount: number;
  inProgressCount: number;
  // Keep for backwards compatibility
  totalCreated: number;
  totalAssignedByMe: number;
}

// ============================================
// QUERIES
// ============================================

// Task select query with all joined data
const TASK_SELECT = `
  *,
  initiative:project_initiatives(
    id, title, area_id, is_personal,
    area:project_areas(
      id, name,
      function:project_functions(id, name, color)
    )
  ),
  owner:user_profiles!project_tasks_owner_id_fkey(id, full_name, avatar_url),
  assigned_user:user_profiles!project_tasks_assigned_to_fkey(id, full_name, avatar_url)
`;

/**
 * Fetch all tasks relevant to the current user:
 * - Tasks they own (owner_id)
 * - Tasks they created (created_by)
 * - Tasks assigned to them (via task_assignees or assigned_to)
 * - Tasks in functions they own
 */
export function useMyTodosQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-todos', user?.id],
    queryFn: async (): Promise<MyTasksData> => {
      if (!user) throw new Error('User not authenticated');

      // First, get functions the user owns
      let myFunctionIds: string[] = [];
      try {
        const { data: functionOwnership } = await supabase
          .from('project_function_owners')
          .select('function_id')
          .eq('user_id', user.id);
        myFunctionIds = (functionOwnership || []).map(f => f.function_id);
      } catch (e) {
        console.warn('Failed to fetch function ownership:', e);
      }

      // Fetch tasks owned by the user
      const { data: ownedByMe, error: ownedError } = await supabase
        .from('project_tasks')
        .select(TASK_SELECT)
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

      if (ownedError) {
        console.warn('owner_id query failed:', ownedError);
      }

      // Fetch tasks created by the user (may overlap with owned)
      const { data: createdByMe, error: createdError } = await supabase
        .from('project_tasks')
        .select(TASK_SELECT)
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false });

      if (createdError) {
        console.warn('created_by query failed:', createdError);
      }

      // Fetch tasks assigned to the user (via assigned_to)
      const { data: assignedToMe, error: assignedError } = await supabase
        .from('project_tasks')
        .select(TASK_SELECT)
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
              .select(TASK_SELECT)
              .in('id', additionalTaskIds);

            additionalAssignedTasks = additionalTasks || [];
          }
        }
      } catch (e) {
        console.warn('task_assignees query failed:', e);
      }

      // Fetch tasks assigned by user to others
      let assignedByMe: TaskWithDetails[] = [];
      try {
        const { data: assignedByMeLinks } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('assigned_by', user.id)
          .neq('user_id', user.id);

        if (assignedByMeLinks && assignedByMeLinks.length > 0) {
          const taskIds = [...new Set(assignedByMeLinks.map(a => a.task_id))];
          const { data: tasks } = await supabase
            .from('project_tasks')
            .select(TASK_SELECT)
            .in('id', taskIds);

          assignedByMe = tasks || [];
        }
      } catch (e) {
        console.warn('assigned_by query failed:', e);
      }

      // Merge all assigned tasks
      const allAssignedToMe = [...(assignedToMe || [])];
      additionalAssignedTasks.forEach(task => {
        if (!allAssignedToMe.some(t => t.id === task.id)) {
          allAssignedToMe.push(task);
        }
      });

      // Collect all unique task IDs
      const allTaskIds = new Set<string>();
      (ownedByMe || []).forEach(t => allTaskIds.add(t.id));
      (createdByMe || []).forEach(t => allTaskIds.add(t.id));
      allAssignedToMe.forEach(t => allTaskIds.add(t.id));
      assignedByMe.forEach(t => allTaskIds.add(t.id));

      // Fetch assignees for all tasks
      let assigneesMap: Record<string, TaskAssignee[]> = {};
      if (allTaskIds.size > 0) {
        try {
          const { data: allAssignees } = await supabase
            .from('task_assignees')
            .select(`
              *,
              user:user_profiles!task_assignees_user_id_fkey(id, full_name, avatar_url)
            `)
            .in('task_id', Array.from(allTaskIds));

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

      // Build task map with role indicators
      const taskMap = new Map<string, TaskWithDetails>();

      const processTask = (task: TaskWithDetails, roles: { isOwner?: boolean; isCreator?: boolean; isAssignee?: boolean }) => {
        const existing = taskMap.get(task.id);
        const functionId = task.initiative?.area?.function?.id;
        const isInMyFunction = functionId ? myFunctionIds.includes(functionId) : false;

        if (existing) {
          // Merge role indicators
          taskMap.set(task.id, {
            ...existing,
            isOwner: existing.isOwner || roles.isOwner || false,
            isCreator: existing.isCreator || roles.isCreator || false,
            isAssignee: existing.isAssignee || roles.isAssignee || false,
            isInMyFunction: existing.isInMyFunction || isInMyFunction,
          });
        } else {
          taskMap.set(task.id, {
            ...task,
            assignees: assigneesMap[task.id] || [],
            isOwner: roles.isOwner || task.owner_id === user.id || false,
            isCreator: roles.isCreator || task.created_by === user.id || false,
            isAssignee: roles.isAssignee || false,
            isInMyFunction,
          });
        }
      };

      // Process all task sources
      (ownedByMe || []).forEach(t => processTask(t, { isOwner: true }));
      (createdByMe || []).forEach(t => processTask(t, { isCreator: true }));
      allAssignedToMe.forEach(t => processTask(t, { isAssignee: true }));
      assignedByMe.forEach(t => processTask(t, {})); // Delegated tasks

      // Convert to array sorted by updated_at
      const tasks = Array.from(taskMap.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      // Also build legacy arrays for backwards compatibility
      const attachAssignees = (taskList: TaskWithDetails[]) =>
        taskList.map(task => ({
          ...task,
          assignees: assigneesMap[task.id] || [],
        }));

      return {
        tasks,
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
export function useMyTodosStats(): TaskStats {
  const { data } = useMyTodosQuery();

  if (!data) {
    return {
      totalTasks: 0,
      totalOwned: 0,
      totalAssigned: 0,
      totalInMyFunctions: 0,
      completedThisWeek: 0,
      overdueCount: 0,
      inProgressCount: 0,
      // Legacy
      totalCreated: 0,
      totalAssignedByMe: 0,
    };
  }

  const { tasks } = data;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count by role
  const totalOwned = tasks.filter(t => t.isOwner).length;
  const totalAssigned = tasks.filter(t => t.isAssignee).length;
  const totalInMyFunctions = tasks.filter(t => t.isInMyFunction && !t.isOwner && !t.isAssignee).length;

  const completedThisWeek = tasks.filter(task => {
    if (task.status !== 'done') return false;
    const completedAt = task.completed_at ? new Date(task.completed_at) : new Date(task.updated_at);
    return completedAt >= weekAgo;
  }).length;

  const inProgressCount = tasks.filter(task =>
    task.status === 'in_progress'
  ).length;

  const overdueCount = tasks.filter(task => {
    if (task.status === 'done') return false;
    if (!task.due_date) return false;
    return new Date(task.due_date) < now;
  }).length;

  return {
    totalTasks: tasks.length,
    totalOwned,
    totalAssigned,
    totalInMyFunctions,
    completedThisWeek,
    overdueCount,
    inProgressCount,
    // Legacy
    totalCreated: data.createdByMe.length,
    totalAssignedByMe: data.assignedByMe.length,
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

      // Create the task (owner defaults to creator)
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
          owner_id: user.id, // Owner defaults to creator
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

// ============================================
// TASK COMMENTS
// ============================================

/**
 * Fetch comments for a specific task
 */
export function useTaskCommentsQuery(taskId: string | null) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:user_profiles!task_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('task_comments query failed:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!taskId,
  });
}

/**
 * Add a comment to a task
 */
export function useAddTaskComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content,
        })
        .select(`
          *,
          user:user_profiles!task_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
    },
  });
}

/**
 * Delete a comment from a task
 */
export function useDeleteTaskComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { commentId, taskId };
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });
}

// ============================================
// TASK OWNER AND ASSIGNEES
// ============================================

/**
 * Transfer task ownership to another user
 */
export function useUpdateTaskOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, newOwnerId }: { taskId: string; newOwnerId: string }) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .update({ owner_id: newOwnerId, updated_at: new Date().toISOString() })
        .eq('id', taskId)
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
 * Add an assignee to a task
 */
export function useAddTaskAssignee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if already assigned
      const { data: existing } = await supabase
        .from('task_assignees')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        return existing; // Already assigned
      }

      const { data, error } = await supabase
        .from('task_assignees')
        .insert({
          task_id: taskId,
          user_id: userId,
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Also update assigned_to for backward compatibility (if first assignee)
      const { data: allAssignees } = await supabase
        .from('task_assignees')
        .select('id')
        .eq('task_id', taskId);

      if (allAssignees && allAssignees.length === 1) {
        await supabase
          .from('project_tasks')
          .update({ assigned_to: userId })
          .eq('id', taskId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
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

      // Update assigned_to for backward compatibility
      const { data: remainingAssignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', taskId)
        .limit(1);

      if (remainingAssignees && remainingAssignees.length > 0) {
        await supabase
          .from('project_tasks')
          .update({ assigned_to: remainingAssignees[0].user_id })
          .eq('id', taskId);
      } else {
        await supabase
          .from('project_tasks')
          .update({ assigned_to: null })
          .eq('id', taskId);
      }

      return { taskId, userId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}
