import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { QuoteToProjectConversion, JobWithContext } from '../types';
import { showSuccess, showError } from '../../../lib/toast';

interface ConversionResult {
  project: {
    id: string;
    project_number: string;
  };
  jobs: {
    id: string;
    job_number: string;
    name: string;
  }[];
  invoiceGroup?: {
    id: string;
    group_number: string;
  };
}

/**
 * Convert a quote to a project with one or more jobs.
 * Supports the multi-job pattern for projects requiring different crews.
 */
export function useConvertQuoteToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversion: QuoteToProjectConversion): Promise<ConversionResult> => {
      // 1. Get the quote data
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(
            id, name, code,
            address_line1, city, state, zip
          ),
          community:communities(id, name),
          property:properties(id, address_line1, city, state, zip),
          line_items:quote_line_items(*)
        `)
        .eq('id', conversion.quote_id)
        .single();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Quote not found');

      // 2. Create or get existing project
      let projectId = quote.project_id;
      let projectNumber = '';

      if (!projectId) {
        // Create new project
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            client_id: quote.client_id,
            community_id: quote.community_id || null,
            property_id: quote.property_id || null,
            name: conversion.project_name || quote.client?.name || 'Project',
            product_type: quote.product_type || null,
            address_line1: quote.job_address?.line1 || quote.client?.address_line1 || null,
            city: quote.job_address?.city || quote.client?.city || null,
            state: quote.job_address?.state || quote.client?.state || 'TX',
            zip: quote.job_address?.zip || quote.client?.zip || null,
            total_quoted: quote.total,
            default_invoice_together: conversion.invoice_together,
            status: 'active',
          })
          .select()
          .single();

        if (projectError) throw projectError;
        projectId = project.id;
        projectNumber = project.project_number;

        // Link quote to project
        await supabase
          .from('quotes')
          .update({ project_id: projectId })
          .eq('id', conversion.quote_id);
      } else {
        // Get existing project number
        const { data: existingProject } = await supabase
          .from('projects')
          .select('project_number')
          .eq('id', projectId)
          .single();
        projectNumber = existingProject?.project_number || '';
      }

      // 3. Create invoice group if invoicing together
      let invoiceGroupId: string | null = null;
      let invoiceGroupNumber: string | null = null;

      if (conversion.invoice_together) {
        // Calculate total value from jobs
        const totalValue = conversion.jobs.reduce((sum, job) => {
          const lineItems = quote.line_items?.filter((li: any) =>
            job.quote_line_item_ids.includes(li.id)
          ) || [];
          return sum + lineItems.reduce((s: number, li: any) => s + (li.total_price || 0), 0);
        }, 0);

        const { data: invoiceGroup, error: igError } = await supabase
          .from('invoice_groups')
          .insert({
            project_id: projectId,
            total_value: totalValue,
            status: 'pending',
          })
          .select()
          .single();

        if (igError) throw igError;
        invoiceGroupId = invoiceGroup.id;
        invoiceGroupNumber = invoiceGroup.group_number;
      }

      // 4. Create jobs sequentially
      const createdJobs: { id: string; job_number: string; name: string }[] = [];
      const previousJobIds: string[] = [];

      // Build job address once
      const defaultJobAddress = quote.job_address || {
        line1: quote.client?.address_line1 || '',
        city: quote.client?.city || '',
        state: quote.client?.state || 'TX',
        zip: quote.client?.zip || '',
      };

      // Create each job
      for (let i = 0; i < conversion.jobs.length; i++) {
        const jobConfig = conversion.jobs[i];

        // Calculate job value from line items
        const jobLineItems = quote.line_items?.filter((li: any) =>
          jobConfig.quote_line_item_ids.includes(li.id)
        ) || [];
        const jobValue = jobLineItems.reduce((s: number, li: any) => s + (li.total_price || 0), 0);

        // Get previous job ID if this job depends on it
        const prevJobId: string | null = jobConfig.depends_on_previous && i > 0
          ? previousJobIds[i - 1] ?? null
          : null;

        // Note: status is auto-computed by trigger, quote auto-converts via cascade trigger
        const jobResult = await supabase
          .from('jobs')
          .insert({
            project_id: projectId,
            quote_id: conversion.quote_id,  // This triggers cascade: Quote → converted
            client_id: quote.client_id,
            community_id: quote.community_id || null,
            property_id: quote.property_id || null,
            job_address: defaultJobAddress,
            name: jobConfig.name,
            project_type_id: jobConfig.project_type_id || null,
            skill_tag_ids: jobConfig.skill_tag_ids || [],
            quote_line_item_ids: jobConfig.quote_line_item_ids || [],
            sequence_order: jobConfig.sequence_order || (i + 1),
            depends_on_job_id: prevJobId,
            estimated_value: jobValue,
            invoice_group_id: invoiceGroupId,
            assigned_crew_id: jobConfig.assigned_crew_id || null,
            scheduled_date: jobConfig.scheduled_date || null,
            quoted_total: jobValue,
            product_type: quote.product_type || null,
            linear_feet: quote.linear_feet || null,
            // status: computed by trigger (will be 'won' or 'scheduled' based on crew/date)
          })
          .select('id, job_number')
          .single();

        if (jobResult.error) throw jobResult.error;
        const newJob = jobResult.data as { id: string; job_number: string };
        if (!newJob) throw new Error('Job creation returned no data');

        createdJobs.push({
          id: newJob.id,
          job_number: newJob.job_number,
          name: jobConfig.name,
        });

        previousJobIds.push(newJob.id);
      }

      // Quote status auto-updated via cascade trigger when first job is created with quote_id
      // Status history is auto-recorded by trigger

      return {
        project: {
          id: projectId!,
          project_number: projectNumber,
        },
        jobs: createdJobs,
        invoiceGroup: invoiceGroupId ? {
          id: invoiceGroupId,
          group_number: invoiceGroupNumber!,
        } : undefined,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_groups'] });

      const jobCount = result.jobs.length;
      const message = jobCount === 1
        ? `Created job ${result.jobs[0].job_number}`
        : `Created ${jobCount} jobs in project ${result.project.project_number}`;
      showSuccess(message);
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to convert quote to project');
    },
  });
}

/**
 * Get jobs in a project with full context
 */
export function useProjectJobsWithContext(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_jobs', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          assigned_crew:crews(id, name, code),
          project_type:project_types(id, name, code),
          invoice_group:invoice_groups(id, group_number, status)
        `)
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;

      // Fetch depends_on jobs separately to avoid circular reference
      const jobsWithDeps = await Promise.all(
        (data || []).map(async (job: any) => {
          if (job.depends_on_job_id) {
            const { data: depJob } = await supabase
              .from('jobs')
              .select('id, job_number, name')
              .eq('id', job.depends_on_job_id)
              .single();
            return { ...job, depends_on_job: depJob };
          }
          return job;
        })
      );

      return jobsWithDeps as JobWithContext[];
    },
    enabled: !!projectId,
  });
}
