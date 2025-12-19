import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { ServiceRequest, RequestFormData, RequestStatus, Job } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface RequestFilters {
  status?: RequestStatus | RequestStatus[];
  clientId?: string;
  assignedRepId?: string;
  territoryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useRequests(filters?: RequestFilters) {
  return useQuery({
    queryKey: ['service_requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('service_requests')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name),
          property:properties(id, address_line1),
          assigned_rep:sales_reps!service_requests_assigned_rep_id_fkey(id, name),
          assessment_rep:sales_reps!service_requests_assessment_rep_id_fkey(id, name),
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

      if (filters?.assignedRepId) {
        query = query.eq('assigned_rep_id', filters.assignedRepId);
      }

      if (filters?.territoryId) {
        query = query.eq('territory_id', filters.territoryId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ServiceRequest[];
    },
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['service_requests', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          client:clients(id, name, code),
          community:communities(id, name),
          property:properties(id, address_line1, lot_number),
          assigned_rep:sales_reps!service_requests_assigned_rep_id_fkey(id, name, email, phone),
          assessment_rep:sales_reps!service_requests_assessment_rep_id_fkey(id, name, email, phone),
          territory:territories(id, name, code),
          qbo_class:qbo_classes(id, name, bu_type, location_code)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ServiceRequest;
    },
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RequestFormData) => {
      const { data: result, error } = await supabase
        .from('service_requests')
        .insert({
          // Customer
          client_id: data.client_id || null,
          community_id: data.community_id || null,
          property_id: data.property_id || null,
          // Contact
          contact_name: data.contact_name?.trim() || null,
          contact_email: data.contact_email?.trim() || null,
          contact_phone: data.contact_phone?.trim() || null,
          // Address
          address_line1: data.address_line1?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state || 'TX',
          zip: data.zip?.trim() || null,
          // Details
          source: data.source,
          request_type: data.request_type || 'new_quote',
          product_types: data.product_types || [],
          linear_feet_estimate: data.linear_feet_estimate ? parseFloat(data.linear_feet_estimate) : null,
          description: data.description?.trim() || null,
          notes: data.notes?.trim() || null,
          // Assessment
          requires_assessment: data.requires_assessment,
          assessment_scheduled_at: data.assessment_scheduled_at || null,
          // Assignment
          business_unit_id: data.business_unit_id || null,
          assigned_rep_id: data.assigned_rep_id || null,
          territory_id: data.territory_id || null,
          priority: data.priority,
          // Status
          status: data.requires_assessment && data.assessment_scheduled_at
            ? 'assessment_scheduled'
            : 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess(`Request ${data.request_number} created`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to create request');
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RequestFormData> }) => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are provided
      if (data.client_id !== undefined) updates.client_id = data.client_id || null;
      if (data.community_id !== undefined) updates.community_id = data.community_id || null;
      if (data.property_id !== undefined) updates.property_id = data.property_id || null;
      if (data.contact_name !== undefined) updates.contact_name = data.contact_name?.trim() || null;
      if (data.contact_email !== undefined) updates.contact_email = data.contact_email?.trim() || null;
      if (data.contact_phone !== undefined) updates.contact_phone = data.contact_phone?.trim() || null;
      if (data.address_line1 !== undefined) updates.address_line1 = data.address_line1?.trim() || null;
      if (data.city !== undefined) updates.city = data.city?.trim() || null;
      if (data.state !== undefined) updates.state = data.state;
      if (data.zip !== undefined) updates.zip = data.zip?.trim() || null;
      if (data.source !== undefined) updates.source = data.source;
      if (data.request_type !== undefined) updates.request_type = data.request_type;
      if (data.product_types !== undefined) updates.product_types = data.product_types || [];
      if (data.linear_feet_estimate !== undefined) {
        updates.linear_feet_estimate = data.linear_feet_estimate ? parseFloat(data.linear_feet_estimate) : null;
      }
      if (data.description !== undefined) updates.description = data.description?.trim() || null;
      if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;
      if (data.requires_assessment !== undefined) updates.requires_assessment = data.requires_assessment;
      if (data.assessment_scheduled_at !== undefined) updates.assessment_scheduled_at = data.assessment_scheduled_at || null;
      if (data.business_unit_id !== undefined) updates.business_unit_id = data.business_unit_id || null;
      if (data.assigned_rep_id !== undefined) updates.assigned_rep_id = data.assigned_rep_id || null;
      if (data.territory_id !== undefined) updates.territory_id = data.territory_id || null;
      if (data.priority !== undefined) updates.priority = data.priority;

      const { error } = await supabase
        .from('service_requests')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess('Request updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update request');
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: RequestStatus;
      notes?: string;
    }) => {
      // Get current status for history
      const { data: current } = await supabase
        .from('service_requests')
        .select('status')
        .eq('id', id)
        .single();

      // Update status
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({
          status,
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Record in history
      const { error: historyError } = await supabase
        .from('fsm_status_history')
        .insert({
          entity_type: 'request',
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
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess('Status updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update status');
    },
  });
}

export function useScheduleAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      scheduledAt,
      repId,
    }: {
      id: string;
      scheduledAt: string;
      repId?: string;
    }) => {
      const { error } = await supabase
        .from('service_requests')
        .update({
          assessment_scheduled_at: scheduledAt,
          assessment_rep_id: repId || null,
          status: 'assessment_scheduled',
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess('Assessment scheduled');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to schedule assessment');
    },
  });
}

export function useCompleteAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('service_requests')
        .update({
          assessment_completed_at: new Date().toISOString(),
          assessment_notes: notes || null,
          status: 'assessment_completed',
          status_changed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess('Assessment completed');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to complete assessment');
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      showSuccess('Request deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete request');
    },
  });
}

export function useConvertRequestToQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      // Get request data
      const { data: request, error: requestError } = await supabase
        .from('service_requests')
        .select(`
          *,
          client:clients(id, name, billing_address_line1, billing_city, billing_state, billing_zip)
        `)
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;

      // Build job address from request
      const jobAddress = request.address_line1 ? {
        line1: request.address_line1,
        city: request.city || '',
        state: request.state || 'TX',
        zip: request.zip || '',
      } : null;

      // Build billing address from client
      const billingAddress = request.client?.billing_address_line1 ? {
        line1: request.client.billing_address_line1,
        city: request.client.billing_city || '',
        state: request.client.billing_state || 'TX',
        zip: request.client.billing_zip || '',
      } : null;

      // Create quote from request
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          request_id: requestId,
          client_id: request.client_id,
          community_id: request.community_id,
          property_id: request.property_id,
          job_address: jobAddress,
          billing_address: billingAddress,
          product_type: request.product_type,
          linear_feet: request.linear_feet_estimate,
          scope_summary: request.description,
          sales_rep_id: request.assigned_rep_id,
          status: 'draft',
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Update request status to converted
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({
          status: 'converted',
          status_changed_at: new Date().toISOString(),
          converted_to_quote_id: quote.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Record in status history
      await supabase.from('fsm_status_history').insert({
        entity_type: 'request',
        entity_id: requestId,
        from_status: request.status,
        to_status: 'converted',
        notes: `Converted to Quote #${quote.quote_number}`,
      });

      return quote;
    },
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      showSuccess(`Quote ${quote.quote_number} created from request`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to convert request to quote');
    },
  });
}

