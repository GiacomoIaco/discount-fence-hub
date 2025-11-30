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
  InitiativeAnnualAction,
  InitiativeAnnualTarget,
  InitiativeUpdate,
  InitiativeQuarterlyObjective,
  CreateAnnualActionInput,
  UpdateAnnualActionInput,
  CreateAnnualTargetInput,
  UpdateAnnualTargetInput,
  CreateInitiativeUpdateInput,
  UpdateInitiativeUpdateInput,
  CreateQuarterlyObjectiveInput,
  UpdateQuarterlyObjectiveInput,
  AnnualPlanStatus,
  FinalizePlanInput,
  ApprovePlanInput,
  RejectPlanInput,
  ReopenPlanInput,
  WeekLock,
} from '../lib/leadership';

// ============================================
// QUERY KEYS
// ============================================

export const leadershipKeys = {
  all: ['leadership'] as const,
  functions: () => [...leadershipKeys.all, 'functions'] as const,
  function: (id: string) => [...leadershipKeys.functions(), id] as const,
  functionOwners: (functionId: string) => [...leadershipKeys.function(functionId), 'owners'] as const,
  functionMembers: (functionId: string) => [...leadershipKeys.function(functionId), 'members'] as const,
  userFunctionAccess: (userId: string) => [...leadershipKeys.all, 'user-function-access', userId] as const,
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
  annualActions: (initiativeId: string, year: number) => [...leadershipKeys.all, 'annual-actions', initiativeId, year] as const,
  annualTargets: (initiativeId: string, year: number) => [...leadershipKeys.all, 'annual-targets', initiativeId, year] as const,
  initiativeUpdates: (initiativeId: string) => [...leadershipKeys.all, 'initiative-updates', initiativeId] as const,
  quarterlyObjectives: (initiativeId: string, year: number) => [...leadershipKeys.all, 'quarterly-objectives', initiativeId, year] as const,
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
// FUNCTION OWNERS QUERIES
// ============================================

export interface FunctionOwner {
  id: string;
  function_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  user_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
}

/**
 * Fetch owners for a specific function
 */
export const useFunctionOwnersQuery = (functionId?: string) => {
  return useQuery({
    queryKey: [...leadershipKeys.function(functionId!), 'owners'],
    queryFn: async (): Promise<FunctionOwner[]> => {
      if (!functionId) throw new Error('Function ID is required');

      console.log('[useFunctionOwnersQuery] Fetching owners for function:', functionId);

      const { data, error } = await supabase
        .from('project_function_owners')
        .select(`
          *,
          user_profile:user_profiles(id, full_name, email)
        `)
        .eq('function_id', functionId);

      if (error) {
        console.error('[useFunctionOwnersQuery] Error fetching owners:', error);
        throw error;
      }

      console.log('[useFunctionOwnersQuery] Owners data:', data);
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Add an owner to a function
 */
export const useAddFunctionOwner = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ functionId, userId }: { functionId: string; userId: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_function_owners')
        .insert({
          function_id: functionId,
          user_id: userId,
          added_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.function(variables.functionId) });
    },
  });
};

/**
 * Remove an owner from a function
 */
export const useRemoveFunctionOwner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, functionId }: { id: string; functionId: string }) => {
      const { error } = await supabase
        .from('project_function_owners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, functionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.function(data.functionId) });
    },
  });
};

// ============================================
// FUNCTION MEMBERS QUERIES
// ============================================

export interface FunctionMember {
  id: string;
  function_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

/**
 * Fetch members for a specific function
 */
export const useFunctionMembersQuery = (functionId?: string) => {
  return useQuery({
    queryKey: leadershipKeys.functionMembers(functionId!),
    queryFn: async (): Promise<FunctionMember[]> => {
      if (!functionId) throw new Error('Function ID is required');

      const { data, error } = await supabase
        .from('project_function_members')
        .select(`
          *,
          user_profile:user_profiles(id, full_name, email, avatar_url)
        `)
        .eq('function_id', functionId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!functionId,
  });
};

/**
 * Add a member to a function
 */
export const useAddFunctionMember = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ functionId, userId }: { functionId: string; userId: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('project_function_members')
        .insert({
          function_id: functionId,
          user_id: userId,
          added_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.functionMembers(variables.functionId) });
      queryClient.invalidateQueries({ queryKey: leadershipKeys.userFunctionAccess(variables.userId) });
    },
  });
};

/**
 * Remove a member from a function
 */
