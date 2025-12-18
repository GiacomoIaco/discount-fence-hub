/**
 * SKU Search Hook for Quote Line Items (O-036)
 *
 * Features:
 * - Type-ahead search against sku_catalog_v2 table
 * - Recent items tracking (localStorage)
 * - Product type filtering
 * - Auto-populated pricing via rate sheet resolution
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

const RECENT_SKUS_KEY = 'dfh_recent_skus';
const MAX_RECENT_ITEMS = 10;

export interface SkuSearchResult {
  id: string;
  sku_code: string;
  sku_name: string;
  product_type_id: string;
  product_type_name: string;
  product_type_code: string;
  product_style_id: string;
  product_style_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
}

interface UseSkuSearchOptions {
  productTypeCode?: string;
  enabled?: boolean;
}

/**
 * Get recent SKU IDs from localStorage
 */
function getRecentSkuIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SKUS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a SKU ID to recent list
 */
function addToRecentSkus(skuId: string): void {
  try {
    const recent = getRecentSkuIds().filter(id => id !== skuId);
    recent.unshift(skuId);
    localStorage.setItem(RECENT_SKUS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_ITEMS)));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Search SKUs with type-ahead
 */
export function useSkuSearch(query: string, options: UseSkuSearchOptions = {}) {
  const { productTypeCode, enabled = true } = options;
  const trimmedQuery = query.trim();

  return useQuery({
    queryKey: ['sku-search', trimmedQuery, productTypeCode],
    queryFn: async () => {
      let dbQuery = supabase
        .from('sku_catalog_v2')
        .select(`
          id,
          sku_code,
          sku_name,
          product_type_id,
          product_style_id,
          height,
          post_type,
          standard_material_cost,
          standard_labor_cost,
          standard_cost_per_foot,
          product_type:product_types_v2(id, code, name),
          product_style:product_styles_v2(id, code, name)
        `)
        .eq('is_active', true)
        .order('sku_code')
        .limit(20);

      // Filter by search query (SKU code or name)
      if (trimmedQuery) {
        dbQuery = dbQuery.or(`sku_code.ilike.%${trimmedQuery}%,sku_name.ilike.%${trimmedQuery}%`);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      // Transform to flat structure
      const results: SkuSearchResult[] = (data || [])
        .filter((item: Record<string, unknown>) => {
          // Filter by product type if specified
          if (productTypeCode && item.product_type) {
            const productType = item.product_type as { code: string };
            return productType.code === productTypeCode;
          }
          return true;
        })
        .map((item: Record<string, unknown>) => {
          const productType = item.product_type as { id: string; code: string; name: string } | null;
          const productStyle = item.product_style as { id: string; code: string; name: string } | null;
          return {
            id: item.id as string,
            sku_code: item.sku_code as string,
            sku_name: item.sku_name as string,
            product_type_id: item.product_type_id as string,
            product_type_name: productType?.name || '',
            product_type_code: productType?.code || '',
            product_style_id: item.product_style_id as string,
            product_style_name: productStyle?.name || '',
            height: item.height as number,
            post_type: item.post_type as 'WOOD' | 'STEEL',
            standard_material_cost: item.standard_material_cost as number | null,
            standard_labor_cost: item.standard_labor_cost as number | null,
            standard_cost_per_foot: item.standard_cost_per_foot as number | null,
          };
        });

      return results;
    },
    enabled: enabled && trimmedQuery.length >= 1,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}

/**
 * Fetch recent SKUs
 */
export function useRecentSkus(options: UseSkuSearchOptions = {}) {
  const { productTypeCode, enabled = true } = options;
  const recentIds = getRecentSkuIds();

  return useQuery({
    queryKey: ['recent-skus', recentIds.join(','), productTypeCode],
    queryFn: async () => {
      if (recentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('sku_catalog_v2')
        .select(`
          id,
          sku_code,
          sku_name,
          product_type_id,
          product_style_id,
          height,
          post_type,
          standard_material_cost,
          standard_labor_cost,
          standard_cost_per_foot,
          product_type:product_types_v2(id, code, name),
          product_style:product_styles_v2(id, code, name)
        `)
        .in('id', recentIds)
        .eq('is_active', true);

      if (error) throw error;

      // Transform and sort by recent order
      const results: SkuSearchResult[] = (data || [])
        .filter((item: Record<string, unknown>) => {
          if (productTypeCode && item.product_type) {
            const productType = item.product_type as { code: string };
            return productType.code === productTypeCode;
          }
          return true;
        })
        .map((item: Record<string, unknown>) => {
          const productType = item.product_type as { id: string; code: string; name: string } | null;
          const productStyle = item.product_style as { id: string; code: string; name: string } | null;
          return {
            id: item.id as string,
            sku_code: item.sku_code as string,
            sku_name: item.sku_name as string,
            product_type_id: item.product_type_id as string,
            product_type_name: productType?.name || '',
            product_type_code: productType?.code || '',
            product_style_id: item.product_style_id as string,
            product_style_name: productStyle?.name || '',
            height: item.height as number,
            post_type: item.post_type as 'WOOD' | 'STEEL',
            standard_material_cost: item.standard_material_cost as number | null,
            standard_labor_cost: item.standard_labor_cost as number | null,
            standard_cost_per_foot: item.standard_cost_per_foot as number | null,
          };
        })
        .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));

      return results;
    },
    enabled: enabled && recentIds.length > 0,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

/**
 * Combined hook for SKU search with recent items
 */
export function useSkuSearchWithRecents(options: UseSkuSearchOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults, isLoading: isSearching } = useSkuSearch(searchQuery, options);
  const { data: recentSkus, isLoading: isLoadingRecents } = useRecentSkus(options);

  const trackRecentSku = useCallback((skuId: string) => {
    addToRecentSkus(skuId);
  }, []);

  // Combine results: show search results if query exists, otherwise show recents
  const displayResults = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults || [];
    }
    return recentSkus || [];
  }, [searchQuery, searchResults, recentSkus]);

  const isLoading = searchQuery.trim() ? isSearching : isLoadingRecents;

  return {
    searchQuery,
    setSearchQuery,
    results: displayResults,
    isLoading,
    trackRecentSku,
    hasRecents: (recentSkus?.length || 0) > 0,
  };
}

/**
 * Fetch a single SKU by ID with pricing details
 */
export function useSkuById(skuId: string | null) {
  return useQuery({
    queryKey: ['sku-by-id', skuId],
    queryFn: async () => {
      if (!skuId) return null;

      const { data, error } = await supabase
        .from('sku_catalog_v2')
        .select(`
          id,
          sku_code,
          sku_name,
          product_type_id,
          product_style_id,
          height,
          post_type,
          standard_material_cost,
          standard_labor_cost,
          standard_cost_per_foot,
          product_description,
          product_type:product_types_v2(id, code, name),
          product_style:product_styles_v2(id, code, name)
        `)
        .eq('id', skuId)
        .single();

      if (error) throw error;

      // Handle both array and object responses from Supabase joins
      const productTypeRaw = data.product_type;
      const productStyleRaw = data.product_style;
      const productType = (Array.isArray(productTypeRaw) ? productTypeRaw[0] : productTypeRaw) as { id: string; code: string; name: string } | null;
      const productStyle = (Array.isArray(productStyleRaw) ? productStyleRaw[0] : productStyleRaw) as { id: string; code: string; name: string } | null;

      return {
        id: data.id,
        sku_code: data.sku_code,
        sku_name: data.sku_name,
        product_type_id: data.product_type_id,
        product_type_name: productType?.name || '',
        product_type_code: productType?.code || '',
        product_style_id: data.product_style_id,
        product_style_name: productStyle?.name || '',
        height: data.height,
        post_type: data.post_type,
        standard_material_cost: data.standard_material_cost,
        standard_labor_cost: data.standard_labor_cost,
        standard_cost_per_foot: data.standard_cost_per_foot,
        product_description: data.product_description,
      } as SkuSearchResult & { product_description: string | null };
    },
    enabled: !!skuId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