/**
 * Convert a Request directly to a Job (skipping Quote)
 * Used for builders without PO process or simple repeat work
 * Creates a Project to group the Request and Job
 */
export function useConvertRequestToJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string): Promise<Job> => {
      // Get request data
      const { data: request, error: requestError } = await supabase
        .from('service_requests')
        .select(`
          *,
          client:clients(id, name, billing_address_line1, billing_city, billing_state, billing_zip)
        `)
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      if (!request) throw new Error('Request not found');

      // Require a client for direct job conversion
      if (!request.client_id) {
        throw new Error('Request must have a client assigned to convert directly to a job');
      }

      // Build job address from request
      const jobAddress = {
        line1: request.address_line1 || '',
        city: request.city || '',
        state: request.state || 'TX',
        zip: request.zip || '',
      };

      // Create project first (if not already linked to one)
      let projectId = request.project_id;

      if (!projectId) {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            client_id: request.client_id,
            community_id: request.community_id,
            property_id: request.property_id,
            product_type: request.product_type,
            address_line1: request.address_line1,
            city: request.city,
            state: request.state,
            zip: request.zip,
            territory_id: request.territory_id,
            assigned_rep_id: request.assigned_rep_id,
          })
          .select('id')
          .single();

        if (projectError) throw projectError;
        projectId = project.id;

        // Link request to project
        await supabase
          .from('service_requests')
          .update({ project_id: projectId })
          .eq('id', requestId);
      }

      // Create job directly from request
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          project_id: projectId,
          request_id: requestId,  // Direct link, no quote
          client_id: request.client_id,
          community_id: request.community_id,
          property_id: request.property_id,
          job_address: jobAddress,
          product_type: request.product_type,
          linear_feet: request.linear_feet_estimate,
          description: request.description,
          territory_id: request.territory_id,
          status: 'won',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Update request status to converted
      const { error: updateError } = await supabase
        .from('service_requests')
        .update({
          status: 'converted',
          status_changed_at: new Date().toISOString(),
          converted_to_job_id: job.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Record in status history
      await supabase.from('fsm_status_history').insert({
        entity_type: 'request',
        entity_id: requestId,
        from_status: request.status,
        to_status: 'converted',
        notes: `Converted directly to Job #${job.job_number}`,
      });

      return job as Job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['service_requests'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showSuccess(`Job ${job.job_number} created from request`);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to convert request to job');
    },
  });
}
