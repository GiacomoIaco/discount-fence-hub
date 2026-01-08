import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  Project,
  ProjectStatus,
  ProjectSource,
  ProjectRelationshipType,
  RepUser,
  Quote,
  Job,
  Invoice,
} from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface ProjectFilters {
  status?: ProjectStatus | ProjectStatus[];
  clientId?: string;
  assignedRepId?: string;  // Now expects user_id, not sales_rep_id
  territoryId?: string;
}

// Helper to fetch user profiles by IDs
async function fetchUserProfiles(userIds: string[]): Promise<Map<string, RepUser>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, phone')
    .in('id', userIds);

  if (error) {
    console.warn('Failed to fetch user profiles:', error);
    return new Map();
  }

  const map = new Map<string, RepUser>();
  (data || []).forEach(u => map.set(u.id, {
    id: u.id,
    name: u.full_name || u.email || 'Unknown',
    full_name: u.full_name,
    email: u.email || '',
    phone: u.phone || null,
  }));
  return map;
}

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      // Use v_projects_full view for aggregated data (quote_count, job_count, etc.)
      let query = supabase
        .from('v_projects_full')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.assignedRepId) {
        // Filter by new user_id column
        query = query.eq('assigned_rep_user_id', filters.assignedRepId);
      }

      if (filters?.territoryId) {
        query = query.eq('territory_id', filters.territoryId);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback to base projects table if view doesn't exist
        if (error.code === '42P01') {
          console.warn('v_projects_full view not found, falling back to projects table');
          return useProjectsFromBaseTable(filters);
        }
        throw error;
      }

      return (data || []) as Project[];
    },
  });
}

