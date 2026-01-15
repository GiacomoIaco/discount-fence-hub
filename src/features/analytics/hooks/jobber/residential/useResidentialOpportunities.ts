// Hook for fetching Residential opportunities data
// Uses pagination to handle 7,759+ records (Supabase 1000-row limit)

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../../../lib/supabase';
import type {
  ResidentialOpportunity,
  ResidentialFilters,
} from '../../../types/residential';
import { getResidentialDateRange } from '../../../types/residential';

interface UseResidentialOpportunitiesOptions {
  filters?: ResidentialFilters;
  enabled?: boolean;
}

/**
 * Fetch all opportunities with pagination and filters
 */
export function useResidentialOpportunities({
  filters,
  enabled = true,
}: UseResidentialOpportunitiesOptions = {}) {
  // Memoize filters to prevent infinite re-renders
  const memoizedFilters = useMemo(() => filters, [
    filters?.timePreset,
    filters?.dateRange?.start?.getTime(),
    filters?.dateRange?.end?.getTime(),
    filters?.salesperson,
    filters?.revenueBucket,
    filters?.speedBucket,
    filters?.quoteCountBucket,
  ]);

  return useQuery({
    queryKey: ['jobber-residential-opportunities', memoizedFilters],
    queryFn: async () => {
      const allOpps: ResidentialOpportunity[] = [];
      const pageSize = 1000;
      let offset = 0;

      // Get date range from preset if needed
      const dateRange = memoizedFilters?.timePreset && memoizedFilters.timePreset !== 'custom'
        ? getResidentialDateRange(memoizedFilters.timePreset)
        : memoizedFilters?.dateRange || { start: null, end: null };

      // Fetch all pages
      while (true) {
        let query = supabase
          .from('jobber_residential_opportunities')
          .select('*')
          .order('first_quote_date', { ascending: false })
          .range(offset, offset + pageSize - 1);

        // Apply date filters
        if (dateRange.start) {
          query = query.gte('first_quote_date', dateRange.start.toISOString().split('T')[0]);
        }
        if (dateRange.end) {
          query = query.lte('first_quote_date', dateRange.end.toISOString().split('T')[0]);
        }

        // Apply salesperson filter
        if (memoizedFilters?.salesperson) {
          query = query.eq('salesperson', memoizedFilters.salesperson);
        }

        // Apply revenue bucket filter
        if (memoizedFilters?.revenueBucket) {
          query = query.eq('revenue_bucket', memoizedFilters.revenueBucket);
        }

        // Apply speed bucket filter
        if (memoizedFilters?.speedBucket) {
          query = query.eq('speed_to_quote_bucket', memoizedFilters.speedBucket);
        }

        // Apply quote count bucket filter
        if (memoizedFilters?.quoteCountBucket) {
          query = query.eq('quote_count_bucket', memoizedFilters.quoteCountBucket);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch opportunities: ${error.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        allOpps.push(...(data as ResidentialOpportunity[]));

        // If we got fewer than pageSize, we've reached the end
        if (data.length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      return allOpps;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get distinct salesperson values for filter dropdown
 */
export function useResidentialSalespersons() {
  return useQuery({
    queryKey: ['jobber-residential-salespersons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobber_residential_opportunities')
        .select('salesperson')
        .not('salesperson', 'is', null)
        .not('salesperson', 'eq', '');

      if (error) {
        throw new Error(`Failed to fetch salespersons: ${error.message}`);
      }

      // Get unique values
      const unique = [...new Set(data?.map(d => d.salesperson).filter(Boolean) || [])];
      return unique.sort();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get opportunity count (quick stats)
 */
export function useResidentialOpportunityCount(filters?: ResidentialFilters) {
  return useQuery({
    queryKey: ['jobber-residential-opportunity-count', filters],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('jobber_residential_opportunities')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw new Error(`Failed to count opportunities: ${error.message}`);
      }

      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}