export const useRemoveFunctionMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, functionId, userId }: { id: string; functionId: string; userId?: string }) => {
      const { error } = await supabase
        .from('project_function_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, functionId, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.functionMembers(data.functionId) });
      if (data.userId) {
        queryClient.invalidateQueries({ queryKey: leadershipKeys.userFunctionAccess(data.userId) });
      }
    },
  });
};

// ============================================
// USER FUNCTION ACCESS QUERY
// ============================================

export interface UserFunctionAccess {
  isSuperAdmin: boolean;
  ownedFunctions: ProjectFunction[];
  memberFunctions: ProjectFunction[];
  allAccessibleFunctions: ProjectFunction[];
}

/**
 * Get all functions a user has access to (as owner or member)
 * Used to determine Leadership Hub access and My Todos Team View scope
 */
export const useUserFunctionAccess = () => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: leadershipKeys.userFunctionAccess(user?.id || ''),
    queryFn: async (): Promise<UserFunctionAccess> => {
      if (!user) throw new Error('Not authenticated');

      const isSuperAdmin = profile?.is_super_admin === true;

      if (isSuperAdmin) {
        // Super admin has access to all functions
        const { data } = await supabase
          .from('project_functions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        return {
          isSuperAdmin: true,
          ownedFunctions: data || [],
          memberFunctions: [],
          allAccessibleFunctions: data || [],
        };
      }

      // Get owned functions
      const { data: ownedData } = await supabase
        .from('project_function_owners')
        .select('function:project_functions(*)')
        .eq('user_id', user.id);

      const ownedFunctions = (ownedData || [])
        .map((d: any) => d.function)
        .filter((f: any) => f?.is_active) as ProjectFunction[];

      // Get member functions (exclude functions user already owns)
      const { data: memberData } = await supabase
        .from('project_function_members')
        .select('function:project_functions(*)')
        .eq('user_id', user.id);

      const ownedFunctionIds = ownedFunctions.map(f => f.id);
      const memberFunctions = (memberData || [])
        .map((d: any) => d.function)
        .filter((f: any) => f?.is_active && !ownedFunctionIds.includes(f.id)) as ProjectFunction[];

      return {
        isSuperAdmin: false,
        ownedFunctions,
        memberFunctions,
        allAccessibleFunctions: [...ownedFunctions, ...memberFunctions],
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
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
      queryClient.invalidateQueries({ queryKey: leadershipKeys.functions() }); // Update area counts
    },
  });
};

export const useUpdateArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAreaInput): Promise<ProjectArea> => {
      const { data, error} = await supabase
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

export const useDeleteArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // First, delete all initiatives in this area (which will cascade to quarterly objectives)
      const { error: initiativesError } = await supabase
        .from('project_initiatives')
        .delete()
        .eq('area_id', id);

      if (initiativesError) throw initiativesError;

      // Then delete the area itself
      const { error: areaError } = await supabase
        .from('project_areas')
        .delete()
        .eq('id', id);

      if (areaError) throw areaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areas() });
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiatives() });
    },
  });
};

/**
 * Deactivate an area (only if all initiatives are inactive)
 */
export const useDeactivateArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Check if area can be deactivated using the database function
      const { data: canDeactivate, error: checkError } = await supabase
        .rpc('can_deactivate_area', { p_area_id: id });

      if (checkError) throw checkError;

      if (!canDeactivate) {
        throw new Error('Cannot deactivate area: some initiatives are still active');
      }

      // Deactivate the area
      const { error: updateError } = await supabase
        .from('project_areas')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areas() });
    },
  });
};

/**
 * Activate an area
 */
export const useActivateArea = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('project_areas')
        .update({
          is_active: true,
          deactivated_at: null,
        })
        .eq('id', id);

      if (error) throw error;
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

/**
 * Deactivate an initiative
 */
export const useDeactivateInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('project_initiatives')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areas() });
    },
  });
};

/**
 * Activate an initiative
 */
export const useActivateInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('project_initiatives')
        .update({
          is_active: true,
          deactivated_at: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiatives() });
      queryClient.invalidateQueries({ queryKey: leadershipKeys.areas() });
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

// ============================================
// ANNUAL PLANNING QUERIES & MUTATIONS
// ============================================

/**
 * Fetch annual actions for an initiative in a specific year
 */
