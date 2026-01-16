// Hooks for fetching Residential analytics metrics
// Uses PostgreSQL functions for efficient aggregation

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../../../lib/supabase';
import type {
  ResidentialFilters,
  FunnelMetrics,
  SalespersonMetrics,
  BucketMetrics,
  SpeedMetrics,
  SpeedBySizeMetrics,
  QuoteCountMetrics,
  MonthlyTrend,
  MonthlyTotals,
  WeeklyTotals,
  WinRateMatrixEntry,
  WeeklyWinRateMatrixEntry,
  SalespersonMonthlyTrend,
} from '../../../types/residential';
import { getResidentialDateRange } from '../../../types/residential';

// =====================
// FUNNEL METRICS
// =====================

export function useResidentialFunnelMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.revenueBucket,
    filters?.speedBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-funnel-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_funnel_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
        p_speed_bucket: memoizedFilters?.speedBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch funnel metrics: ${error.message}`);
      }

      // RPC returns array, get first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as FunnelMetrics;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// SALESPERSON METRICS
// =====================

export function useResidentialSalespersonMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-salesperson-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_salesperson_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch salesperson metrics: ${error.message}`);
      }

      return (data || []) as SalespersonMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// PROJECT SIZE (BUCKET) METRICS
// =====================

export function useResidentialBucketMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.speedBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-bucket-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_bucket_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_speed_bucket: memoizedFilters?.speedBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch bucket metrics: ${error.message}`);
      }

      return (data || []) as BucketMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// SPEED TO QUOTE METRICS
// =====================

export function useResidentialSpeedMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-speed-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_speed_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch speed metrics: ${error.message}`);
      }

      return (data || []) as SpeedMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// SPEED x SIZE MATRIX
// =====================

export function useResidentialSpeedBySizeMatrix(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-speed-size-matrix', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_speed_by_size_matrix', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_salesperson: memoizedFilters?.salesperson || null,
      });

      if (error) {
        throw new Error(`Failed to fetch speed/size matrix: ${error.message}`);
      }

      return (data || []) as SpeedBySizeMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// QUOTE COUNT METRICS
// =====================

export function useResidentialQuoteCountMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-quote-count-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_quote_count_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch quote count metrics: ${error.message}`);
      }

      return (data || []) as QuoteCountMetrics[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// MONTHLY TRENDS
// =====================

export function useResidentialMonthlyTotals(months: number = 12, revenueBucket?: string) {
  return useQuery({
    queryKey: ['jobber-residential-monthly-totals', months, revenueBucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_residential_monthly_totals', {
        p_months: months,
        p_revenue_bucket: revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch monthly totals: ${error.message}`);
      }

      return (data || []) as MonthlyTrend[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useResidentialSalespersonMonthly(
  salesperson?: string,
  months: number = 12,
  filters?: ResidentialFilters
) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.revenueBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-salesperson-monthly', salesperson, months, memoizedFilters],
    queryFn: async () => {
      // If filtering by specific salesperson, query the table directly
      if (salesperson) {
        const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
          ? getResidentialDateRange(memoizedFilters.timePreset)
          : memoizedFilters?.dateRange || { start: null, end: null };

        let query = supabase
          .from('jobber_residential_opportunities')
          .select('first_quote_date, is_won, won_value, total_quoted_value, quote_count')
          .eq('salesperson', salesperson);

        if (dateRange.start) {
          query = query.gte('first_quote_date', dateRange.start.toISOString().split('T')[0]);
        }
        if (dateRange.end) {
          query = query.lte('first_quote_date', dateRange.end.toISOString().split('T')[0]);
        }
        if (memoizedFilters?.revenueBucket) {
          query = query.eq('revenue_bucket', memoizedFilters.revenueBucket);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch salesperson monthly: ${error.message}`);
        }

        // Group by month
        const monthlyMap = new Map<string, { total: number; won: number; value: number; totalValue: number }>();
        for (const row of data || []) {
          if (!row.first_quote_date) continue;
          const month = row.first_quote_date.substring(0, 7); // YYYY-MM
          const existing = monthlyMap.get(month) || { total: 0, won: 0, value: 0, totalValue: 0 };
          existing.total++;
          const wonValue = Number(row.won_value) || 0;
          const avgQuote = (Number(row.total_quoted_value) || 0) / (Number(row.quote_count) || 1);
          if (row.is_won) {
            existing.won++;
            existing.value += wonValue;
            existing.totalValue += wonValue;
          } else {
            existing.totalValue += avgQuote;
          }
          monthlyMap.set(month, existing);
        }

        // Convert to array and sort
        return Array.from(monthlyMap.entries())
          .map(([month, stats]) => ({
            month,
            month_label: new Date(month + '-01').toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            }),
            salesperson: salesperson,
            total_opps: stats.total,
            won_opps: stats.won,
            win_rate: stats.total > 0 ? Math.round((stats.won / stats.total) * 1000) / 10 : null,
            won_value: stats.value,
            total_value: stats.totalValue,
            value_win_rate: stats.totalValue > 0 ? Math.round((stats.value / stats.totalValue) * 1000) / 10 : null,
          }))
          .sort((a, b) => b.month.localeCompare(a.month))
          .slice(0, months) as SalespersonMonthlyTrend[];
      }

      // Otherwise use the RPC function
      const { data, error } = await supabase.rpc('get_residential_salesperson_monthly', {
        p_months: months,
        p_revenue_bucket: memoizedFilters?.revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch salesperson monthly: ${error.message}`);
      }

      return (data || []) as SalespersonMonthlyTrend[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: salesperson !== undefined || true, // Always enable for RPC mode
  });
}

