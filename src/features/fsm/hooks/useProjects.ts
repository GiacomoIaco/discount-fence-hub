import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Project, ProjectStatus } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface ProjectFilters {
  status?: ProjectStatus | ProjectStatus[];
  clientId?: string;
  assignedRepId?: string;
  territoryId?: string;
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
          territory:territories(id, name, code),
          assigned_rep:sales_reps(id, name)
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
        query = query.eq('assigned_rep_id', filters.assignedRepId);
      }

      if (filters?.territoryId) {
        query = query.eq('territory_id', filters.territoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Project[];
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
          territory:territories(id, name, code),
          assigned_rep:sales_reps(id, name, email, phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Project;
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
            assigned_rep:sales_reps!service_requests_assigned_rep_id_fkey(id, name)
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),

        supabase
          .from('quotes')
          .select(`
            id, quote_number, status, total, product_type,
            created_at, sent_at, client_approved_at,
            sales_rep:sales_reps(id, name)
          `)
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),

        supabase
          .from('jobs')
          .select(`
            id, job_number, status, is_warranty, product_type,
            scheduled_date, linear_feet, quoted_total,
            created_at, work_completed_at,
            assigned_crew:crews(id, name)
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

      return {
        requests: requestsResult.data || [],
        quotes: quotesResult.data || [],
        jobs: jobsResult.data || [],
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