export const useAnnualActionsQuery = (initiativeId: string, year: number) => {
  return useQuery({
    queryKey: leadershipKeys.annualActions(initiativeId, year),
    queryFn: async (): Promise<InitiativeAnnualAction[]> => {
      const { data, error } = await supabase
        .from('initiative_annual_actions')
        .select('*')
        .eq('initiative_id', initiativeId)
        .eq('year', year)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId && !!year,
  });
};

/**
 * Fetch annual targets for an initiative in a specific year
 */
export const useAnnualTargetsQuery = (initiativeId: string, year: number) => {
  return useQuery({
    queryKey: leadershipKeys.annualTargets(initiativeId, year),
    queryFn: async (): Promise<InitiativeAnnualTarget[]> => {
      const { data, error } = await supabase
        .from('initiative_annual_targets')
        .select('*')
        .eq('initiative_id', initiativeId)
        .eq('year', year)
        .order('sort_order');

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId && !!year,
  });
};

/**
 * Fetch all annual actions for a function's initiatives in a specific year
 */
export const useAllAnnualActionsByFunctionQuery = (functionId: string, year: number) => {
  return useQuery({
    queryKey: [...leadershipKeys.all, 'function-actions', functionId, year],
    queryFn: async (): Promise<Record<string, InitiativeAnnualAction[]>> => {
      // First get all areas for this function
      const { data: areas } = await supabase
        .from('project_areas')
        .select('id')
        .eq('function_id', functionId);

      const areaIds = areas?.map(a => a.id) || [];
      if (areaIds.length === 0) return {};

      // Get all initiatives for those areas
      const { data: initiatives } = await supabase
        .from('project_initiatives')
        .select('id')
        .in('area_id', areaIds);

      const initiativeIds = initiatives?.map(i => i.id) || [];
      if (initiativeIds.length === 0) return {};

      // Get all actions for those initiatives
      const { data, error } = await supabase
        .from('initiative_annual_actions')
        .select('*')
        .in('initiative_id', initiativeIds)
        .eq('year', year)
        .order('sort_order');

      if (error) throw error;

      // Group by initiative_id
      const actionsByInitiative: Record<string, InitiativeAnnualAction[]> = {};
      (data || []).forEach(action => {
        if (!actionsByInitiative[action.initiative_id]) {
          actionsByInitiative[action.initiative_id] = [];
        }
        actionsByInitiative[action.initiative_id].push(action);
      });

      return actionsByInitiative;
    },
    enabled: !!functionId && !!year,
  });
};

/**
 * Fetch all annual targets for a function's initiatives in a specific year
 */
export const useAllAnnualTargetsByFunctionQuery = (functionId: string, year: number) => {
  return useQuery({
    queryKey: [...leadershipKeys.all, 'function-targets', functionId, year],
    queryFn: async (): Promise<Record<string, InitiativeAnnualTarget[]>> => {
      // First get all areas for this function
      const { data: areas } = await supabase
        .from('project_areas')
        .select('id')
        .eq('function_id', functionId);

      const areaIds = areas?.map(a => a.id) || [];
      if (areaIds.length === 0) return {};

      // Get all initiatives for those areas
      const { data: initiatives } = await supabase
        .from('project_initiatives')
        .select('id')
        .in('area_id', areaIds);

      const initiativeIds = initiatives?.map(i => i.id) || [];
      if (initiativeIds.length === 0) return {};

      // Get all targets for those initiatives
      const { data, error } = await supabase
        .from('initiative_annual_targets')
        .select('*')
        .in('initiative_id', initiativeIds)
        .eq('year', year)
        .order('sort_order');

      if (error) throw error;

      // Group by initiative_id
      const targetsByInitiative: Record<string, InitiativeAnnualTarget[]> = {};
      (data || []).forEach(target => {
        if (!targetsByInitiative[target.initiative_id]) {
          targetsByInitiative[target.initiative_id] = [];
        }
        targetsByInitiative[target.initiative_id].push(target);
      });

      return targetsByInitiative;
    },
    enabled: !!functionId && !!year,
  });
};

/**
 * Create annual action
 */
export const useCreateAnnualAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnualActionInput & { function_id: string }): Promise<InitiativeAnnualAction> => {
      const { function_id, ...actionInput } = input;
      const { data, error } = await supabase
        .from('initiative_annual_actions')
        .insert(actionInput)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all actions
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-actions', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualActions(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Update annual action
 */
export const useUpdateAnnualAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, function_id, ...input }: UpdateAnnualActionInput & { initiative_id: string; year: number; function_id: string }): Promise<InitiativeAnnualAction> => {
      const { data, error } = await supabase
        .from('initiative_annual_actions')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all actions
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-actions', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualActions(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Delete annual action
 */
export const useDeleteAnnualAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; initiative_id: string; year: number; function_id: string }): Promise<void> => {
      const { error } = await supabase
        .from('initiative_annual_actions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all actions
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-actions', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualActions(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Create annual target
 */
export const useCreateAnnualTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnualTargetInput & { function_id: string }): Promise<InitiativeAnnualTarget> => {
      const { function_id, ...targetInput } = input;
      const { data, error } = await supabase
        .from('initiative_annual_targets')
        .insert(targetInput)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all targets
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-targets', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualTargets(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Update annual target
 */
export const useUpdateAnnualTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, function_id, ...input }: UpdateAnnualTargetInput & { initiative_id: string; year: number; function_id: string }): Promise<InitiativeAnnualTarget> => {
      const { data, error } = await supabase
        .from('initiative_annual_targets')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all targets
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-targets', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualTargets(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Delete annual target
 */
export const useDeleteAnnualTarget = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; initiative_id: string; year: number; function_id: string }): Promise<void> => {
      const { error } = await supabase
        .from('initiative_annual_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate the function-level query that fetches all targets
      queryClient.invalidateQueries({
        queryKey: [...leadershipKeys.all, 'function-targets', variables.function_id, variables.year]
      });
      // Also invalidate the individual initiative query for backwards compatibility
      queryClient.invalidateQueries({ queryKey: leadershipKeys.annualTargets(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Fetch initiative updates (timeline)
 */
export const useInitiativeUpdatesQuery = (initiativeId: string) => {
  return useQuery({
    queryKey: leadershipKeys.initiativeUpdates(initiativeId),
    queryFn: async (): Promise<InitiativeUpdate[]> => {
      // First get the updates
      const { data: updates, error } = await supabase
        .from('initiative_updates')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      if (!updates || updates.length === 0) return [];

      // Then fetch author info separately
      const authorIds = [...new Set(updates.map(u => u.created_by).filter(Boolean))];
      if (authorIds.length === 0) return updates;

      const { data: authors } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds);

      const authorsMap = new Map(authors?.map(a => [a.id, a]) || []);

      return updates.map(update => ({
        ...update,
        author: update.created_by ? authorsMap.get(update.created_by) || null : null,
      }));
    },
    enabled: !!initiativeId,
  });
};

/**
 * Create initiative update
 */
export const useCreateInitiativeUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInitiativeUpdateInput): Promise<InitiativeUpdate> => {
      const { data, error } = await supabase
        .from('initiative_updates')
        .insert(input)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiativeUpdates(variables.initiative_id) });
    },
  });
};

