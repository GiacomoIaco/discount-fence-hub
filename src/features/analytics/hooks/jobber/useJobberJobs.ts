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
 * Uses pagination to fetch all jobs (Supabase default limit is 1000)
 */
export function useJobberJobs({ filters, enabled = true }: UseJobberJobsOptions = {}) {
  return useQuery({
    queryKey: ['jobber-jobs', filters],
    queryFn: async () => {
      // Use selected date field for filtering (default to created_date)
      const dateField = filters?.dateField || 'created_date';
      const allJobs: JobberBuilderJob[] = [];
      const pageSize = 1000;
      let offset = 0;

      // Fetch all jobs with pagination
      while (true) {
        let query = supabase
          .from('jobber_builder_jobs')
          .select('*')
          .order(dateField, { ascending: false })
          .range(offset, offset + pageSize - 1);

        // Apply date filters using the selected date field
        if (filters?.dateRange.start) {
          query = query.gte(dateField, filters.dateRange.start.toISOString().split('T')[0]);
        }
        if (filters?.dateRange.end) {
          query = query.lte(dateField, filters.dateRange.end.toISOString().split('T')[0]);
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

        if (!data || data.length === 0) {
          break;
        }

        allJobs.push(...(data as JobberBuilderJob[]));

        // If we got fewer than pageSize, we've reached the end
        if (data.length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      // Apply job size filter client-side (more flexible than DB filtering)
      const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
      const filteredData = allJobs.filter(job =>
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
      const dateField = filters?.dateField || 'created_date';

      let query = supabase
        .from('jobber_builder_jobs')
        .select('total_revenue');

      if (filters?.dateRange.start) {
        query = query.gte(dateField, filters.dateRange.start.toISOString().split('T')[0]);
      }
      if (filters?.dateRange.end) {
        query = query.lte(dateField, filters.dateRange.end.toISOString().split('T')[0]);
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
