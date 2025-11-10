import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  AnnualGoal,
  QuarterlyGoal,
  Task,
  InitiativeGoalLink,
  CreateAnnualGoalInput,
  UpdateAnnualGoalInput,
  CreateQuarterlyGoalInput,
  UpdateQuarterlyGoalInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateInitiativeGoalLinkInput,
  AnnualGoalWithQuarterly,
  QuarterlyGoalWithAnnual,
} from '../lib/goals.types';

// ============================================
// QUERY KEYS
// ============================================

export const goalsKeys = {
  all: ['goals'] as const,
  annualGoals: () => [...goalsKeys.all, 'annual'] as const,
  annualGoal: (id: string) => [...goalsKeys.annualGoals(), id] as const,
  annualGoalsForFunction: (functionId: string, year?: number) =>
    year
      ? [...goalsKeys.annualGoals(), 'function', functionId, year] as const
      : [...goalsKeys.annualGoals(), 'function', functionId] as const,
  quarterlyGoals: () => [...goalsKeys.all, 'quarterly'] as const,
  quarterlyGoal: (id: string) => [...goalsKeys.quarterlyGoals(), id] as const,
  quarterlyGoalsForAnnual: (annualGoalId: string) => [...goalsKeys.quarterlyGoals(), 'annual', annualGoalId] as const,
  quarterlyGoalsForPeriod: (year: number, quarter: number) => [...goalsKeys.quarterlyGoals(), 'period', year, quarter] as const,
  tasks: () => [...goalsKeys.all, 'tasks'] as const,
  task: (id: string) => [...goalsKeys.tasks(), id] as const,
  tasksForInitiative: (initiativeId: string) => [...goalsKeys.tasks(), 'initiative', initiativeId] as const,
  goalLinks: () => [...goalsKeys.all, 'goal-links'] as const,
  goalLinksForInitiative: (initiativeId: string) => [...goalsKeys.goalLinks(), 'initiative', initiativeId] as const,
  goalLinksForQuarterlyGoal: (quarterlyGoalId: string) => [...goalsKeys.goalLinks(), 'quarterly-goal', quarterlyGoalId] as const,
};

// ============================================
// ANNUAL GOALS QUERIES
// ============================================

/**
 * Fetch all annual goals for a function and year
 */
