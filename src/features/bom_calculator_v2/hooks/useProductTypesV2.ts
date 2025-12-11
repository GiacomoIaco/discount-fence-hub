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

// ============================================
// NEW HOOKS FOR PRODUCT TYPE MANAGER
// ============================================

/**
 * Product type component assignment
 */
export interface ProductTypeComponentV2 {
  id: string;
  product_type_id: string;
  component_type_id: string;
  display_order: number;
  is_active: boolean;
}

/**
 * Variable value option (global pool)
 */
export interface VariableValueOption {
  id: string;
  variable_code: string;
  value: string;
  display_label: string | null;
  display_order: number;
  is_active: boolean;
}

/**
 * Full component view with assignment status
 */
export interface ProductTypeComponentFull {
  product_type_id: string;
  product_type_code: string;
  product_type_name: string;
  component_type_id: string;
  component_code: string;
  component_name: string;
  is_labor: boolean;
  assignment_id: string | null;
  display_order: number | null;
  is_assigned: boolean;
  has_formula: boolean;
  // Filter variable for subgrouping in Materials/Labor tab
  filter_variable_id: string | null;
  filter_variable_code: string | null;
  filter_variable_name: string | null;
  filter_variable_values: string[] | null;
  // Visibility conditions for SKU builder (e.g., {"post_type": ["STEEL"]} = only show for steel posts)
  visibility_conditions: Record<string, string[]> | null;
}

/**
 * Fetch component assignments for a product type
 */
export function useProductTypeComponentsV2(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-type-components-v2', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_type_components_v2')
        .select(`
          *,
          component:component_types_v2(*)
        `)
        .eq('product_type_id', productTypeId)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as (ProductTypeComponentV2 & { component: ComponentTypeV2 })[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch full component view for a product type (all components with assignment status)
 */
export function useProductTypeComponentsFull(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-type-components-full', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('v_product_type_components_full')
        .select('*')
        .eq('product_type_id', productTypeId);

      if (error) throw error;
      return data as ProductTypeComponentFull[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch all variable value options
 */
export function useVariableValueOptions(variableCode?: string) {
  return useQuery({
    queryKey: ['variable-value-options', variableCode],
    queryFn: async () => {
      let query = supabase
        .from('variable_value_options')
        .select('*')
        .eq('is_active', true)
        .order('variable_code')
        .order('display_order');

      if (variableCode) {
        query = query.eq('variable_code', variableCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as VariableValueOption[];
    },
  });
}

/**
 * Fetch variables from all product types (for import feature)
 */
export function useAllProductVariablesV2() {
  return useQuery({
    queryKey: ['all-product-variables-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variables_v2')
        .select(`
          *,
          product_type:product_types_v2(code, name)
        `)
        .order('variable_code');

      if (error) throw error;
      return data as (ProductVariableV2 & { product_type: { code: string; name: string } })[];
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