/**
 * Update initiative update
 */
export const useUpdateInitiativeUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateInitiativeUpdateInput & { initiative_id: string }): Promise<InitiativeUpdate> => {
      const { data, error } = await supabase
        .from('initiative_updates')
        .update(input)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiativeUpdates(variables.initiative_id) });
    },
  });
};

/**
 * Delete initiative update
 */
export const useDeleteInitiativeUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; initiative_id: string }): Promise<void> => {
      const { error } = await supabase
        .from('initiative_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.initiativeUpdates(variables.initiative_id) });
    },
  });
};

/**
 * Fetch quarterly objectives for an initiative in a specific year
 */
export const useQuarterlyObjectivesQuery = (initiativeId: string, year: number) => {
  return useQuery({
    queryKey: leadershipKeys.quarterlyObjectives(initiativeId, year),
    queryFn: async (): Promise<InitiativeQuarterlyObjective[]> => {
      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .select('*')
        .eq('initiative_id', initiativeId)
        .eq('year', year)
        .order('quarter');

      if (error) throw error;
      return data || [];
    },
    enabled: !!initiativeId && !!year,
  });
};

/**
 * Create quarterly objective
 */
export const useCreateQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateQuarterlyObjectiveInput): Promise<InitiativeQuarterlyObjective> => {
      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.quarterlyObjectives(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Update quarterly objective
 */
export const useUpdateQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateQuarterlyObjectiveInput & { initiative_id: string; year: number }): Promise<InitiativeQuarterlyObjective> => {
      const { data, error } = await supabase
        .from('initiative_quarterly_objectives')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.quarterlyObjectives(variables.initiative_id, variables.year) });
    },
  });
};

