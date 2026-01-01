/**
 * usePropertyFSM - Hooks to fetch FSM entities related to a property
 *
 * Enables viewing all requests, quotes, jobs for a specific property/address
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { ServiceRequest, Quote, Job, RepUser } from '../../fsm/types';

// Helper to fetch user profiles by IDs
async function fetchUserProfiles(userIds: string[]): Promise<Map<string, RepUser>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, phone')
    .in('id', userIds);

  if (error) {
    console.warn('Failed to fetch user profiles:', error);
    return new Map();
  }

  const map = new Map<string, RepUser>();
  (data || []).forEach(u => map.set(u.id, {
    id: u.id,
    full_name: u.full_name,
    email: u.email || '',
    phone: u.phone || null,
  }));
  return map;
}

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
          community:communities(id, name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for reps
      const userIds = new Set<string>();
      (data || []).forEach(req => {
        if (req.assigned_rep_user_id) userIds.add(req.assigned_rep_user_id);
      });

      const userMap = await fetchUserProfiles(Array.from(userIds));

      return (data || []).map(req => ({
        ...req,
        assigned_rep_user: req.assigned_rep_user_id ? userMap.get(req.assigned_rep_user_id) : undefined,
      })) as ServiceRequest[];
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
          community:communities(id, name)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for reps
      const userIds = new Set<string>();
      (data || []).forEach(quote => {
        if (quote.sales_rep_user_id) userIds.add(quote.sales_rep_user_id);
      });

      const userMap = await fetchUserProfiles(Array.from(userIds));

      return (data || []).map(quote => ({
        ...quote,
        sales_rep_user: quote.sales_rep_user_id ? userMap.get(quote.sales_rep_user_id) : undefined,
      })) as Quote[];
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
