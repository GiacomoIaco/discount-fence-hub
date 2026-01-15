// Hook for fetching cycle time metrics from Jobber data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { JobberFilters, CycleTimeMetrics, CycleTimeDistribution, DayOfWeekPattern } from '../../types/jobber';
import { jobMatchesSizeFilter, DEFAULT_JOBBER_FILTERS } from '../../types/jobber';

/**
 * Get cycle time stage metrics
 */
export function useCycleTimeMetrics(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-cycle-time', filters],
    queryFn: async () => {
      // Get jobs with cycle time data
      let query = supabase
        .from('jobber_builder_jobs')
        .select('days_to_schedule, days_to_close, total_cycle_days, total_revenue')
        .not('closed_date', 'is', null);

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

      const { data: allJobs, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch cycle time data: ${error.message}`);
      }

      // Apply job size filter client-side
      const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
      const jobs = (allJobs || []).filter(job =>
        jobMatchesSizeFilter(job.total_revenue, jobSizes)
      );

      // Calculate metrics for each stage
      const scheduleArray = (jobs || [])
        .map(j => j.days_to_schedule)
        .filter((d): d is number => d !== null && d >= 0);
      const closeArray = (jobs || [])
        .map(j => j.days_to_close)
        .filter((d): d is number => d !== null && d >= 0);
      const totalArray = (jobs || [])
        .map(j => j.total_cycle_days)
        .filter((d): d is number => d !== null && d >= 0);

      const calcMedian = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      const calcAvg = (arr: number[]) => {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      };

      const metrics: CycleTimeMetrics[] = [
        {
          stage: 'Job Create → Schedule',
          average: calcAvg(scheduleArray),
          median: calcMedian(scheduleArray),
          target: 7,
        },
        {
          stage: 'Schedule → Close',
          average: calcAvg(closeArray),
          median: calcMedian(closeArray),
          target: 7,
        },
        {
          stage: 'Total Pipeline',
          average: calcAvg(totalArray),
          median: calcMedian(totalArray),
          target: 14,
        },
      ];

      return metrics;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get cycle time distribution (bucket breakdown)
 */
export function useCycleTimeDistribution(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-cycle-distribution', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('total_cycle_days, total_revenue')
        .not('closed_date', 'is', null);

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

      const { data: allJobs, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch cycle distribution: ${error.message}`);
      }

      // Apply job size filter client-side
      const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
      const jobs = (allJobs || []).filter(job =>
        jobMatchesSizeFilter(job.total_revenue, jobSizes)
      );

      // Define buckets
      const buckets = [
        { bucket: '0-7 days', min: 0, max: 7 },
        { bucket: '8-14 days', min: 8, max: 14 },
        { bucket: '15-30 days', min: 15, max: 30 },
        { bucket: '31-60 days', min: 31, max: 60 },
        { bucket: '61+ days', min: 61, max: Infinity },
      ];

      const counts = buckets.map(b => ({ ...b, count: 0 }));
      const total = (jobs || []).filter(j => j.total_cycle_days !== null && j.total_cycle_days >= 0).length;

      for (const job of jobs || []) {
        const days = job.total_cycle_days;
        if (days === null || days < 0) continue;

        for (const bucket of counts) {
          if (days >= bucket.min && days <= bucket.max) {
            bucket.count++;
            break;
          }
        }
      }

      const distribution: CycleTimeDistribution[] = counts.map(b => ({
        bucket: b.bucket,
        count: b.count,
        percentage: total > 0 ? (b.count / total) * 100 : 0,
      }));

      return distribution;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get day of week patterns (when jobs are created vs scheduled)
 */
export function useDayOfWeekPatterns(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-day-patterns', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('created_date, scheduled_start_date');

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

      const { data: jobs, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch day patterns: ${error.message}`);
      }

      // Initialize day counts
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const patterns = days.map((day, index) => ({
        day,
        day_index: index,
        created: 0,
        scheduled: 0,
      }));

      for (const job of jobs || []) {
        if (job.created_date) {
          const date = new Date(job.created_date);
          patterns[date.getDay()].created++;
        }
        if (job.scheduled_start_date) {
          const date = new Date(job.scheduled_start_date);
          patterns[date.getDay()].scheduled++;
        }
      }

      return patterns as DayOfWeekPattern[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get speed to invoice metric (days from job close to invoice)
 */
export function useSpeedToInvoice(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-speed-to-invoice', filters],
    queryFn: async () => {
      // Get jobs with closed dates
      const { data: jobs, error: jobsError } = await supabase
        .from('jobber_builder_jobs')
        .select('job_number, closed_date')
        .not('closed_date', 'is', null);

      if (jobsError) {
        throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
      }

      // Get invoices with created dates
      const { data: invoices, error: invoicesError } = await supabase
        .from('jobber_builder_invoices')
        .select('job_numbers, created_date')
        .not('created_date', 'is', null);

      if (invoicesError) {
        throw new Error(`Failed to fetch invoices: ${invoicesError.message}`);
      }

      // Match jobs to invoices and calculate days
      const daysToInvoice: number[] = [];

      for (const job of jobs || []) {
        if (!job.closed_date) continue;

        // Find invoice for this job
        const invoice = (invoices || []).find(i =>
          i.job_numbers?.includes(String(job.job_number))
        );

        if (invoice?.created_date) {
          const closedDate = new Date(job.closed_date);
          const invoiceDate = new Date(invoice.created_date);
          const days = Math.floor((invoiceDate.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0) {
            daysToInvoice.push(days);
          }
        }
      }

      if (daysToInvoice.length === 0) {
        return { average: 0, median: 0 };
      }

      const average = daysToInvoice.reduce((a, b) => a + b, 0) / daysToInvoice.length;
      const sorted = [...daysToInvoice].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

      return { average, median };
    },
    staleTime: 5 * 60 * 1000,
  });
}
