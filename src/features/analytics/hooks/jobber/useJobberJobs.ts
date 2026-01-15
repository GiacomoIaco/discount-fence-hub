// Hook for fetching Jobber builder jobs data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { JobberBuilderJob, JobberFilters } from '../../types/jobber';
import { jobMatchesSizeFilter, DEFAULT_JOBBER_FILTERS } from '../../types/jobber';

interface UseJobberJobsOptions {
  filters?: JobberFilters;
  enabled?: boolean;
}

/**
 * Fetch builder jobs with optional filters
 * Now uses job size categories (standard/small/warranty) instead of binary includeWarranties
 */
export function useJobberJobs({ filters, enabled = true }: UseJobberJobsOptions = {}) {
  return useQuery({
    queryKey: ['jobber-jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('*')
        .order('created_date', { ascending: false });

      // Apply date filters
      if (filters?.dateRange.start) {
        query = query.gte('created_date', filters.dateRange.start.toISOString().split('T')[0]);
      }
      if (filters?.dateRange.end) {
        query = query.lte('created_date', filters.dateRange.end.toISOString().split('T')[0]);
      }

      // Apply salesperson filter
      if (filters?.salesperson) {
        query = query.eq('effective_salesperson', filters.salesperson);
      }

      // Apply location filter
      if (filters?.location) {
        query = query.eq('franchise_location', filters.location);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch jobs: ${error.message}`);
      }

      // Apply job size filter client-side (more flexible than DB filtering)
      const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
      const filteredData = (data as JobberBuilderJob[]).filter(job =>
        jobMatchesSizeFilter(job.total_revenue, jobSizes)
      );

      return filteredData;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get total job count with job size filtering
 */
export function useJobberJobsCount(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-jobs-count', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('total_revenue');

      if (filters?.dateRange.start) {
        query = query.gte('created_date', filters.dateRange.start.toISOString().split('T')[0]);
      }
      if (filters?.dateRange.end) {
        query = query.lte('created_date', filters.dateRange.end.toISOString().split('T')[0]);
      }
      if (filters?.salesperson) {
        query = query.eq('effective_salesperson', filters.salesperson);
      }
      if (filters?.location) {
        query = query.eq('franchise_location', filters.location);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to count jobs: ${error.message}`);
      }

      // Apply job size filter client-side
      const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
      const count = (data || []).filter(job =>
        jobMatchesSizeFilter(job.total_revenue, jobSizes)
      ).length;

      return count;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get open jobs (no closed_date)
 */
export function useOpenJobs(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-open-jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('*')
        .is('closed_date', null)
        .order('created_date', { ascending: false });

      if (filters?.salesperson) {
        query = query.eq('effective_salesperson', filters.salesperson);
      }
      if (filters?.location) {
        query = query.eq('franchise_location', filters.location);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch open jobs: ${error.message}`);
      }

      return data as JobberBuilderJob[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
