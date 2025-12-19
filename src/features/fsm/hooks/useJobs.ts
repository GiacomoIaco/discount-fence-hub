import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Job, JobStatus, JobVisit, VisitType, VisitStatus } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface JobFilters {
  status?: JobStatus | JobStatus[];
  clientId?: string;
  crewId?: string;
  territoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useJobs(filters?: JobFilters) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name, code),
          community:communities(id, name),
          assigned_crew:crews(id, name, code),
          qbo_class:qbo_classes(id, name, bu_type, location_code)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
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

      if (filters?.crewId) {
        query = query.eq('assigned_crew_id', filters.crewId);
      }

      if (filters?.territoryId) {
        query = query.eq('territory_id', filters.territoryId);
      }

      if (filters?.dateFrom) {
        query = query.gte('scheduled_date', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('scheduled_date', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name, code, address_line1, city, state, zip),
          community:communities(id, name),
          property:properties(id, address_line1, city, state, zip),
          assigned_crew:crews(id, name, code, crew_size),
          quote:quotes(id, quote_number, total),
          visits:job_visits(*),
          qbo_class:qbo_classes(id, name, bu_type, location_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Job & { quote?: { id: string; quote_number: string; total: number }; visits: JobVisit[] };
    },
    enabled: !!id,
  });
}

export function useJobsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['jobs', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          community:communities(id, name),
          assigned_crew:crews(id, name, code)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!clientId,
  });
}

export function useJobsByCrew(crewId: string | undefined) {
  return useQuery({
    queryKey: ['jobs', 'crew', crewId],
    queryFn: async () => {
      if (!crewId) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name)
        `)
        .eq('assigned_crew_id', crewId)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!crewId,
  });
}

interface CreateJobData {
  quote_id?: string;
  client_id: string;
  community_id?: string;
  property_id?: string;
  job_address: Job['job_address'];
  product_type?: string;
  linear_feet?: number;
  description?: string;
  special_instructions?: string;
  quoted_total?: number;
  scheduled_date?: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  estimated_duration_hours?: number;
  assigned_crew_id?: string;
  assigned_rep_id?: string;
  territory_id?: string;
  bom_project_id?: string;
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateJobData) => {
      const { data: result, error } = await supabase
        .from('jobs')
        .insert({
          quote_id: data.quote_id || null,
          client_id: data.client_id,
          community_id: data.community_id || null,
          property_id: data.property_id || null,
          job_address: data.job_address,
          product_type: data.product_type || null,
          linear_feet: data.linear_feet || null,
          description: data.description || null,
          special_instructions: data.special_instructions || null,
          quoted_total: data.quoted_total || null,
          scheduled_date: data.scheduled_date || null,
          scheduled_time_start: data.scheduled_time_start || null,
          scheduled_time_end: data.scheduled_time_end || null,
          estimated_duration_hours: data.estimated_duration_hours || null,
          assigned_crew_id: data.assigned_crew_id || null,
          assigned_rep_id: data.assigned_rep_id || null,
          territory_id: data.territory_id || null,
          bom_project_id: data.bom_project_id || null,
          status: 'won',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess(`Job ${data.job_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create job');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Job updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update job');
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: JobStatus;
      notes?: string;
    }) => {
      // Get current status for history
      const { data: current } = await supabase
        .from('jobs')
        .select('status')
        .eq('id', id)
        .single();

      // Build update object with workflow timestamps
      const updateData: Record<string, unknown> = {
        status,
        status_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Set workflow timestamps based on status
      const now = new Date().toISOString();
      switch (status) {
        case 'ready_for_yard':
          updateData.ready_for_yard_at = now;
          break;
        case 'picking':
          updateData.picking_started_at = now;
          break;
        case 'staged':
          updateData.picking_completed_at = now;
          updateData.staging_completed_at = now;
          break;
        case 'loaded':
          updateData.loaded_at = now;
          break;
        case 'in_progress':
          updateData.work_started_at = now;
          break;
        case 'completed':
          updateData.work_completed_at = now;
          break;
      }

      // Update status
      const { error: updateError } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Record in history
      const { error: historyError } = await supabase
        .from('fsm_status_history')
        .insert({
          entity_type: 'job',
          entity_id: id,
          from_status: current?.status || null,
          to_status: status,
          notes: notes || null,
        });

      if (historyError) {
        console.warn('Failed to record status history:', historyError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Status updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update status');
    },
  });
}

export function useScheduleJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      scheduledDate,
      scheduledTimeStart,
      scheduledTimeEnd,
      crewId,
    }: {
      id: string;
      scheduledDate: string;
      scheduledTimeStart?: string;
      scheduledTimeEnd?: string;
      crewId?: string;
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          scheduled_date: scheduledDate,
          scheduled_time_start: scheduledTimeStart || null,
          scheduled_time_end: scheduledTimeEnd || null,
          assigned_crew_id: crewId || null,
          status: 'scheduled',
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Job scheduled');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to schedule job');
    },
  });
}