export const useAnnualGoalsQuery = (functionId?: string, year?: number) => {
  return useQuery({
    queryKey: goalsKeys.annualGoalsForFunction(functionId!, year),
    queryFn: async (): Promise<AnnualGoal[]> => {
      if (!functionId) throw new Error('Function ID is required');

      let query = supabase
        .from('project_annual_goals')
        .select('*')
        .eq('function_id', functionId)
        .order('sort_order');

      if (year) {
        query = query.eq('year', year);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Fetch single annual goal by ID with quarterly goals
 */
export const useAnnualGoalQuery = (goalId?: string) => {
  return useQuery({
    queryKey: goalsKeys.annualGoal(goalId!),
    queryFn: async (): Promise<AnnualGoalWithQuarterly> => {
      if (!goalId) throw new Error('Goal ID is required');

      const { data: goal, error: goalError } = await supabase
        .from('project_annual_goals')
        .select(`
          *,
          function:project_functions(id, name, color)
        `)
        .eq('id', goalId)
        .single();

      if (goalError) throw goalError;

      // Fetch quarterly goals
      const { data: quarterlyGoals, error: quarterlyError } = await supabase
        .from('project_quarterly_goals')
        .select('*')
        .eq('annual_goal_id', goalId)
        .order('quarter');

      if (quarterlyError) throw quarterlyError;

      return {
        ...goal,
        quarterly_goals: quarterlyGoals || [],
      };
    },
    enabled: !!goalId,
  });
};

/**
 * Fetch all annual goals for a function with quarterly breakdown
 */
export const useAnnualGoalsWithQuarterlyQuery = (functionId?: string, year?: number) => {
  return useQuery({
    queryKey: [...goalsKeys.annualGoalsForFunction(functionId!, year), 'with-quarterly'],
    queryFn: async (): Promise<AnnualGoalWithQuarterly[]> => {
      if (!functionId) throw new Error('Function ID is required');

      let query = supabase
        .from('project_annual_goals')
        .select('*')
        .eq('function_id', functionId)
        .order('sort_order');

      if (year) {
        query = query.eq('year', year);
      }

      const { data: goals, error: goalsError } = await query;

      if (goalsError) throw goalsError;

      // Fetch quarterly goals for each annual goal
      const goalsWithQuarterly = await Promise.all(
        (goals || []).map(async (goal) => {
          const { data: quarterlyGoals, error: quarterlyError } = await supabase
            .from('project_quarterly_goals')
            .select('*')
            .eq('annual_goal_id', goal.id)
            .order('quarter');

          if (quarterlyError) throw quarterlyError;

          return {
            ...goal,
            quarterly_goals: quarterlyGoals || [],
          };
        })
      );

      return goalsWithQuarterly;
    },
    enabled: !!functionId,
  });
};

// ============================================
// QUARTERLY GOALS QUERIES
// ============================================

/**
 * Fetch quarterly goals for an annual goal
 */
export const useQuarterlyGoalsQuery = (annualGoalId?: string) => {
  return useQuery({
    queryKey: goalsKeys.quarterlyGoalsForAnnual(annualGoalId!),
    queryFn: async (): Promise<QuarterlyGoal[]> => {
      if (!annualGoalId) throw new Error('Annual goal ID is required');

      const { data, error } = await supabase
        .from('project_quarterly_goals')
        .select('*')
        .eq('annual_goal_id', annualGoalId)
        .order('quarter');

      if (error) throw error;
      return data || [];
    },
    enabled: !!annualGoalId,
  });
};

/**
 * Fetch quarterly goals for a specific period (year + quarter)
 */
export const useQuarterlyGoalsForPeriodQuery = (year: number, quarter: number) => {
  return useQuery({
    queryKey: goalsKeys.quarterlyGoalsForPeriod(year, quarter),
    queryFn: async (): Promise<QuarterlyGoalWithAnnual[]> => {
      const { data, error } = await supabase
        .from('project_quarterly_goals')
        .select(`
          *,
          annual_goal:project_annual_goals(*)
        `)
        .eq('year', year)
        .eq('quarter', quarter);

      if (error) throw error;
      return data || [];
    },
  });
};

/**
 * Fetch single quarterly goal by ID with annual goal
 */
export const useQuarterlyGoalQuery = (goalId?: string) => {
  return useQuery({
    queryKey: goalsKeys.quarterlyGoal(goalId!),
    queryFn: async (): Promise<QuarterlyGoalWithAnnual> => {
      if (!goalId) throw new Error('Goal ID is required');

      const { data, error } = await supabase
        .from('project_quarterly_goals')
        .select(`
          *,
          annual_goal:project_annual_goals(*)
        `)
        .eq('id', goalId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!goalId,
  });
};

// ============================================
// TASKS QUERIES
// ============================================

/**
 * Fetch tasks for an initiative
 */
export const useTasksQuery = (initiativeId?: string) => {
  return useQuery({
    queryKey: goalsKeys.tasksForInitiative(initiativeId!),
    queryFn: async (): Promise<Task[]> => {
      if (!initiativeId) throw new Error('Initiative ID is required');

      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId,
  });
};

/**
 * Fetch single task by ID
 */
export const useTaskQuery = (taskId?: string) => {
  return useQuery({
    queryKey: goalsKeys.task(taskId!),
    queryFn: async (): Promise<Task> => {
      if (!taskId) throw new Error('Task ID is required');

      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
};

// ============================================
// INITIATIVE-GOAL LINKS QUERIES
// ============================================

/**
 * Fetch goal links for an initiative
 */
export const useInitiativeGoalLinksQuery = (initiativeId?: string) => {
  return useQuery({
    queryKey: goalsKeys.goalLinksForInitiative(initiativeId!),
    queryFn: async (): Promise<Array<InitiativeGoalLink & { quarterly_goal: QuarterlyGoalWithAnnual }>> => {
      if (!initiativeId) throw new Error('Initiative ID is required');

      const { data, error } = await supabase
        .from('initiative_goal_links')
        .select(`
          *,
          quarterly_goal:project_quarterly_goals(
            *,
            annual_goal:project_annual_goals(*)
          )
        `)
        .eq('initiative_id', initiativeId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId,
  });
};

/**
 * Fetch initiatives linked to a quarterly goal
 */
export const useGoalInitiativesQuery = (quarterlyGoalId?: string) => {
  return useQuery({
    queryKey: goalsKeys.goalLinksForQuarterlyGoal(quarterlyGoalId!),
    queryFn: async (): Promise<Array<InitiativeGoalLink & { initiative: any }>> => {
      if (!quarterlyGoalId) throw new Error('Quarterly goal ID is required');

      const { data, error } = await supabase
        .from('initiative_goal_links')
        .select(`
          *,
          initiative:project_initiatives(*)
        `)
        .eq('quarterly_goal_id', quarterlyGoalId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!quarterlyGoalId,
  });
};

// ============================================
// MUTATIONS - ANNUAL GOALS
// ============================================

export const useCreateAnnualGoal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateAnnualGoalInput): Promise<AnnualGoal> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_annual_goals')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoalsForFunction(variables.function_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoals() });
    },
  });
};

export const useUpdateAnnualGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAnnualGoalInput): Promise<AnnualGoal> => {
      const { data, error } = await supabase
        .from('project_annual_goals')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoal(data.id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoalsForFunction(data.function_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoals() });
    },
  });
};

export const useDeleteAnnualGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string): Promise<void> => {
      const { error } = await supabase
        .from('project_annual_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoals() });
    },
  });
};

// ============================================
// MUTATIONS - QUARTERLY GOALS
// ============================================

export const useCreateQuarterlyGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateQuarterlyGoalInput): Promise<QuarterlyGoal> => {
      const { data, error } = await supabase
        .from('project_quarterly_goals')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoalsForAnnual(data.annual_goal_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoal(data.annual_goal_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoals() });
    },
  });
};

