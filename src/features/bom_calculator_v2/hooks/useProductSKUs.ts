/**
 * Hook for fetching and managing product SKUs
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { ProductSKU, ProductSKUWithDetails } from '../types';

/**
 * Fetch all SKUs for a product type
 */
export function useProductSKUs(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-skus', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_skus')
        .select(`
          *,
          product_type:product_types(*),
          product_style:product_styles(*)
        `)
        .eq('product_type_id', productTypeId)
        .eq('is_active', true)
        .order('sku_code');

      if (error) throw error;
      return data as (ProductSKU & {
        product_type: { code: string; name: string };
        product_style: { code: string; name: string };
      })[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch a single SKU with all details (for calculations)
 */
export function useProductSKUWithDetails(skuId: string | null) {
  return useQuery({
    queryKey: ['product-sku-details', skuId],
    queryFn: async () => {
      if (!skuId) return null;

      // Fetch SKU with type and style
      const { data: sku, error: skuError } = await supabase
        .from('product_skus')
        .select(`
          *,
          product_type:product_types(*),
          product_style:product_styles(*)
        `)
        .eq('id', skuId)
        .single();

      if (skuError) throw skuError;

      // Fetch components with materials
      const { data: components, error: compError } = await supabase
        .from('sku_components_v2')
        .select(`
          *,
          component:component_definitions_v2(*),
          material:materials(id, material_sku, material_name, unit_cost, actual_width, length_ft)
        `)
        .eq('sku_id', skuId);

      if (compError) throw compError;

      return {
        ...sku,
        components: components || [],
      } as ProductSKUWithDetails;
    },
    enabled: !!skuId,
  });
}

/**
 * Fetch all SKUs with details (for catalog view)
 */
export function useAllProductSKUsWithDetails(productTypeCode?: string) {
  return useQuery({
    queryKey: ['all-product-skus', productTypeCode],
    queryFn: async () => {
      let query = supabase
        .from('product_skus')
        .select(`
          *,
          product_type:product_types(*),
          product_style:product_styles(*)
        `)
        .eq('is_active', true)
        .order('sku_code');

      if (productTypeCode) {
        // Need to filter by type code through join
        const { data: typeData } = await supabase
          .from('product_types')
          .select('id')
          .eq('code', productTypeCode)
          .single();

        if (typeData) {
          query = query.eq('product_type_id', typeData.id);
        }
      }

      const { data: skus, error: skuError } = await query;
      if (skuError) throw skuError;

      // Fetch all components for these SKUs
      const skuIds = skus?.map((s: { id: string }) => s.id) || [];
      if (skuIds.length === 0) return [];

      const { data: allComponents, error: compError } = await supabase
        .from('sku_components_v2')
        .select(`
          *,
          component:component_definitions_v2(*),
          material:materials(id, material_sku, material_name, unit_cost, actual_width, length_ft)
        `)
        .in('sku_id', skuIds);

      if (compError) throw compError;

      // Group components by SKU
      const componentsBySkuId = new Map<string, typeof allComponents>();
      for (const comp of allComponents || []) {
        const existing = componentsBySkuId.get(comp.sku_id) || [];
        existing.push(comp);
        componentsBySkuId.set(comp.sku_id, existing);
      }

      return skus?.map((sku: { id: string }) => ({
        ...sku,
        components: componentsBySkuId.get(sku.id) || [],
      })) as ProductSKUWithDetails[];
    },
  });
}

/**
 * Create a new SKU
 */
export function useCreateProductSKU() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      sku: Omit<ProductSKU, 'id' | 'created_at' | 'updated_at'>;
      components: { component_id: string; material_id: string }[];
    }) => {
      // Insert SKU
      const { data: newSku, error: skuError } = await supabase
        .from('product_skus')
        .insert(data.sku)
        .select()
        .single();

      if (skuError) throw skuError;

      // Insert components
      if (data.components.length > 0) {
        const componentRows = data.components.map(c => ({
          sku_id: newSku.id,
          component_id: c.component_id,
          material_id: c.material_id,
        }));

        const { error: compError } = await supabase
          .from('sku_components_v2')
          .insert(componentRows);

        if (compError) throw compError;
      }

      return newSku as ProductSKU;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-skus'] });
    },
  });
}

/**
 * Update an existing SKU
 */
export function useUpdateProductSKU() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      sku: Partial<ProductSKU>;
      components?: { component_id: string; material_id: string }[];
    }) => {
      // Update SKU
      const { error: skuError } = await supabase
        .from('product_skus')
        .update(data.sku)
        .eq('id', data.id);

      if (skuError) throw skuError;

      // Update components if provided
      if (data.components) {
        // Delete existing components
        await supabase
          .from('sku_components_v2')
          .delete()
          .eq('sku_id', data.id);

        // Insert new components
        if (data.components.length > 0) {
          const componentRows = data.components.map(c => ({
            sku_id: data.id,
            component_id: c.component_id,
            material_id: c.material_id,
          }));

          const { error: compError } = await supabase
            .from('sku_components_v2')
            .insert(componentRows);

          if (compError) throw compError;
        }
      }

      return data.id;
    },
    onSuccess: (skuId) => {
      queryClient.invalidateQueries({ queryKey: ['product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['product-sku-details', skuId] });
    },
  });
}

/**
 * Delete (deactivate) a SKU
 */
export function useDeleteProductSKU() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (skuId: string) => {
      const { error } = await supabase
        .from('product_skus')
        .update({ is_active: false })
        .eq('id', skuId);

      if (error) throw error;
      return skuId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-skus'] });
    },
  });
}
