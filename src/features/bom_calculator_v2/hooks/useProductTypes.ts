/**
 * Hook for fetching product types and related data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ProductType,
  ProductStyle,
  ComponentDefinition,
  ProductTypeComponent,
  ProductTypeWithStyles,
  ProductTypeWithComponents,
} from '../types';

/**
 * Fetch all active product types
 */
export function useProductTypes() {
  return useQuery({
    queryKey: ['product-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ProductType[];
    },
  });
}

/**
 * Fetch product types with their styles
 */
export function useProductTypesWithStyles() {
  return useQuery({
    queryKey: ['product-types-with-styles'],
    queryFn: async () => {
      const { data: types, error: typesError } = await supabase
        .from('product_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (typesError) throw typesError;

      const { data: styles, error: stylesError } = await supabase
        .from('product_styles')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (stylesError) throw stylesError;

      // Group styles by product type
      const typesWithStyles: ProductTypeWithStyles[] = (types as ProductType[]).map(type => ({
        ...type,
        styles: (styles as ProductStyle[]).filter(s => s.product_type_id === type.id),
      }));

      return typesWithStyles;
    },
  });
}

/**
 * Fetch a single product type with its components
 */
export function useProductTypeWithComponents(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-type-components', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return null;

      const { data: type, error: typeError } = await supabase
        .from('product_types')
        .select('*')
        .eq('id', productTypeId)
        .single();

      if (typeError) throw typeError;

      const { data: typeComponents, error: compError } = await supabase
        .from('product_type_components')
        .select(`
          *,
          component:component_definitions(*)
        `)
        .eq('product_type_id', productTypeId)
        .order('display_order');

      if (compError) throw compError;

      return {
        ...type,
        components: typeComponents,
      } as ProductTypeWithComponents;
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch styles for a specific product type
 */
export function useProductStyles(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-styles', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_styles')
        .select('*')
        .eq('product_type_id', productTypeId)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ProductStyle[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch all component definitions
 */
export function useComponentDefinitions() {
  return useQuery({
    queryKey: ['component-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_definitions')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as ComponentDefinition[];
    },
  });
}

/**
 * Fetch components for a product type
 */
export function useProductTypeComponents(productTypeId: string | null) {
  return useQuery({
    queryKey: ['product-type-components-list', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('product_type_components')
        .select(`
          *,
          component:component_definitions(*)
        `)
        .eq('product_type_id', productTypeId)
        .order('display_order');

      if (error) throw error;
      return data as (ProductTypeComponent & { component: ComponentDefinition })[];
    },
    enabled: !!productTypeId,
  });
}
