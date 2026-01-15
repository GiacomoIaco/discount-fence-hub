// Hook for fetching salesperson metrics from Jobber data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { SalespersonMetrics, JobberFilters, MonthlyTrend } from '../../types/jobber';
import { jobMatchesSizeFilter, DEFAULT_JOBBER_FILTERS } from '../../types/jobber';

/**
 * Get salesperson metrics using the database function
 */
export function useSalespersonMetrics(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-salesperson-metrics', filters],
    queryFn: async () => {
      // Call the PostgreSQL function
      const { data, error } = await supabase.rpc('get_builder_salesperson_metrics', {
        p_start_date: filters?.dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: filters?.dateRange.end?.toISOString().split('T')[0] || null,
        p_franchise_location: filters?.location || null,
      });

      if (error) {
        console.error('Error fetching salesperson metrics:', error);
        // Fall back to client-side calculation
        return await fallbackSalespersonMetrics(filters);
      }

      return data as SalespersonMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fallback to client-side calculation if RPC fails
 * Now calculates small_jobs ($1-500) and warranty_percent
 */
async function fallbackSalespersonMetrics(filters?: JobberFilters): Promise<SalespersonMetrics[]> {
  let query = supabase
    .from('jobber_builder_jobs')
    .select('effective_salesperson, total_revenue, is_substantial, is_warranty, days_to_schedule, days_to_close, total_cycle_days');

  if (filters?.dateRange.start) {
    query = query.gte('created_date', filters.dateRange.start.toISOString().split('T')[0]);
  }
  if (filters?.dateRange.end) {
    query = query.lte('created_date', filters.dateRange.end.toISOString().split('T')[0]);
  }
  if (filters?.location) {
    query = query.eq('franchise_location', filters.location);
  }

  const { data: jobs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch jobs for salesperson metrics: ${error.message}`);
  }

  // Apply job size filters if specified
  const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;

  // Group by salesperson
  const spMap = new Map<string, {
    total_jobs: number;
    substantial_jobs: number;
    small_jobs: number;
    warranty_jobs: number;
    total_revenue: number;
    schedule_days: number[];
    close_days: number[];
    cycle_days: number[];
  }>();

  for (const job of jobs || []) {
    const sp = job.effective_salesperson || '(Unassigned)';
    if (sp === '(Unassigned)') continue;

    const revenue = Number(job.total_revenue) || 0;

    // Check if this job matches the size filter
    if (!jobMatchesSizeFilter(revenue, jobSizes)) continue;

    const existing = spMap.get(sp) || {
      total_jobs: 0,
      substantial_jobs: 0,
      small_jobs: 0,
      warranty_jobs: 0,
      total_revenue: 0,
      schedule_days: [],
      close_days: [],
      cycle_days: [],
    };

    existing.total_jobs++;
    existing.total_revenue += revenue;

    // Categorize by revenue-based job size
    if (revenue > 500) {
      existing.substantial_jobs++;
    } else if (revenue > 0) {
      existing.small_jobs++;
    } else {
      existing.warranty_jobs++;
    }

    if (job.days_to_schedule !== null && job.days_to_schedule >= 0) {
      existing.schedule_days.push(job.days_to_schedule);
    }
    if (job.days_to_close !== null && job.days_to_close >= 0) {
      existing.close_days.push(job.days_to_close);
    }
    if (job.total_cycle_days !== null && job.total_cycle_days >= 0) {
      existing.cycle_days.push(job.total_cycle_days);
    }

    spMap.set(sp, existing);
  }

  // Convert to array
  const result: SalespersonMetrics[] = Array.from(spMap.entries())
    .map(([name, data]) => ({
      name,
      total_jobs: data.total_jobs,
      substantial_jobs: data.substantial_jobs,
      small_jobs: data.small_jobs,
      warranty_jobs: data.warranty_jobs,
      warranty_percent: data.total_jobs > 0 ? (data.warranty_jobs / data.total_jobs) * 100 : 0,
      total_revenue: data.total_revenue,
      avg_job_value: data.substantial_jobs > 0 ? data.total_revenue / data.substantial_jobs : 0,
      avg_days_to_schedule: data.schedule_days.length > 0
        ? data.schedule_days.reduce((a, b) => a + b, 0) / data.schedule_days.length
        : null,
      avg_days_to_close: data.close_days.length > 0
        ? data.close_days.reduce((a, b) => a + b, 0) / data.close_days.length
        : null,
      avg_total_days: data.cycle_days.length > 0
        ? data.cycle_days.reduce((a, b) => a + b, 0) / data.cycle_days.length
        : null,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  return result;
}

/**
 * Get monthly trend data - now accepts full filters object
 * This ensures date range, salesperson, location, and job sizes are all respected
 */
export function useMonthlyTrend(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-monthly-trend', filters],
    queryFn: async () => {
      // Always use client-side calculation for flexibility with job size filters
      return await calculateMonthlyTrend(filters);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Calculate monthly trend with full filter support
 */
async function calculateMonthlyTrend(filters?: JobberFilters): Promise<MonthlyTrend[]> {
  const dateField = filters?.dateField || 'created_date';

  let query = supabase
    .from('jobber_builder_jobs')
    .select('created_date, scheduled_start_date, closed_date, total_revenue, is_substantial, is_warranty');

  // Apply date range from filters using the selected date field
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

  const { data: jobs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch monthly trend: ${error.message}`);
  }

  // Apply job size filter client-side
  const jobSizes = filters?.jobSizes || DEFAULT_JOBBER_FILTERS.jobSizes;
  const filteredJobs = (jobs || []).filter(job =>
    jobMatchesSizeFilter(job.total_revenue, jobSizes)
  );

  // Group by month using the selected date field
  const monthMap = new Map<string, {
    label: string;
    total_jobs: number;
    substantial_jobs: number;
    warranty_jobs: number;
    small_jobs: number;
    revenue: number;
  }>();

  for (const job of filteredJobs) {
    // Get the date value based on selected date field
    const dateValue = job[dateField as keyof typeof job] as string | null;
    if (!dateValue) continue;

    const date = new Date(dateValue);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    const existing = monthMap.get(monthKey) || {
      label,
      total_jobs: 0,
      substantial_jobs: 0,
      warranty_jobs: 0,
      small_jobs: 0,
      revenue: 0,
    };

    existing.total_jobs++;
    const revenue = Number(job.total_revenue) || 0;
    existing.revenue += revenue;

    // Categorize by revenue-based job size
    if (revenue > 500) {
      existing.substantial_jobs++;
    } else if (revenue > 0) {
      existing.small_jobs++;
    } else {
      existing.warranty_jobs++;
    }

    monthMap.set(monthKey, existing);
  }

  // Convert to sorted array
  return Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      ...data,
      avg_job_value: data.substantial_jobs > 0 ? data.revenue / data.substantial_jobs : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get salesperson detail for drill-down view
 */
export function useSalespersonDetail(salesperson: string | null) {
  return useQuery({
    queryKey: ['jobber-salesperson-detail', salesperson],
    queryFn: async () => {
      if (!salesperson) return null;

      // Get all jobs for this salesperson
      const { data: jobs, error } = await supabase
        .from('jobber_builder_jobs')
        .select('*')
        .eq('effective_salesperson', salesperson)
        .order('created_date', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch salesperson detail: ${error.message}`);
      }

      // Compute top clients
      const clientMap = new Map<string, { revenue: number; jobs: number }>();
      for (const job of jobs || []) {
        const client = job.client_name || 'Unknown';
        const existing = clientMap.get(client) || { revenue: 0, jobs: 0 };
        existing.revenue += Number(job.total_revenue) || 0;
        existing.jobs++;
        clientMap.set(client, existing);
      }

      const topClients = Array.from(clientMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Compute top communities
      const communityMap = new Map<string, { revenue: number; jobs: number }>();
      for (const job of jobs || []) {
        const community = job.community || 'Unknown';
        if (community === 'Unknown') continue;
        const existing = communityMap.get(community) || { revenue: 0, jobs: 0 };
        existing.revenue += Number(job.total_revenue) || 0;
        existing.jobs++;
        communityMap.set(community, existing);
      }

      const topCommunities = Array.from(communityMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        salesperson,
        jobs: jobs || [],
        topClients,
        topCommunities,
        recentJobs: (jobs || []).slice(0, 20),
      };
    },
    enabled: !!salesperson,
    staleTime: 5 * 60 * 1000,
  });
}
