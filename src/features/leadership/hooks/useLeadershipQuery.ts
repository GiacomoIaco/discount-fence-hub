import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  ProjectFunction,
  ProjectArea,
  ProjectInitiative,
  ProjectWeeklyUpdate,
  ProjectActivity,
  FunctionWithAccess,
  InitiativeWithDetails,
  AreaWithInitiatives,
  CreateFunctionInput,
  UpdateFunctionInput,
  CreateAreaInput,
  UpdateAreaInput,
  CreateInitiativeInput,
  UpdateInitiativeInput,
  InitiativeFilters,
  FunctionStrategy,
  StrategyComment,
  CreateStrategyInput,
  CreateCommentInput,
  UpdateCommentInput,
} from '../lib/leadership';

// ============================================
// QUERY KEYS
// ============================================

export const leadershipKeys = {
  all: ['leadership'] as const,
  functions: () => [...leadershipKeys.all, 'functions'] as const,
  function: (id: string) => [...leadershipKeys.functions(), id] as const,
  areas: () => [...leadershipKeys.all, 'areas'] as const,
  area: (id: string) => [...leadershipKeys.areas(), id] as const,
  areasForFunction: (functionId: string) => [...leadershipKeys.areas(), 'function', functionId] as const,
  initiatives: () => [...leadershipKeys.all, 'initiatives'] as const,
  initiative: (id: string) => [...leadershipKeys.initiatives(), id] as const,
  initiativesForArea: (areaId: string) => [...leadershipKeys.initiatives(), 'area', areaId] as const,
  myInitiatives: () => [...leadershipKeys.initiatives(), 'my'] as const,
  highPriorityInitiatives: () => [...leadershipKeys.initiatives(), 'high-priority'] as const,
  weeklyUpdates: (initiativeId: string) => [...leadershipKeys.all, 'weekly-updates', initiativeId] as const,
  activity: (initiativeId: string) => [...leadershipKeys.all, 'activity', initiativeId] as const,
  strategy: (functionId: string) => [...leadershipKeys.all, 'strategy', functionId] as const,
  comments: (functionId: string) => [...leadershipKeys.all, 'comments', functionId] as const,
};

// ============================================
// FUNCTIONS QUERIES
// ============================================

/**
 * Fetch all functions the current user has access to
 */
export const useFunctionsQuery = () => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.functions(),
    queryFn: async (): Promise<FunctionWithAccess[]> => {
      if (!user) throw new Error('User not authenticated');

      const isAdmin = profile?.role === 'admin';

      // Admins see all functions, others see only functions they have access to
      let query = supabase
        .from('project_functions')
        .select(`
          *,
          user_access:project_function_access(*)
        `)
        .eq('is_active', true)
        .order('sort_order');

      // Non-admins: filter by user access
      if (!isAdmin) {
        query = query.eq('project_function_access.user_id', user.id);
      }

      const { data: functions, error: functionsError } = await query;

      if (functionsError) throw functionsError;

      // For each function, get counts
      const functionsWithCounts = await Promise.all(
        (functions || []).map(async (func: any) => {
          const { count: areaCount } = await supabase
            .from('project_areas')
            .select('*', { count: 'exact', head: true })
            .eq('function_id', func.id)
            .eq('is_active', true);

          const { count: initiativeCount } = await supabase
            .from('project_initiatives')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', func.id)
            .is('archived_at', null);

          const { count: highPriorityCount } = await supabase
            .from('project_initiatives')
            .select('*', { count: 'exact', head: true })
            .eq('priority', 'high')
            .is('archived_at', null);

          return {
            ...func,
            user_access: func.user_access?.[0] || (isAdmin ? { role: 'admin' } : undefined),
            area_count: areaCount || 0,
            initiative_count: initiativeCount || 0,
            high_priority_count: highPriorityCount || 0,
          };
        })
      );

      return functionsWithCounts;
    },
    enabled: !!user,
  });
};

/**
 * Fetch single function by ID
 */
export const useFunctionQuery = (functionId?: string) => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.function(functionId!),
    queryFn: async (): Promise<FunctionWithAccess> => {
      if (!user || !functionId) throw new Error('Missing required parameters');

      const isAdmin = profile?.role === 'admin';

      const { data, error } = await supabase
        .from('project_functions')
        .select(`
          *,
          user_access:project_function_access(*)
        `)
        .eq('id', functionId)
        .single();

      if (error) throw error;

      // Check if user has access (either admin or has explicit access)
      const hasAccess = isAdmin || data.user_access?.some((access: any) => access.user_id === user.id);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      return {
        ...data,
        user_access: data.user_access?.find((access: any) => access.user_id === user.id) || (isAdmin ? { role: 'admin' } : undefined),
      };
    },
    enabled: !!user && !!functionId,
  });
};

