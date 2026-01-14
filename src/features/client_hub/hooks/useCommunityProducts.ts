import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { CommunityProduct } from '../types';

/**
 * Hook to fetch community products with SKU details
 */
export function useCommunityProductsWithDetails(communityId: string | null) {
  return useQuery({
    queryKey: ['community-products-details', communityId],
    queryFn: async () => {
      if (!communityId) return [];

      const { data, error } = await supabase
        .from('community_products')
        .select(`
          *,
          sku:sku_catalog_v2!sku_id (
            id,
            sku_code,
            sku_name,
            height,
            post_type,
            standard_cost_per_foot,
            product_type:product_types_v2!product_type_id (
              name,
              code
            ),
            product_style:product_styles_v2!product_style_id (
              name,
              code
            )
          )
        `)
        .eq('community_id', communityId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as (CommunityProduct & {
        sku: {
          id: string;
          sku_code: string;
          sku_name: string;
          height: number;
          post_type: string;
          standard_cost_per_foot: number | null;
          product_type: { name: string; code: string } | null;
          product_style: { name: string; code: string } | null;
        };
      })[];
    },
    enabled: !!communityId,
  });
}

/**
 * Hook to add a product to a community
 */
export function useAddCommunityProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      community_id: string;
      sku_id: string;
      spec_code?: string | null;
      custom_description?: string | null;
      price_override?: number | null;
      price_override_reason?: string | null;
      is_default?: boolean;
    }) => {
      // Get max sort order
      const { data: existing } = await supabase
        .from('community_products')
        .select('sort_order')
        .eq('community_id', data.community_id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const maxSortOrder = existing?.[0]?.sort_order ?? -1;

      const { data: result, error } = await supabase
        .from('community_products')
        .insert({
          ...data,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-products-details', variables.community_id] });
      queryClient.invalidateQueries({ queryKey: ['community-products', variables.community_id] });
    },
  });
}

/**
 * Hook to update a community product
 */
export function useUpdateCommunityProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      community_id,
      data,
    }: {
      id: string;
      community_id: string;
      data: Partial<{
        spec_code: string | null;
        custom_description: string | null;
        price_override: number | null;
        price_override_reason: string | null;
        is_default: boolean;
        sort_order: number;
      }>;
    }) => {
      const { data: result, error } = await supabase
        .from('community_products')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-products-details', variables.community_id] });
      queryClient.invalidateQueries({ queryKey: ['community-products', variables.community_id] });
    },
  });
}

/**
 * Hook to remove a product from a community
 */
export function useRemoveCommunityProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, community_id }: { id: string; community_id: string }) => {
      const { error } = await supabase.from('community_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-products-details', variables.community_id] });
      queryClient.invalidateQueries({ queryKey: ['community-products', variables.community_id] });
    },
  });
}

/**
 * Hook to bulk update sort order
 */
export function useReorderCommunityProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      community_id,
      orderedIds,
    }: {
      community_id: string;
      orderedIds: string[];
    }) => {
      // Update each product's sort_order
      const updates = orderedIds.map((id, index) =>
        supabase.from('community_products').update({ sort_order: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-products-details', variables.community_id] });
    },
  });
}

/**
 * Hook to search SKUs for adding to community
 */
export function useSkuSearchForCommunity(search: string, excludeIds: string[] = []) {
  return useQuery({
    queryKey: ['sku-search-community', search, excludeIds],
    queryFn: async () => {
      let query = supabase
        .from('sku_catalog_v2')
        .select(`
          id,
          sku_code,
          sku_name,
          height,
          post_type,
          standard_cost_per_foot,
          product_type:product_types_v2!product_type_id (
            name,
            code
          ),
          product_style:product_styles_v2!product_style_id (
            name,
            code
          )
        `)
        .eq('is_active', true)
        .order('sku_name');

      if (search) {
        query = query.or(`sku_code.ilike.%${search}%,sku_name.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      // Filter out already added SKUs
      return (data || []).filter((sku) => !excludeIds.includes(sku.id));
    },
    enabled: search.length >= 2 || search.length === 0,
    staleTime: 30000,
  });
}
