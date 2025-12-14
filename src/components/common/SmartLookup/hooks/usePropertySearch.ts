import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { PropertySearchResult } from '../types';

interface UsePropertySearchOptions {
  clientId?: string;
  communityId?: string;
  limit?: number;
}

export function usePropertySearch(
  query: string,
  options: UsePropertySearchOptions = {}
) {
  const { clientId, communityId, limit = 10 } = options;

  const [results, setResults] = useState<PropertySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce the search
  useEffect(() => {
    // Don't search if no client/community context
    if (!clientId && !communityId) {
      setResults([]);
      return;
    }

    // Don't search if query is too short (but allow empty query to show all)
    if (query.length > 0 && query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);

      try {
        let queryBuilder = supabase
          .from('properties')
          .select(`
            *,
            community:communities(
              *,
              client:clients(*)
            )
          `)
          .limit(limit)
          .order('address_line1');

        // Filter by community if provided
        if (communityId) {
          queryBuilder = queryBuilder.eq('community_id', communityId);
        } else if (clientId) {
          // If only client provided, we need to join through communities
          // This requires a different query approach
          const { data: communities } = await supabase
            .from('communities')
            .select('id')
            .eq('client_id', clientId);

          if (communities && communities.length > 0) {
            const communityIds = communities.map((c) => c.id);
            queryBuilder = queryBuilder.in('community_id', communityIds);
          } else {
            // No communities for this client
            setResults([]);
            setIsLoading(false);
            return;
          }
        }

        // Apply search filter
        if (query.length >= 2) {
          queryBuilder = queryBuilder.or(
            `address_line1.ilike.%${query}%,lot_number.ilike.%${query}%,homeowner_name.ilike.%${query}%,city.ilike.%${query}%`
          );
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        // Transform to PropertySearchResult
        const transformedResults: PropertySearchResult[] = (data || []).map((property: any) => ({
          ...property,
          has_active_request: false, // Would need to join with service_requests
          has_active_quote: false,   // Would need to join with quotes
          has_active_job: false,     // Would need to join with jobs
          last_activity: null,
        }));

        setResults(transformedResults);
      } catch (error) {
        console.error('Property search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, clientId, communityId, limit]);

  return { results, isLoading };
}
