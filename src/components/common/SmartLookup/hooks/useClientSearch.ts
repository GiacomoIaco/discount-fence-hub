import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { ClientSearchResult } from '../types';

interface UseClientSearchOptions {
  businessUnit?: 'residential' | 'commercial' | 'builders';
  limit?: number;
}

// Normalize phone number for comparison (remove all non-digits)
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function useClientSearch(
  query: string,
  options: UseClientSearchOptions = {}
) {
  const { businessUnit, limit = 10 } = options;

  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Normalize phone for search
  const normalizedPhone = useMemo(() => normalizePhone(query), [query]);

  // Debounce the search
  useEffect(() => {
    // Don't search if query is too short
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);

      try {
        const allResults: ClientSearchResult[] = [];

        // ============================================
        // 1. Search CLIENTS
        // ============================================
        const clientConditions = [
          `name.ilike.%${query}%`,
          `code.ilike.%${query}%`,
          `primary_contact_email.ilike.%${query}%`,
        ];

        if (normalizedPhone.length >= 3) {
          clientConditions.push(`primary_contact_phone.ilike.%${normalizedPhone}%`);
        }

        let clientQuery = supabase
          .from('clients')
          .select(`
            *,
            communities:communities(count)
          `)
          .or(clientConditions.join(','))
          .eq('status', 'active')
          .limit(limit);

        if (businessUnit) {
          clientQuery = clientQuery.eq('business_unit', businessUnit);
        }

        const { data: clients, error: clientError } = await clientQuery;
        if (clientError) throw clientError;

        // Transform client results
        (clients || []).forEach((client: any) => {
          const q = query.toLowerCase();
          let matchField: 'name' | 'phone' | 'email' | 'code' = 'name';
          let confidence = 70;

          // Determine match field and confidence
          if (client.code?.toLowerCase().includes(q)) {
            matchField = 'code';
            confidence = client.code.toLowerCase() === q ? 100 : 85;
          } else if (client.primary_contact_email?.toLowerCase().includes(q)) {
            matchField = 'email';
            confidence = 90;
          } else if (normalizedPhone.length >= 3 && client.primary_contact_phone) {
            const clientPhone = normalizePhone(client.primary_contact_phone);
            if (clientPhone.includes(normalizedPhone)) {
              matchField = 'phone';
              confidence = 95;
            }
          } else if (client.name?.toLowerCase().startsWith(q)) {
            confidence = 90;
          }

          allResults.push({
            entity_type: 'client',
            id: client.id,
            name: client.name,
            display_name: client.name,
            subtitle: client.business_unit === 'builders' ? 'Builder' :
                      client.business_unit === 'commercial' ? 'Commercial' : 'Residential',
            primary_contact_name: client.primary_contact_name,
            primary_contact_phone: client.primary_contact_phone,
            primary_contact_email: client.primary_contact_email,
            address_line1: client.address_line1,
            city: client.city,
            state: client.state,
            zip: client.zip,
            match_field: matchField,
            match_confidence: confidence,
            communities_count: client.communities?.[0]?.count || 0,
            client_data: client,
            last_activity: null,
          });
        });

        // ============================================
        // 2. Search COMMUNITIES (sub-clients)
        // ============================================
        const communityConditions = [
          `name.ilike.%${query}%`,
          `code.ilike.%${query}%`,
        ];

        let communityQuery = supabase
          .from('communities')
          .select(`
            *,
            client:clients!inner(*),
            properties:properties(count)
          `)
          .or(communityConditions.join(','))
          .eq('status', 'active');

        if (businessUnit) {
          communityQuery = communityQuery.eq('client.business_unit', businessUnit);
        }

        const { data: communities, error: communityError } = await communityQuery.limit(limit);
        if (communityError) throw communityError;

        // Transform community results
        (communities || []).forEach((community: any) => {
          const q = query.toLowerCase();
          let matchField: 'name' | 'phone' | 'email' | 'code' = 'name';
          let confidence = 75; // Communities get slightly higher base confidence

          if (community.code?.toLowerCase().includes(q)) {
            matchField = 'code';
            confidence = community.code.toLowerCase() === q ? 100 : 85;
          } else if (community.name?.toLowerCase().startsWith(q)) {
            confidence = 92;
          }

          allResults.push({
            entity_type: 'community',
            id: community.id,
            name: community.name,
            display_name: community.name,
            parent_name: community.client?.name,
            subtitle: `Community under ${community.client?.name}`,
            primary_contact_name: community.client?.primary_contact_name,
            primary_contact_phone: community.client?.primary_contact_phone,
            primary_contact_email: community.client?.primary_contact_email,
            address_line1: community.address_line1,
            city: community.city,
            state: community.state,
            zip: community.zip,
            match_field: matchField,
            match_confidence: confidence,
            property_count: community.properties?.[0]?.count || 0,
            client_data: community.client,
            community_data: community,
            last_activity: null,
          });
        });

        // Sort by confidence (highest first)
        allResults.sort((a, b) => b.match_confidence - a.match_confidence);

        // Limit total results
        setResults(allResults.slice(0, limit));
      } catch (error) {
        console.error('Client/Community search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, normalizedPhone, businessUnit, limit]);

  return { results, isLoading };
}
