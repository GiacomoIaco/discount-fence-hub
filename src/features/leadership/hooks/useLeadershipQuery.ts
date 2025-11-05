import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  ProjectFunction,
  ProjectBucket,
  ProjectInitiative,
  ProjectWeeklyUpdate,
  ProjectActivity,
  FunctionWithAccess,
  InitiativeWithDetails,
  BucketWithInitiatives,
  CreateFunctionInput,
  UpdateFunctionInput,
  CreateBucketInput,
  UpdateBucketInput,
  CreateInitiativeInput,
  UpdateInitiativeInput,
  InitiativeFilters,
} from '../lib/leadership';

// ============================================
// QUERY KEYS
// ============================================

export const leadershipKeys = {
  all: ['leadership'] as const,
  functions: () => [...leadershipKeys.all, 'functions'] as const,
  function: (id: string) => [...leadershipKeys.functions(), id] as const,
  buckets: () => [...leadershipKeys.all, 'buckets'] as const,
  bucket: (id: string) => [...leadershipKeys.buckets(), id] as const,
  bucketsForFunction: (functionId: string) => [...leadershipKeys.buckets(), 'function', functionId] as const,
  initiatives: () => [...leadershipKeys.all, 'initiatives'] as const,
  initiative: (id: string) => [...leadershipKeys.initiatives(), id] as const,
  initiativesForBucket: (bucketId: string) => [...leadershipKeys.initiatives(), 'bucket', bucketId] as const,
  myInitiatives: () => [...leadershipKeys.initiatives(), 'my'] as const,
  highPriorityInitiatives: () => [...leadershipKeys.initiatives(), 'high-priority'] as const,
  weeklyUpdates: (initiativeId: string) => [...leadershipKeys.all, 'weekly-updates', initiativeId] as const,
  activity: (initiativeId: string) => [...leadershipKeys.all, 'activity', initiativeId] as const,
};

// ============================================
// FUNCTIONS QUERIES
// ============================================

/**
 * Fetch all functions the current user has access to
 */
export const useFunctionsQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.functions(),
    queryFn: async (): Promise<FunctionWithAccess[]> => {
      if (!user) throw new Error('User not authenticated');

      // Fetch functions with user's access level
      const { data: functions, error: functionsError } = await supabase
        .from('project_functions')
        .select(`
          *,
          user_access:project_function_access!inner(*)
        `)
        .eq('project_function_access.user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');

      if (functionsError) throw functionsError;

      // For each function, get counts
      const functionsWithCounts = await Promise.all(
        (functions || []).map(async (func: any) => {
          const { count: bucketCount } = await supabase
            .from('project_buckets')
            .select('*', { count: 'exact', head: true })
            .eq('function_id', func.id)
            .eq('is_active', true);

          const { count: initiativeCount } = await supabase
            .from('project_initiatives')
            .select('*', { count: 'exact', head: true })
            .eq('bucket_id', func.id)
            .is('archived_at', null);

          const { count: highPriorityCount } = await supabase
            .from('project_initiatives')
            .select('*', { count: 'exact', head: true })
            .eq('priority', 'high')
            .is('archived_at', null);

          return {
            ...func,
            user_access: func.user_access[0],
            bucket_count: bucketCount || 0,
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
  const { user } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.function(functionId!),
    queryFn: async (): Promise<FunctionWithAccess> => {
      if (!user || !functionId) throw new Error('Missing required parameters');

      const { data, error } = await supabase
        .from('project_functions')
        .select(`
          *,
          user_access:project_function_access!inner(*)
        `)
        .eq('id', functionId)
        .eq('project_function_access.user_id', user.id)
        .single();

      if (error) throw error;

      return {
        ...data,
        user_access: data.user_access[0],
      };
    },
    enabled: !!user && !!functionId,
  });
};

// ============================================
// BUCKETS QUERIES
// ============================================

/**
 * Fetch buckets for a specific function
 */
export const useBucketsQuery = (functionId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.bucketsForFunction(functionId!),
    queryFn: async (): Promise<ProjectBucket[]> => {
      if (!functionId) throw new Error('Function ID is required');

      const { data, error } = await supabase
        .from('project_buckets')
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
 * Fetch buckets with their initiatives
 */
export const useBucketsWithInitiativesQuery = (functionId?: string) => {
  return useQuery({
    queryKey: [...leadershipKeys.bucketsForFunction(functionId!), 'with-initiatives'],
    queryFn: async (): Promise<BucketWithInitiatives[]> => {
      if (!functionId) throw new Error('Function ID is required');

      const { data: buckets, error: bucketsError } = await supabase
        .from('project_buckets')
        .select('*')
        .eq('function_id', functionId)
        .eq('is_active', true)
        .order('sort_order');

      if (bucketsError) throw bucketsError;

      // Fetch initiatives for each bucket
      const bucketsWithInitiatives = await Promise.all(
        (buckets || []).map(async (bucket) => {
          const { data: initiatives, error: initiativesError } = await supabase
            .from('project_initiatives')
            .select('*')
            .eq('bucket_id', bucket.id)
            .is('archived_at', null)
            .order('sort_order');

          if (initiativesError) throw initiativesError;

          return {
            ...bucket,
            initiatives: initiatives || [],
            initiative_count: initiatives?.length || 0,
          };
        })
      );

      return bucketsWithInitiatives;
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
          bucket:project_buckets(*),
          assigned_user:user_profiles(id, full_name, avatar_url)
        `);

      // Apply filters
      if (filters.bucket_id) {
        query = query.eq('bucket_id', filters.bucket_id);
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
          bucket:project_buckets(*),
          assigned_user:user_profiles(id, full_name, avatar_url)
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
          bucket:project_buckets(*),
          assigned_user:user_profiles(id, full_name, avatar_url)
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
          bucket:project_buckets(
            *,
            function:project_functions(*)
          ),
          assigned_user:user_profiles(id, full_name, avatar_url)
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
// MUTATIONS - BUCKETS
// ============================================

export const useCreateBucket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBucketInput): Promise<ProjectBucket> => {
      const { data, error } = await supabase
        .from('project_buckets')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.bucketsForFunction(variables.function_id) });
    },
  });
};

export const useUpdateBucket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBucketInput): Promise<ProjectBucket> => {
      const { data, error } = await supabase
        .from('project_buckets')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.buckets() });
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
