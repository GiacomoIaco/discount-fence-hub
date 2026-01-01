import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Project, ProjectStatus, RepUser } from '../types';
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
      let query = supabase
        .from('projects')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name),
          property:properties(id, address_line1),
          territory:territories(id, name, code)
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
        // Filter by new user_id column
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

      // Merge user profiles into projects
      const projectsWithUsers = (data || []).map(project => ({
        ...project,
        assigned_rep_user: project.assigned_rep_user_id ? userMap.get(project.assigned_rep_user_id) : undefined,
      }));

      return projectsWithUsers as Project[];
    },
  });
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

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Project, 'name' | 'description' | 'status'>>;
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
      showSuccess('Project updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update project');
    },
  });
}