export const useUpdateQuarterlyGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateQuarterlyGoalInput): Promise<QuarterlyGoal> => {
      const { data, error } = await supabase
        .from('project_quarterly_goals')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoal(data.id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoalsForAnnual(data.annual_goal_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.annualGoal(data.annual_goal_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoals() });
    },
  });
};

export const useDeleteQuarterlyGoal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string): Promise<void> => {
      const { error } = await supabase
        .from('project_quarterly_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.quarterlyGoals() });
    },
  });
};

// ============================================
// MUTATIONS - TASKS
// ============================================

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.tasksForInitiative(data.initiative_id) });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTaskInput): Promise<Task> => {
      // If status is changing to 'done', set completed_at
      const updateData: any = { ...input };
      if (input.status) {
        if (input.status === 'done') {
          updateData.completed_at = new Date().toISOString();
        } else {
          updateData.completed_at = null;
        }
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.task(data.id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.tasksForInitiative(data.initiative_id) });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string): Promise<void> => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.tasks() });
    },
  });
};

// ============================================
// MUTATIONS - INITIATIVE-GOAL LINKS
// ============================================

export const useCreateInitiativeGoalLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInitiativeGoalLinkInput): Promise<InitiativeGoalLink> => {
      const { data, error } = await supabase
        .from('initiative_goal_links')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.goalLinksForInitiative(data.initiative_id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.goalLinksForQuarterlyGoal(data.quarterly_goal_id) });
    },
  });
};

export const useDeleteInitiativeGoalLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string): Promise<void> => {
      const { error } = await supabase
        .from('initiative_goal_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.goalLinks() });
    },
  });
};
