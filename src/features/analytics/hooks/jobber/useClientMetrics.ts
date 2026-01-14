// Hook for fetching client (builder) metrics from Jobber data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { ClientMetrics, JobberFilters } from '../../types/jobber';

/**
 * Get client metrics using the database function
 */
export function useClientMetrics(filters?: JobberFilters, limit: number = 20) {
  return useQuery({
    queryKey: ['jobber-client-metrics', filters, limit],
    queryFn: async () => {
      // Try the RPC function first
      const { data, error } = await supabase.rpc('get_builder_client_metrics', {
        p_start_date: filters?.dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: filters?.dateRange.end?.toISOString().split('T')[0] || null,
        p_limit: limit,
      });

      if (error) {
        console.error('Error fetching client metrics:', error);
        return await fallbackClientMetrics(filters, limit);
      }

      return data as ClientMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fallback to client-side calculation if RPC fails
 */
async function fallbackClientMetrics(filters?: JobberFilters, limit: number = 20): Promise<ClientMetrics[]> {
  let query = supabase
    .from('jobber_builder_jobs')
    .select('client_name, total_revenue, is_warranty, total_cycle_days');

  if (filters?.dateRange.start) {
    query = query.gte('created_date', filters.dateRange.start.toISOString().split('T')[0]);
  }
  if (filters?.dateRange.end) {
    query = query.lte('created_date', filters.dateRange.end.toISOString().split('T')[0]);
  }

  const { data: jobs, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch jobs for client metrics: ${error.message}`);
  }

  // Group by client
  const clientMap = new Map<string, {
    total_jobs: number;
    total_revenue: number;
    warranty_jobs: number;
    cycle_days: number[];
  }>();

  for (const job of jobs || []) {
    const client = job.client_name || 'Unknown';
    if (client === 'Unknown') continue;

    const existing = clientMap.get(client) || {
      total_jobs: 0,
      total_revenue: 0,
      warranty_jobs: 0,
      cycle_days: [],
    };

    existing.total_jobs++;
    existing.total_revenue += Number(job.total_revenue) || 0;
    if (job.is_warranty) existing.warranty_jobs++;
    if (job.total_cycle_days !== null && job.total_cycle_days >= 0) {
      existing.cycle_days.push(job.total_cycle_days);
    }

    clientMap.set(client, existing);
  }

  // Convert to array and sort
  const result: ClientMetrics[] = Array.from(clientMap.entries())
    .map(([client_name, data]) => ({
      client_name,
      total_jobs: data.total_jobs,
      total_quotes: 0, // Would need to fetch from quotes table
      total_invoices: 0, // Would need to fetch from invoices table
      total_revenue: data.total_revenue,
      avg_job_value: data.total_jobs > 0 ? data.total_revenue / data.total_jobs : 0,
      warranty_jobs: data.warranty_jobs,
      avg_cycle_days: data.cycle_days.length > 0
        ? data.cycle_days.reduce((a, b) => a + b, 0) / data.cycle_days.length
        : null,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit);

  return result;
}

/**
 * Get community metrics
 */
export function useCommunityMetrics(filters?: JobberFilters, limit: number = 20) {
  return useQuery({
    queryKey: ['jobber-community-metrics', filters, limit],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_jobs')
        .select('community, client_name, effective_salesperson, total_revenue');

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
        throw new Error(`Failed to fetch jobs for community metrics: ${error.message}`);
      }

      // Group by community
      const communityMap = new Map<string, {
        revenue: number;
        jobs: number;
        builders: Set<string>;
        salespersons: Set<string>;
      }>();

      for (const job of jobs || []) {
        const community = job.community;
        if (!community) continue;

        const existing = communityMap.get(community) || {
          revenue: 0,
          jobs: 0,
          builders: new Set(),
          salespersons: new Set(),
        };

        existing.revenue += Number(job.total_revenue) || 0;
        existing.jobs++;
        if (job.client_name) existing.builders.add(job.client_name);
        if (job.effective_salesperson) existing.salespersons.add(job.effective_salesperson);

        communityMap.set(community, existing);
      }

      // Convert to array
      return Array.from(communityMap.entries())
        .map(([community, data]) => ({
          community,
          revenue: data.revenue,
          jobs: data.jobs,
          avg_job_value: data.jobs > 0 ? data.revenue / data.jobs : 0,
          primary_builders: Array.from(data.builders).slice(0, 3),
          primary_salespersons: Array.from(data.salespersons).slice(0, 3),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get client detail for drill-down view
 */
export function useClientDetail(clientName: string | null) {
  return useQuery({
    queryKey: ['jobber-client-detail', clientName],
    queryFn: async () => {
      if (!clientName) return null;

      // Get all jobs for this client
      const { data: jobs, error: jobsError } = await supabase
        .from('jobber_builder_jobs')
        .select('*')
        .eq('client_name', clientName)
        .order('created_date', { ascending: false });

      if (jobsError) {
        throw new Error(`Failed to fetch client jobs: ${jobsError.message}`);
      }

      // Get quotes for this client
      const { data: quotes, error: quotesError } = await supabase
        .from('jobber_builder_quotes')
        .select('*')
        .eq('client_name', clientName)
        .order('drafted_date', { ascending: false });

      if (quotesError) {
        console.error('Failed to fetch client quotes:', quotesError);
      }

      // Get invoices for this client
      const { data: invoices, error: invoicesError } = await supabase
        .from('jobber_builder_invoices')
        .select('*')
        .eq('client_name', clientName)
        .order('created_date', { ascending: false });

      if (invoicesError) {
        console.error('Failed to fetch client invoices:', invoicesError);
      }

      // Compute top communities for this client
      const communityMap = new Map<string, { revenue: number; jobs: number }>();
      for (const job of jobs || []) {
        const community = job.community;
        if (!community) continue;
        const existing = communityMap.get(community) || { revenue: 0, jobs: 0 };
        existing.revenue += Number(job.total_revenue) || 0;
        existing.jobs++;
        communityMap.set(community, existing);
      }

      const topCommunities = Array.from(communityMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Compute salesperson breakdown
      const spMap = new Map<string, { revenue: number; jobs: number }>();
      for (const job of jobs || []) {
        const sp = job.effective_salesperson || 'Unknown';
        const existing = spMap.get(sp) || { revenue: 0, jobs: 0 };
        existing.revenue += Number(job.total_revenue) || 0;
        existing.jobs++;
        spMap.set(sp, existing);
      }

      const salespersonBreakdown = Array.from(spMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        clientName,
        jobs: jobs || [],
        quotes: quotes || [],
        invoices: invoices || [],
        topCommunities,
        salespersonBreakdown,
        totalRevenue: (jobs || []).reduce((sum, j) => sum + (Number(j.total_revenue) || 0), 0),
        totalJobs: (jobs || []).length,
        warrantyJobs: (jobs || []).filter(j => j.is_warranty).length,
        recentJobs: (jobs || []).slice(0, 20),
      };
    },
    enabled: !!clientName,
    staleTime: 5 * 60 * 1000,
  });
}