// =====================
// WEEKLY TOTALS (Histogram)
// =====================

export function useResidentialWeeklyTotals(weeks: number = 13, revenueBucket?: string) {
  return useQuery({
    queryKey: ['jobber-residential-weekly-totals', weeks, revenueBucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_residential_weekly_totals', {
        p_weeks: weeks,
        p_revenue_bucket: revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch weekly totals: ${error.message}`);
      }

      return (data || []) as WeeklyTotals[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// ENHANCED MONTHLY TOTALS (with value_win_rate)
// =====================

export function useResidentialEnhancedMonthlyTotals(months: number = 13, revenueBucket?: string) {
  return useQuery({
    queryKey: ['jobber-residential-enhanced-monthly-totals', months, revenueBucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_residential_monthly_totals', {
        p_months: months,
        p_revenue_bucket: revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch enhanced monthly totals: ${error.message}`);
      }

      return (data || []) as MonthlyTotals[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// WIN RATE MATRIX (Salesperson × Month)
// =====================

export function useResidentialWinRateMatrix(months: number = 12, revenueBucket?: string) {
  return useQuery({
    queryKey: ['jobber-residential-win-rate-matrix', months, revenueBucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_residential_win_rate_matrix', {
        p_months: months,
        p_revenue_bucket: revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch win rate matrix: ${error.message}`);
      }

      return (data || []) as WinRateMatrixEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// WEEKLY WIN RATE MATRIX (Salesperson × Week)
// =====================

export function useResidentialWinRateMatrixWeekly(weeks: number = 13, revenueBucket?: string) {
  return useQuery({
    queryKey: ['jobber-residential-win-rate-matrix-weekly', weeks, revenueBucket],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_residential_win_rate_matrix_weekly', {
        p_weeks: weeks,
        p_revenue_bucket: revenueBucket || null,
      });

      if (error) {
        throw new Error(`Failed to fetch weekly win rate matrix: ${error.message}`);
      }

      return (data || []) as WeeklyWinRateMatrixEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// WARRANTY METRICS
// =====================

import type { WarrantyMetrics, RequestMetrics } from '../../../types/residential';

export function useResidentialWarrantyMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
  ]);

  return useQuery({
    queryKey: ['jobber-residential-warranty-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_warranty_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
        p_baseline_weeks: 8, // 8-week baseline for warranty %
      });

      if (error) {
        throw new Error(`Failed to fetch warranty metrics: ${error.message}`);
      }

      // RPC returns array, get first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as WarrantyMetrics;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =====================
// REQUEST METRICS (Assessments)
// =====================

export function useResidentialRequestMetrics(filters?: ResidentialFilters) {
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
  ]);

  return useQuery({
    queryKey: ['jobber-residential-request-metrics', memoizedFilters],
    queryFn: async () => {
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      const { data, error } = await supabase.rpc('get_residential_request_metrics', {
        p_start_date: dateRange.start?.toISOString().split('T')[0] || null,
        p_end_date: dateRange.end?.toISOString().split('T')[0] || null,
      });

      if (error) {
        throw new Error(`Failed to fetch request metrics: ${error.message}`);
      }

      // RPC returns array, get first row
      const row = Array.isArray(data) ? data[0] : data;
      return row as RequestMetrics;
    },
    staleTime: 5 * 60 * 1000,
  });
}