/**
 * Delete quarterly objective
 */
export const useDeleteQuarterlyObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; initiative_id: string; year: number }): Promise<void> => {
      const { error} = await supabase
        .from('initiative_quarterly_objectives')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leadershipKeys.quarterlyObjectives(variables.initiative_id, variables.year) });
    },
  });
};

// ============================================
// ANNUAL PLAN FINALIZATION
// ============================================

/**
 * Fetch annual plan status for a function/year
 */
export const useAnnualPlanStatus = (functionId: string, year: number) => {
  return useQuery({
    queryKey: [...leadershipKeys.functions(), 'plan-status', functionId, year],
    queryFn: async (): Promise<AnnualPlanStatus | null> => {
      const { data, error } = await supabase
        .from('annual_plan_status')
        .select('*')
        .eq('function_id', functionId)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!functionId && !!year,
  });
};

/**
 * Finalize annual plan
 */
export const useFinalizePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: FinalizePlanInput): Promise<AnnualPlanStatus> => {
      const { data: existing } = await supabase
        .from('annual_plan_status')
        .select('*')
        .eq('function_id', input.function_id)
        .eq('year', input.year)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('annual_plan_status')
          .update({
            is_finalized: true,
            finalized_by: (await supabase.auth.getUser()).data.user?.id,
            finalized_at: new Date().toISOString(),
            is_rejected: false,
            rejected_by: null,
            rejected_at: null,
            rejection_reason: null,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('annual_plan_status')
          .insert({
            function_id: input.function_id,
            year: input.year,
            is_finalized: true,
            finalized_by: (await supabase.auth.getUser()).data.user?.id,
            finalized_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...leadershipKeys.functions(), 'plan-status', variables.function_id, variables.year] });
    },
  });
};

/**
 * Approve annual plan (super-admin only)
 */
export const useApprovePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApprovePlanInput): Promise<AnnualPlanStatus> => {
      const { data, error } = await supabase
        .from('annual_plan_status')
        .update({
          is_approved: true,
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          is_rejected: false,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...leadershipKeys.functions(), 'plan-status', data.function_id, data.year] });
    },
  });
};

/**
 * Reject annual plan (super-admin only)
 */
export const useRejectPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectPlanInput): Promise<AnnualPlanStatus> => {
      const { data, error } = await supabase
        .from('annual_plan_status')
        .update({
          is_rejected: true,
          rejected_by: (await supabase.auth.getUser()).data.user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: input.rejection_reason,
          is_approved: false,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...leadershipKeys.functions(), 'plan-status', data.function_id, data.year] });
    },
  });
};

/**
 * Reopen annual plan (super-admin only)
 */
export const useReopenPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReopenPlanInput): Promise<AnnualPlanStatus> => {
      const { data, error } = await supabase
        .from('annual_plan_status')
        .update({
          is_finalized: false,
          is_approved: false,
          is_rejected: false,
          finalized_by: null,
          finalized_at: null,
          approved_by: null,
          approved_at: null,
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...leadershipKeys.functions(), 'plan-status', data.function_id, data.year] });
    },
  });
};

// ============================================
// WEEK LOCKS
// ============================================

/**
 * Query week lock status for a specific week
 */
export const useWeekLockQuery = (weekStartDate: string) => {
  return useQuery({
    queryKey: ['weekLock', weekStartDate],
    queryFn: async (): Promise<WeekLock | null> => {
      const { data, error } = await supabase
        .from('initiative_week_locks')
        .select('*')
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!weekStartDate,
  });
};

/**
 * Unlock a week (CEO override)
 */
export const useUnlockWeek = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weekStartDate,
      unlockReason
    }: {
      weekStartDate: string;
      unlockReason: string;
    }): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('unlock_week', {
        p_week_start_date: weekStartDate,
        p_unlocked_by: user.id,
        p_unlock_reason: unlockReason,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weekLock', variables.weekStartDate] });
    },
  });
};

/**
 * Lock a week manually (admin only)
 */
export const useLockWeek = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weekStartDate,
      lockReason
    }: {
      weekStartDate: string;
      lockReason?: string;
    }): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('lock_week', {
        p_week_start_date: weekStartDate,
        p_locked_by: user.id,
        p_lock_reason: lockReason || 'manual',
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weekLock', variables.weekStartDate] });
    },
  });
};
