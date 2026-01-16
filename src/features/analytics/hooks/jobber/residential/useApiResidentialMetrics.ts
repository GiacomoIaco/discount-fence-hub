// Hooks for fetching API-synced Residential analytics metrics
// Uses PostgreSQL functions that query jobber_api_opportunities table
// This is the CORRECTED version using sent_at (not drafted_at) for cycle times

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../../../lib/supabase';
import type {
  ResidentialFilters,
  FunnelMetrics,
  SalespersonMetrics,
  BucketMetrics,
  SpeedMetrics,
  QuoteCountMetrics,
  MonthlyTotals,
} from '../../../types/residential';
import { getResidentialDateRange } from '../../../types/residential';

// =====================
// SYNC STATUS
// =====================

export interface SyncStatus {
  id: string;
  last_sync_at: string | null;
  last_sync_type: string | null;
  last_sync_status: 'success' | 'failed' | 'in_progress' | null;
  last_error: string | null;
  quotes_synced: number;
  jobs_synced: number;
  requests_synced: number;
  opportunities_computed: number;
  updated_at: string;
}

export function useApiSyncStatus() {
  return useQuery({
    queryKey: ['jobber-api-sync-status', 'residential'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobber_sync_status')
        .select('*')
        .eq('id', 'residential')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No row found - sync hasn't run yet
          return null;
        }
        throw new Error(`Failed to fetch sync status: ${error.message}`);
      }

      return data as SyncStatus;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

// =====================
// FUNNEL METRICS (API)
// =====================

export interface ApiFunnelMetrics extends FunnelMetrics {
  avg_total_cycle: number | null;
  same_day_quote_pct: number | null;
  multi_quote_pct: number | null;
}

export function useApiResidentialFunnelMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.revenueBucket,
    filters?.speedBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-funnel-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_funnel_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
        p_speed_bucket: memoizedFilters?.speedBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API funnel metrics: ${error.message}`);
      }

      // RPC returns array, get first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as ApiFunnelMetrics;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// SALESPERSON METRICS (API)
// =====================

export interface ApiSalespersonMetrics extends SalespersonMetrics {
  pending_opps?: number;
  same_day_pct?: number;
}

export function useApiResidentialSalespersonMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-salesperson-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_salesperson_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API salesperson metrics: ${error.message}`);
      }

      return (data || []) as ApiSalespersonMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// PROJECT SIZE (BUCKET) METRICS (API)
// =====================

export function useApiResidentialBucketMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.speedBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-bucket-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_bucket_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_speed_bucket: memoizedFilters?.speedBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API bucket metrics: ${error.message}`);
      }

      return (data || []) as BucketMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// SPEED TO QUOTE METRICS (API)
// =====================

export function useApiResidentialSpeedMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-speed-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_speed_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API speed metrics: ${error.message}`);
      }

      return (data || []) as SpeedMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// QUOTE COUNT METRICS (API)
// =====================

export interface ApiQuoteCountMetrics extends QuoteCountMetrics {
  avg_days_to_decision?: number;
}

export function useApiResidentialQuoteCountMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-quote-count-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_quote_count_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API quote count metrics: ${error.message}`);
      }

      return (data || []) as ApiQuoteCountMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// MONTHLY TOTALS (API)
// =====================

export function useApiResidentialMonthlyTotals(
  months: number = 13,
  revenueBucket?: string,
  salesperson?: string
) {
  return useQuery({
    queryKey: ['jobber-api-residential-monthly-totals', months, revenueBucket, salesperson],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_api_residential_monthly_totals', {
        p_months: months,
        p_revenue_bucket: revenueBucket || null,
        p_salesperson: salesperson || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API monthly totals: ${error.message}`);
      }

      return (data || []) as MonthlyTotals[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// CYCLE TIME BREAKDOWN (API)
// =====================

export interface CycleTimeBreakdown {
  stage: string;
  stage_order: number;
  avg_days: number;
  median_days: number;
  p25_days: number;
  p75_days: number;
  min_days: number;
  max_days: number;
  sample_size: number;
}

export function useApiResidentialCycleBreakdown(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
  ]);

  return useQuery({
    queryKey: ['jobber-api-residential-cycle-breakdown', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_api_residential_cycle_breakdown', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
      });

      if (error) {
        throw new Error(`Failed to fetch API cycle breakdown: ${error.message}`);
      }

      return (data || []) as CycleTimeBreakdown[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// RAW DATA COUNTS (for debugging)
// =====================

export function useApiRawDataCounts() {
  return useQuery({
    queryKey: ['jobber-api-raw-data-counts'],
    queryFn: async () => {
      const [quotesRes, jobsRes, requestsRes, oppsRes] = await Promise.all([
        supabase.from('jobber_api_quotes').select('*', { count: 'exact', head: true }),
        supabase.from('jobber_api_jobs').select('*', { count: 'exact', head: true }),
        supabase.from('jobber_api_requests').select('*', { count: 'exact', head: true }),
        supabase.from('jobber_api_opportunities').select('*', { count: 'exact', head: true }),
      ]);

      return {
        quotes: quotesRes.count || 0,
        jobs: jobsRes.count || 0,
        requests: requestsRes.count || 0,
        opportunities: oppsRes.count || 0,
      };
    },
    staleTime: 60 * 1000,
  });
}

// =====================
// TRIGGER MANUAL SYNC
// =====================

export async function triggerManualSync(): Promise<{
  success: boolean;
  message?: string;
  stats?: {
    quotesProcessed: number;
    jobsProcessed: number;
    requestsProcessed: number;
    opportunitiesComputed: number;
    durationSeconds: number;
  };
  errors?: string[];
}> {
  try {
    const response = await fetch('/.netlify/functions/jobber-sync-manual?account=residential');
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