// ============================================
// AREAS QUERIES
// ============================================

/**
 * Fetch areas for a specific function
 */
export const useAreasQuery = (functionId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.areasForFunction(functionId!),
    queryFn: async (): Promise<ProjectArea[]> => {
      if (!functionId) throw new Error('Function ID is required');

      const { data, error } = await supabase
        .from('project_areas')
        .select('*')
        .eq('function_id', functionId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Fetch areas with their initiatives
 */
export const useAreasWithInitiativesQuery = (functionId?: string) => {
  return useQuery({
    queryKey: [...leadershipKeys.areasForFunction(functionId!), 'with-initiatives'],
    queryFn: async (): Promise<AreaWithInitiatives[]> => {
      if (!functionId) throw new Error('Function ID is required');

      const { data: areas, error: areasError } = await supabase
        .from('project_areas')
        .select('*')
        .eq('function_id', functionId)
        .eq('is_active', true)
        .order('sort_order');

      if (areasError) throw areasError;

      // Fetch initiatives for each area
      const areasWithInitiatives = await Promise.all(
        (areas || []).map(async (area) => {
          const { data: initiatives, error: initiativesError } = await supabase
            .from('project_initiatives')
            .select('*, area:project_areas(*)')
            .eq('area_id', area.id)
            .is('archived_at', null)
            .order('sort_order');

          if (initiativesError) throw initiativesError;

          return {
            ...area,
            initiatives: initiatives || [],
            initiative_count: initiatives?.length || 0,
          };
        })
      );

      return areasWithInitiatives;
    },
    enabled: !!functionId,
  });
};

// ============================================
// INITIATIVES QUERIES
// ============================================

/**
 * Fetch initiatives with filters
 */
export const useInitiativesQuery = (filters: InitiativeFilters = {}) => {
  return useQuery({
    queryKey: [...leadershipKeys.initiatives(), filters],
    queryFn: async (): Promise<InitiativeWithDetails[]> => {
      let query = supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(*),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `);

      // Apply filters
      if (filters.area_id) {
        query = query.eq('area_id', filters.area_id);
      }

      if (filters.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.priority) {
        if (Array.isArray(filters.priority)) {
          query = query.in('priority', filters.priority);
        } else {
          query = query.eq('priority', filters.priority);
        }
      }

      if (filters.color_status) {
        if (Array.isArray(filters.color_status)) {
          query = query.in('color_status', filters.color_status);
        } else {
          query = query.eq('color_status', filters.color_status);
        }
      }

      if (!filters.include_archived) {
        query = query.is('archived_at', null);
      }

      query = query.order('sort_order');

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
};

/**
 * Fetch single initiative by ID
 */
export const useInitiativeQuery = (initiativeId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.initiative(initiativeId!),
    queryFn: async (): Promise<InitiativeWithDetails> => {
      if (!initiativeId) throw new Error('Initiative ID is required');

      const { data, error } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(*),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('id', initiativeId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!initiativeId,
  });
};

/**
 * Fetch initiatives by function ID
 */
export const useInitiativesByFunctionQuery = (functionId: string) => {
  return useQuery({
    queryKey: [...leadershipKeys.initiatives(), 'function', functionId],
    queryFn: async (): Promise<InitiativeWithDetails[]> => {
      // First get all areas for this function
      const { data: areas, error: areasError } = await supabase
        .from('project_areas')
        .select('id')
        .eq('function_id', functionId);

      if (areasError) throw areasError;

      const areaIds = areas?.map(a => a.id) || [];

      if (areaIds.length === 0) {
        return [];
      }

      // Then get all initiatives for those areas
      const { data, error } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .in('area_id', areaIds)
        .is('archived_at', null)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Fetch initiatives assigned to current user
 */
export const useMyInitiativesQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.myInitiatives(),
    queryFn: async (): Promise<InitiativeWithDetails[]> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(*),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('assigned_to', user.id)
        .is('archived_at', null)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

/**
 * Fetch all high priority initiatives (admin only)
 */
export const useHighPriorityInitiativesQuery = () => {
  return useQuery({
    queryKey: leadershipKeys.highPriorityInitiatives(),
    queryFn: async (): Promise<InitiativeWithDetails[]> => {
      const { data, error } = await supabase
        .from('project_initiatives')
        .select(`
          *,
          area:project_areas(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles!project_initiatives_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .eq('priority', 'high')
        .is('archived_at', null)
        .order('color_status', { ascending: false }) // Red first
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
  });
};

// ============================================
// WEEKLY UPDATES QUERIES
// ============================================

/**
 * Fetch weekly updates for an initiative
 */
export const useWeeklyUpdatesQuery = (initiativeId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.weeklyUpdates(initiativeId!),
    queryFn: async (): Promise<ProjectWeeklyUpdate[]> => {
      if (!initiativeId) throw new Error('Initiative ID is required');

      const { data, error } = await supabase
        .from('project_weekly_updates')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId,
  });
};

// ============================================
// ACTIVITY QUERIES
// ============================================

/**
 * Fetch activity log for an initiative
 */
export const useActivityQuery = (initiativeId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.activity(initiativeId!),
    queryFn: async (): Promise<ProjectActivity[]> => {
      if (!initiativeId) throw new Error('Initiative ID is required');

      const { data, error } = await supabase
        .from('project_activity')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId,
  });
};

// ============================================
// MUTATIONS - FUNCTIONS
// ============================================

export const useCreateFunction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateFunctionInput): Promise<ProjectFunction> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_functions')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.functions() });
    },
  });
};

