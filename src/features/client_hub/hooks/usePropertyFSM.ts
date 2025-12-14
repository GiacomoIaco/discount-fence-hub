/**
 * usePropertyFSM - Hooks to fetch FSM entities related to a property
 *
 * Enables viewing all requests, quotes, jobs for a specific property/address
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { ServiceRequest, Quote, Job } from '../../fsm/types';

/**
 * Get all service requests for a property
 */
export function usePropertyRequests(propertyId: string | null) {
  return useQuery({
    queryKey: ['property-requests', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name),
          assigned_rep:sales_reps(id, name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!propertyId,
  });
}

/**
 * Get all quotes for a property
 */
export function usePropertyQuotes(propertyId: string | null) {
  return useQuery({
    queryKey: ['property-quotes', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name),
          sales_rep:sales_reps(id, name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!propertyId,
  });
}

/**
 * Get all jobs for a property
 */
export function usePropertyJobs(propertyId: string | null) {
  return useQuery({
    queryKey: ['property-jobs', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name),
          assigned_crew:crews(id, name, code)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Job[];
    },
    enabled: !!propertyId,
  });
}

/**
 * Get summary counts for a property
 */
export function usePropertySummary(propertyId: string | null) {
  return useQuery({
    queryKey: ['property-summary', propertyId],
    queryFn: async () => {
      if (!propertyId) return { requests: 0, quotes: 0, jobs: 0, totalValue: 0 };

      // Get counts in parallel
      const [requestsResult, quotesResult, jobsResult] = await Promise.all([
        supabase
          .from('service_requests')
          .select('id', { count: 'exact', head: true })
          .eq('property_id', propertyId),
        supabase
          .from('quotes')
          .select('id, total', { count: 'exact' })
          .eq('property_id', propertyId),
        supabase
          .from('jobs')
          .select('id, quoted_total', { count: 'exact' })
          .eq('property_id', propertyId),
      ]);

      // Calculate total value from jobs
      const totalValue = (jobsResult.data || []).reduce(
        (sum, job) => sum + (job.quoted_total || 0),
        0
      );

      return {
        requests: requestsResult.count || 0,
        quotes: quotesResult.count || 0,
        jobs: jobsResult.count || 0,
        totalValue,
      };
    },
    enabled: !!propertyId,
  });
}
