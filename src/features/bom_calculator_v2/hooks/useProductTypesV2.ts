/**
 * Hooks for V2 product types, styles, and SKUs
 * Uses the new formula-based architecture tables
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

// Types for V2 tables
export interface ProductTypeV2 {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_post_spacing: number | null;
  display_order: number;
  is_active: boolean;
}

export interface ProductStyleV2 {
  id: string;
  product_type_id: string;
  code: string;
  name: string;
  description: string | null;
  formula_adjustments: Record<string, number | string>;
  display_order: number;
  is_active: boolean;
}

export interface ProductVariableV2 {
  id: string;
  product_type_id: string;
  variable_code: string;
  variable_name: string;
  variable_type: 'integer' | 'decimal' | 'select';
  default_value: string | null;
  allowed_values: string[] | null;
  unit: string | null;
  is_required: boolean;
  display_order: number;
}

export interface ComponentTypeV2 {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit_type: string;
  display_order: number;
  is_active: boolean;
}

export interface SKUCatalogV2 {
  id: string;
  sku_code: string;
  sku_name: string;
  product_type_id: string;
  product_style_id: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  variables: Record<string, number | string>;
  components: Record<string, string>;
  custom_formulas: Record<string, string> | null;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;
  service_titan_id: string | null;
  product_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Extended SKU with joined product type/style
export interface SKUCatalogV2WithRelations extends SKUCatalogV2 {
  product_type: ProductTypeV2;
  product_style: ProductStyleV2;
}

/**
 * Fetch all active product types (V2)
 */
export function useProductTypesV2() {
  return useQuery({
    queryKey: ['product-types-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_types_v2')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ProductTypeV2[];
    },
  });
}

/**
 * Fetch styles for a product type (V2)
 */
export function useProductStylesV2(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-styles-v2', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_styles_v2')
        .select('*')
        .eq('product_type_id', productTypeId)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ProductStyleV2[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch variables for a product type (V2)
 */
export function useProductVariablesV2(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-variables-v2', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_variables_v2')
        .select('*')
        .eq('product_type_id', productTypeId)
        .order('display_order');

      if (error) throw error;
      return data as ProductVariableV2[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch all component types (V2)
 */
export function useComponentTypesV2() {
  return useQuery({
    queryKey: ['component-types-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_types_v2')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ComponentTypeV2[];
    },
  });
}

/**
 * Fetch all SKUs from sku_catalog_v2
 */
export function useSKUCatalogV2(showArchived: boolean = false) {
  return useQuery({
    queryKey: ['sku-catalog-v2', showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sku_catalog_v2')
        .select(`
          *,
          product_type:product_types_v2(*),
          product_style:product_styles_v2(*)
        `)
        .eq('is_active', true)
        .order('sku_code');

      if (error) throw error;
      return data as SKUCatalogV2WithRelations[];
    },
  });
}

/**
 * Fetch a single SKU by ID
 */
export function useSKUV2(skuId: string | null) {
  return useQuery({
    queryKey: ['sku-v2', skuId],
    queryFn: async () => {
      if (!skuId) return null;

      const { data, error } = await supabase
        .from('sku_catalog_v2')
        .select(`
          *,
          product_type:product_types_v2(*),
          product_style:product_styles_v2(*)
        `)
        .eq('id', skuId)
        .single();

      if (error) throw error;
      return data as SKUCatalogV2WithRelations;
    },
    enabled: !!skuId,
  });
}
