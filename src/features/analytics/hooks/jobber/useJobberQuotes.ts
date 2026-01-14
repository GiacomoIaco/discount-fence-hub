// Hook for fetching Jobber builder quotes data

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { JobberBuilderQuote, JobberFilters, QuoteStatusMetrics } from '../../types/jobber';

interface UseJobberQuotesOptions {
  filters?: JobberFilters;
  enabled?: boolean;
}

/**
 * Fetch builder quotes with optional filters
 */
export function useJobberQuotes({ filters, enabled = true }: UseJobberQuotesOptions = {}) {
  return useQuery({
    queryKey: ['jobber-quotes', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobber_builder_quotes')
        .select('*')
        .order('drafted_date', { ascending: false });

      // Apply date filters
      if (filters?.dateRange.start) {
        query = query.gte('drafted_date', filters.dateRange.start.toISOString().split('T')[0]);
      }
      if (filters?.dateRange.end) {
        query = query.lte('drafted_date', filters.dateRange.end.toISOString().split('T')[0]);
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
        throw new Error(`Failed to fetch quotes: ${error.message}`);
      }

      return data as JobberBuilderQuote[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get quote status breakdown
 */
export function useQuoteStatusMetrics(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-quote-status-metrics', filters],
    queryFn: async () => {
      // Get all quotes to compute status breakdown
      const { data: quotes, error } = await supabase
        .from('jobber_builder_quotes')
        .select('status, total');

      if (error) {
        throw new Error(`Failed to fetch quote status: ${error.message}`);
      }

      // Group by status
      const statusMap = new Map<string, { count: number; value: number }>();
      let totalValue = 0;

      for (const quote of quotes || []) {
        const status = quote.status || 'Unknown';
        const value = Number(quote.total) || 0;
        totalValue += value;

        const existing = statusMap.get(status) || { count: 0, value: 0 };
        statusMap.set(status, {
          count: existing.count + 1,
          value: existing.value + value,
        });
      }

      // Convert to array with percentages
      const result: QuoteStatusMetrics[] = Array.from(statusMap.entries())
        .map(([status, data]) => ({
          status,
          count: data.count,
          value: data.value,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get quote conversion metrics
 */
export function useQuoteConversionMetrics(filters?: JobberFilters) {
  return useQuery({
    queryKey: ['jobber-quote-conversion', filters],
    queryFn: async () => {
      const { data: quotes, error } = await supabase
        .from('jobber_builder_quotes')
        .select('status, total, days_to_convert');

      if (error) {
        throw new Error(`Failed to fetch quote conversion: ${error.message}`);
      }

      const total = quotes?.length || 0;
      const converted = quotes?.filter(q => q.status === 'Converted').length || 0;
      const conversionRate = total > 0 ? (converted / total) * 100 : 0;

      // Calculate average days to convert
      const convertedWithDays = quotes?.filter(q => q.days_to_convert !== null && q.days_to_convert >= 0) || [];
      const avgDaysToConvert = convertedWithDays.length > 0
        ? convertedWithDays.reduce((sum, q) => sum + (q.days_to_convert || 0), 0) / convertedWithDays.length
        : 0;

      // Calculate median days to convert
      const daysArray = convertedWithDays.map(q => q.days_to_convert || 0).sort((a, b) => a - b);
      const medianDaysToConvert = daysArray.length > 0
        ? daysArray.length % 2 === 0
          ? (daysArray[daysArray.length / 2 - 1] + daysArray[daysArray.length / 2]) / 2
          : daysArray[Math.floor(daysArray.length / 2)]
        : 0;

      return {
        totalQuotes: total,
        convertedQuotes: converted,
        conversionRate,
        avgDaysToConvert,
        medianDaysToConvert,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
