import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { BuPriceBook, BuPriceBookOverride, BuPriceBookSummary } from '../types';

/**
 * Hook to fetch all price books with summary info
 */
export function usePriceBooks() {
  return useQuery({
    queryKey: ['price-books'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_bu_price_book_summary')
        .select('*')
        .order('qbo_class_name');

      if (error) throw error;
      return data as BuPriceBookSummary[];
    },
  });
}

/**
 * Hook to fetch a single price book with its overrides
 */
export function usePriceBook(id: string | null) {
  return useQuery({
    queryKey: ['price-book', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: priceBook, error: pbError } = await supabase
        .from('bu_price_books')
        .select(`
          *,
          qbo_class:qbo_classes!qbo_class_id (
            id,
            name,
            bu_type,
            labor_code
          )
        `)
        .eq('id', id)
        .single();

      if (pbError) throw pbError;

      const { data: overrides, error: ovError } = await supabase
        .from('bu_price_book_overrides')
        .select(`
          *,
          sku:sku_catalog_v2!sku_id (
            id,
            sku_code,
            sku_name,
            height,
            post_type,
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
        .eq('price_book_id', id)
        .order('action')
        .order('sort_order');

      if (ovError) throw ovError;

      return {
        ...priceBook,
        overrides: overrides as (BuPriceBookOverride & {
          sku: {
            id: string;
            sku_code: string;
            sku_name: string;
            height: number;
            post_type: string;
            product_type: { name: string; code: string } | null;
            product_style: { name: string; code: string } | null;
          };
        })[],
      };
    },
    enabled: !!id,
  });
}

/**
 * Hook to update price book settings
 */
export function useUpdatePriceBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        description: string | null;
        include_all_for_bu_type: boolean;
        is_active: boolean;
      }>;
    }) => {
      const { data: result, error } = await supabase
        .from('bu_price_books')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.id] });
    },
  });
}

/**
 * Hook to add an override to a price book
 */
export function useAddPriceBookOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      price_book_id: string;
      sku_id: string;
      action: 'include' | 'exclude';
      sort_order?: number;
      is_featured?: boolean;
      category_override?: string | null;
      notes?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('bu_price_book_overrides')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['available-skus'] });
    },
  });
}

/**
 * Hook to update an override
 */
export function useUpdatePriceBookOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      price_book_id,
      data,
    }: {
      id: string;
      price_book_id: string;
      data: Partial<{
        action: 'include' | 'exclude';
        sort_order: number;
        is_featured: boolean;
        category_override: string | null;
        notes: string | null;
      }>;
    }) => {
      const { data: result, error } = await supabase
        .from('bu_price_book_overrides')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['available-skus'] });
    },
  });
}

/**
 * Hook to remove an override from a price book
 */
export function useRemovePriceBookOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, price_book_id }: { id: string; price_book_id: string }) => {
      const { error } = await supabase.from('bu_price_book_overrides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-books'] });
      queryClient.invalidateQueries({ queryKey: ['price-book', variables.price_book_id] });
      queryClient.invalidateQueries({ queryKey: ['available-skus'] });
    },
  });
}

/**
 * Hook to search SKUs for adding overrides
 */
export function useSkuSearchForPriceBook(search: string, existingOverrideSkuIds: string[] = []) {
  return useQuery({
    queryKey: ['sku-search-price-book', search],
    queryFn: async () => {
      let query = supabase
        .from('sku_catalog_v2')
        .select(`
          id,
          sku_code,
          sku_name,
          height,
          post_type,
          bu_types_allowed,
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

      const { data, error } = await query.limit(30);

      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
    staleTime: 30000,
  });
}