export const useUpdateFunction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateFunctionInput): Promise<ProjectFunction> => {
      const { data, error } = await supabase
        .from('project_functions')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.functions() });
    },
  });
};

// ============================================
// MUTATIONS - AREAS
// ============================================

export const useCreateArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAreaInput): Promise<ProjectArea> => {
      const { data, error } = await supabase
        .from('project_areas')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areasForFunction(variables.function_id) });
    },
  });
};

export const useUpdateArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAreaInput): Promise<ProjectArea> => {
      const { data, error } = await supabase
        .from('project_areas')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areas() });
    },
  });
};

// ============================================
// MUTATIONS - INITIATIVES
// ============================================

export const useCreateInitiative = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInitiativeInput): Promise<ProjectInitiative> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_initiatives')
        .insert({
          ...input,
          // Provide defaults for required fields if not provided
          status: input.status || 'not_started',
          priority: input.priority || 'medium',
          progress_percent: input.progress_percent ?? 0,
          color_status: 'green', // Default to green for new initiatives
          sort_order: 0, // Will be updated if needed
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiatives() });
    },
  });
};

export const useUpdateInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateInitiativeInput): Promise<ProjectInitiative> => {
      const { data, error } = await supabase
        .from('project_initiatives')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiatives() });
    },
  });
};

// ============================================
// STRATEGY QUERIES & MUTATIONS
// ============================================

/**
 * Fetch strategy for a function
 */
export const useFunctionStrategyQuery = (functionId: string) => {
  return useQuery({
    queryKey: leadershipKeys.strategy(functionId),
    queryFn: async (): Promise<FunctionStrategy | null> => {
      const { data, error } = await supabase
        .from('function_strategy')
        .select('*')
        .eq('function_id', functionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!functionId,
  });
};

/**
 * Create or update function strategy (upsert)
 */
export const useSaveStrategy = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateStrategyInput): Promise<FunctionStrategy> => {
      if (!user) throw new Error('User not authenticated');

      // Try to update first
      const { data: existing } = await supabase
        .from('function_strategy')
        .select('id')
        .eq('function_id', input.function_id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('function_strategy')
          .update({
            ...input,
            updated_by: user.id,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('function_strategy')
          .insert({
            ...input,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.strategy(data.function_id) });
    },
  });
};

// ============================================
// STRATEGY COMMENTS QUERIES & MUTATIONS
// ============================================

/**
 * Fetch comments for a function's strategy
 */
export const useStrategyCommentsQuery = (functionId: string) => {
  return useQuery({
    queryKey: leadershipKeys.comments(functionId),
    queryFn: async (): Promise<StrategyComment[]> => {
      const { data, error } = await supabase
        .from('strategy_comments')
        .select(`
          *,
          author:user_profiles!strategy_comments_created_by_fkey(id, full_name, avatar_url)
        `)
        .eq('function_id', functionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Create a new comment
 */
export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCommentInput): Promise<StrategyComment> => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('strategy_comments')
        .insert({
          ...input,
          created_by: user.id,
        })
        .select(`
          *,
          author:user_profiles!strategy_comments_created_by_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.comments(data.function_id) });
    },
  });
};

/**
 * Update a comment
 */
export const useUpdateComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, function_id, ...input }: UpdateCommentInput & { function_id: string }): Promise<StrategyComment> => {
      const { data, error } = await supabase
        .from('strategy_comments')
        .update(input)
        .eq('id', id)
        .select(`
          *,
          author:user_profiles!strategy_comments_created_by_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.comments(variables.function_id) });
    },
  });
};

/**
 * Delete a comment
 */
export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; function_id: string }): Promise<void> => {
      const { error } = await supabase
        .from('strategy_comments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.comments(variables.function_id) });
    },
  });
};