// Fallback function to query base projects table
async function useProjectsFromBaseTable(filters?: ProjectFilters): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select(`
      *,
      client:clients(id, name, company_name),
      community:communities(id, name),
      property:properties(id, address_line1, city, state, zip),
      territory:territories(id, name, code),
      qbo_class:qbo_classes(id, name, labor_code, bu_type)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.clientId) {
    query = query.eq('client_id', filters.clientId);
  }

  if (filters?.assignedRepId) {
    query = query.eq('assigned_rep_user_id', filters.assignedRepId);
  }

  if (filters?.territoryId) {
    query = query.eq('territory_id', filters.territoryId);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Collect unique user IDs for rep lookups
  const userIds = new Set<string>();
  (data || []).forEach(project => {
    if (project.assigned_rep_user_id) userIds.add(project.assigned_rep_user_id);
  });

  // Fetch user profiles
  const userMap = await fetchUserProfiles(Array.from(userIds));

  // Transform to match view format with flattened fields
  const projectsWithUsers = (data || []).map(project => ({
    ...project,
    // Flatten client info
    client_display_name: project.client?.company_name || project.client?.name || null,
    // Flatten property info
    property_address: project.property?.address_line1 || null,
    property_city: project.property?.city || null,
    // Flatten community info
    community_name: project.community?.name || null,
    // Rep info
    assigned_rep_user: project.assigned_rep_user_id ? userMap.get(project.assigned_rep_user_id) : undefined,
    rep_name: project.assigned_rep_user_id ? userMap.get(project.assigned_rep_user_id)?.name : null,
    // Default aggregates (will be 0 in fallback mode)
    quote_count: 0,
    cnt_quotes: 0,
    job_count: 0,
    cnt_jobs: 0,
    invoice_count: 0,
    cnt_invoices: 0,
    total_job_value: 0,
    sum_invoiced: 0,
    has_rework: false,
  }));

  return projectsWithUsers as Project[];
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name, code),
          community:communities(id, name),
          property:properties(id, address_line1, lot_number, city, state, zip),
          territory:territories(id, name, code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch user profile for assigned rep
      const userIds: string[] = [];
      if (data.assigned_rep_user_id) userIds.push(data.assigned_rep_user_id);

      const userMap = await fetchUserProfiles(userIds);

      return {
        ...data,
        assigned_rep_user: data.assigned_rep_user_id ? userMap.get(data.assigned_rep_user_id) : undefined,
      } as Project;
    },
    enabled: !!id,
  });
}

/**
 * Fetch all related entities for a project
 */
export function useProjectEntities(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_entities', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      // Fetch all related entities in parallel
      const [requestsResult, quotesResult, jobsResult, invoicesResult] = await Promise.all([
        supabase
          .from('service_requests')
          .select(`
            id, request_number, status, request_type, product_type,
            contact_name, address_line1, created_at,
            assigned_rep_user_id
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),

        supabase
          .from('quotes')
          .select(`
            id, quote_number, status, total, product_type,
            created_at, sent_at, client_approved_at,
            sales_rep_user_id
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),

        supabase
          .from('jobs')
          .select(`
            id, job_number, status, is_warranty, product_type,
            scheduled_date, linear_feet, quoted_total,
            created_at, work_completed_at,
            assigned_crew:crews(id, name),
            assigned_rep_user_id
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),

        supabase
          .from('invoices')
          .select(`
            id, invoice_number, status, total, balance_due,
            invoice_date, due_date, sent_at
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
      ]);

      if (requestsResult.error) throw requestsResult.error;
      if (quotesResult.error) throw quotesResult.error;
      if (jobsResult.error) throw jobsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;

      // Collect all user IDs for rep lookups
      const userIds = new Set<string>();
      (requestsResult.data || []).forEach(r => {
        if (r.assigned_rep_user_id) userIds.add(r.assigned_rep_user_id);
      });
      (quotesResult.data || []).forEach(q => {
        if (q.sales_rep_user_id) userIds.add(q.sales_rep_user_id);
      });
      (jobsResult.data || []).forEach(j => {
        if (j.assigned_rep_user_id) userIds.add(j.assigned_rep_user_id);
      });

      // Fetch user profiles
      const userMap = await fetchUserProfiles(Array.from(userIds));

      // Merge user profiles into entities
      const requests = (requestsResult.data || []).map(r => ({
        ...r,
        assigned_rep_user: r.assigned_rep_user_id ? userMap.get(r.assigned_rep_user_id) : undefined,
      }));

      const quotes = (quotesResult.data || []).map(q => ({
        ...q,
        sales_rep_user: q.sales_rep_user_id ? userMap.get(q.sales_rep_user_id) : undefined,
      }));

      const jobs = (jobsResult.data || []).map(j => ({
        ...j,
        assigned_rep_user: j.assigned_rep_user_id ? userMap.get(j.assigned_rep_user_id) : undefined,
      }));

      return {
        requests,
        quotes,
        jobs,
        invoices: invoicesResult.data || [],
      };
    },
    enabled: !!projectId,
  });
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ProjectStatus;
    }) => {
      const { error } = await supabase
        .from('projects')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess('Project status updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update project status');
    },
  });
}

/** Editable project fields for ProjectEditorModal */
export interface UpdateProjectData {
  name?: string | null;
  description?: string | null;
  status?: ProjectStatus;
  client_id?: string | null;
  community_id?: string | null;
  property_id?: string | null;
  qbo_class_id?: string | null;
  assigned_rep_user_id?: string | null;
  territory_id?: string | null;
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateProjectData;
    }) => {
      const { error } = await supabase
        .from('projects')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project_full'] });
      showSuccess('Project updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update project');
    },
  });
}

// ============================================
// PROJECT-FIRST ARCHITECTURE HOOKS
// ============================================

export interface CreateProjectData {
  client_id: string;
  property_id?: string;
  community_id?: string;
  territory_id?: string;
  qbo_class_id?: string;
  assigned_rep_user_id?: string;
  name: string;
  description?: string;
  source?: ProjectSource;
  source_request_id?: string;
  parent_project_id?: string;
  relationship_type?: ProjectRelationshipType;
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProjectData) => {
      const { data: result, error } = await supabase
        .from('projects')
        .insert({
          ...data,
          status: 'active' as ProjectStatus,
        })
        .select()
        .single();

      if (error) throw error;
      return result as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess('Project created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create project');
    },
  });
}

/**
 * Fetch project using v_projects_full view with all aggregates
 */
export function useProjectFull(id: string | undefined) {
  return useQuery({
    queryKey: ['project_full', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('v_projects_full')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        // Fallback to regular projects table if view doesn't exist yet
        if (error.code === '42P01') {
          console.warn('v_projects_full view not found, falling back to projects table');
          const fallback = await supabase
            .from('projects')
            .select(`
              *,
              client:clients(id, name, company_name, primary_contact_phone),
              property:properties(id, address_line1, city, state, zip, latitude, longitude),
              community:communities(id, name, code),
              qbo_class:qbo_classes(id, name, labor_code, bu_type, location_code),
              territory:territories(id, name, code)
            `)
            .eq('id', id)
            .single();

          if (fallback.error) throw fallback.error;

          // Add user profile for assigned rep
          const userIds: string[] = [];
          if (fallback.data.assigned_rep_user_id) userIds.push(fallback.data.assigned_rep_user_id);
          const userMap = await fetchUserProfiles(userIds);

          return {
            ...fallback.data,
            assigned_rep_user: fallback.data.assigned_rep_user_id
              ? userMap.get(fallback.data.assigned_rep_user_id)
              : undefined,
            // Default aggregates
            quote_count: 0,
            pending_quote_count: 0,
            job_count: 0,
            active_job_count: 0,
            invoice_count: 0,
            unpaid_invoice_count: 0,
            accepted_quote_total: 0,
            total_job_value: 0,
            total_invoiced: 0,
            total_paid: 0,
            total_balance_due: 0,
            total_budgeted_cost: 0,
            total_actual_cost: 0,
            has_rework: false,
            child_project_count: 0,
          } as Project;
        }
        throw error;
      }

      return data as Project;
    },
    enabled: !!id,
  });
}

/**
 * Fetch quotes for a project with acceptance status
 */
export function useProjectQuotes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_quotes', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name, company_name),
          line_items:quote_line_items(*),
          sales_rep_user_id
        `)
        .eq('project_id', projectId)
        .order('version_number', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for sales reps
      const userIds = new Set<string>();
      (data || []).forEach(q => {
        if (q.sales_rep_user_id) userIds.add(q.sales_rep_user_id);
      });
      const userMap = await fetchUserProfiles(Array.from(userIds));

      // Merge user profiles
      const quotesWithUsers = (data || []).map(q => ({
        ...q,
        sales_rep_user: q.sales_rep_user_id ? userMap.get(q.sales_rep_user_id) : undefined,
      }));

      return quotesWithUsers as Quote[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch jobs for a project with phase info and visits
 */
export function useProjectJobs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_jobs', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name, company_name),
          property:properties(id, address_line1, city, state, zip),
          assigned_crew:crews(id, name, code, crew_size),
          quote:quotes(id, quote_number, total),
          visits:job_visits(*),
          depends_on_job:jobs!depends_on_job_id(id, job_number, name),
          assigned_rep_user_id
        `)
        .eq('project_id', projectId)
        .order('phase_number', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for assigned reps
      const userIds = new Set<string>();
      (data || []).forEach(j => {
        if (j.assigned_rep_user_id) userIds.add(j.assigned_rep_user_id);
      });
      const userMap = await fetchUserProfiles(Array.from(userIds));

      // Merge user profiles
      const jobsWithUsers = (data || []).map(j => ({
        ...j,
        assigned_rep_user: j.assigned_rep_user_id ? userMap.get(j.assigned_rep_user_id) : undefined,
      }));

      return jobsWithUsers as Job[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch invoices for a project with payment info
 */
export function useProjectInvoices(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_invoices', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, name, company_name),
          job:jobs(id, job_number, name),
          payments:payments(
            id, amount, payment_date, payment_method, reference_number
          ),
          line_items:invoice_line_items(
            id, description, quantity, unit_price, total
          )
        `)
        .eq('project_id', projectId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch project timeline/activity
 */
export function useProjectTimeline(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_timeline', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('v_project_timeline')
        .select('*')
        .eq('project_id', projectId)
        .order('event_time', { ascending: false })
        .limit(50);

      if (error) {
        // If view doesn't exist, return empty
        if (error.code === '42P01') {
          console.warn('v_project_timeline view not found');
          return [];
        }
        throw error;
      }

      return data;
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch child projects (warranty, change orders, etc.)
 */
export function useChildProjects(parentProjectId: string | undefined) {
  return useQuery({
    queryKey: ['child_projects', parentProjectId],
    queryFn: async () => {
      if (!parentProjectId) return [];

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name),
          assigned_rep_user_id
        `)
        .eq('parent_project_id', parentProjectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      const userIds = new Set<string>();
      (data || []).forEach(p => {
        if (p.assigned_rep_user_id) userIds.add(p.assigned_rep_user_id);
      });
      const userMap = await fetchUserProfiles(Array.from(userIds));

      return (data || []).map(p => ({
        ...p,
        assigned_rep_user: p.assigned_rep_user_id ? userMap.get(p.assigned_rep_user_id) : undefined,
      })) as Project[];
    },
    enabled: !!parentProjectId,
  });
}

/**
 * Create a child project (warranty, change order, follow-up)
 */
export function useCreateChildProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parentProjectId,
      relationshipType,
      name,
      description,
    }: {
      parentProjectId: string;
      relationshipType: ProjectRelationshipType;
      name: string;
      description?: string;
    }) => {
      // Get parent project to inherit client/property/etc.
      const { data: parent, error: parentError } = await supabase
        .from('projects')
        .select('client_id, property_id, community_id, territory_id, qbo_class_id, assigned_rep_user_id')
        .eq('id', parentProjectId)
        .single();

      if (parentError) throw parentError;

      const { data: result, error } = await supabase
        .from('projects')
        .insert({
          client_id: parent.client_id,
          property_id: parent.property_id,
          community_id: parent.community_id,
          territory_id: parent.territory_id,
          qbo_class_id: parent.qbo_class_id,
          assigned_rep_user_id: parent.assigned_rep_user_id,
          parent_project_id: parentProjectId,
          relationship_type: relationshipType,
          source: relationshipType as ProjectSource,
          name,
          description,
          status: relationshipType === 'warranty' ? 'warranty' : 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return result as Project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['child_projects', variables.parentProjectId] });
      showSuccess('Child project created');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create child project');
    },
  });
}