export function useCompleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
      photos,
    }: {
      id: string;
      notes?: string;
      photos?: string[];
    }) => {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          status_changed_at: new Date().toISOString(),
          work_completed_at: new Date().toISOString(),
          completion_notes: notes || null,
          completion_photos: photos || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Job completed');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to complete job');
    },
  });
}

export function useCreateInvoiceFromJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      // Get job data
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, address_line1, city, state, zip),
          quote:quotes(id, total, tax_rate, tax_amount, discount_amount, subtotal)
        `)
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;

      // Create invoice from job
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          job_id: jobId,
          quote_id: job.quote_id,
          client_id: job.client_id,
          billing_address: job.client?.address_line1
            ? {
                line1: job.client.address_line1,
                city: job.client.city || '',
                state: job.client.state || 'TX',
                zip: job.client.zip || '',
              }
            : job.job_address,
          subtotal: job.quote?.subtotal || job.quoted_total || 0,
          tax_rate: job.quote?.tax_rate || 0,
          tax_amount: job.quote?.tax_amount || 0,
          discount_amount: job.quote?.discount_amount || 0,
          total: job.quote?.total || job.quoted_total || 0,
          amount_paid: 0,
          balance_due: job.quote?.total || job.quoted_total || 0,
          invoice_date: new Date().toISOString().split('T')[0],
          payment_terms: 'Net 30',
          status: 'draft',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Transfer custom fields from job to invoice (Jobber-style)
      try {
        await supabase.rpc('transfer_custom_fields', {
          p_source_entity_type: 'job',
          p_source_entity_id: jobId,
          p_target_entity_type: 'invoice',
          p_target_entity_id: invoice.id,
        });
      } catch (transferError) {
        // Log but don't fail the conversion if transfer fails
        console.warn('Failed to transfer custom fields:', transferError);
      }

      // Update job status and link invoice
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'requires_invoicing',
          invoice_id: invoice.id,
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showSuccess(`Invoice ${invoice.invoice_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create invoice');
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Job deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete job');
    },
  });
}

// Job Visits
export function useJobVisits(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-visits', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_visits')
        .select(`
          *,
          assigned_crew:crews(id, name, code)
        `)
        .eq('job_id', jobId)
        .order('visit_number', { ascending: true });

      if (error) throw error;
      return data as JobVisit[];
    },
    enabled: !!jobId,
  });
}

interface CreateVisitData {
  job_id: string;
  visit_type: VisitType;
  scheduled_date: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  assigned_crew_id?: string;
  notes?: string;
}

export function useAddJobVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVisitData) => {
      // Get next visit number
      const { data: existing } = await supabase
        .from('job_visits')
        .select('visit_number')
        .eq('job_id', data.job_id)
        .order('visit_number', { ascending: false })
        .limit(1);

      const nextNumber = (existing?.[0]?.visit_number || 0) + 1;

      const { data: result, error } = await supabase
        .from('job_visits')
        .insert({
          job_id: data.job_id,
          visit_number: nextNumber,
          visit_type: data.visit_type,
          scheduled_date: data.scheduled_date,
          scheduled_time_start: data.scheduled_time_start || null,
          scheduled_time_end: data.scheduled_time_end || null,
          assigned_crew_id: data.assigned_crew_id || null,
          notes: data.notes || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['job-visits', variables.job_id] });
      showSuccess('Visit added');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to add visit');
    },
  });
}

export function useUpdateJobVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<JobVisit> }) => {
      const { error } = await supabase
        .from('job_visits')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-visits'] });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update visit');
    },
  });
}

export function useCompleteJobVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
      photos,
    }: {
      id: string;
      notes?: string;
      photos?: string[];
    }) => {
      const { error } = await supabase
        .from('job_visits')
        .update({
          status: 'completed' as VisitStatus,
          completed_at: new Date().toISOString(),
          notes: notes || null,
          photos: photos || [],
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-visits'] });
      showSuccess('Visit completed');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to complete visit');
    },
  });
}
