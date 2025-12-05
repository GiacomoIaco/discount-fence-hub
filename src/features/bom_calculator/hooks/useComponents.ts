import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ComponentDefinition,
  SKUComponent,
  SKUComponentWithDetails,
  FenceTypeDB,
  Material,
  ComponentFilterConfig,
} from '../database.types';

// Fetch all component definitions
export function useComponentDefinitions(fenceType?: FenceTypeDB | 'custom') {
  return useQuery({
    queryKey: ['component-definitions', fenceType],
    queryFn: async () => {
      let query = supabase
        .from('component_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      // Filter by fence type if provided
      if (fenceType && fenceType !== 'custom') {
        query = query.contains('fence_types', [fenceType]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ComponentDefinition[];
    },
  });
}

// Fetch SKU component configurations for a specific product
export function useSKUComponents(fenceType: FenceTypeDB | 'custom', productId: string | null) {
  return useQuery({
    queryKey: ['sku-components', fenceType, productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('sku_components_view')
        .select('*')
        .eq('fence_type', fenceType)
        .eq('product_id', productId)
        .order('display_order');

      if (error) throw error;
      return data as SKUComponentWithDetails[];
    },
    enabled: !!productId,
  });
}

// Fetch materials filtered by component configuration
export function useComponentMaterials(
  componentId: string | null,
  filterConfig?: ComponentFilterConfig
) {
  return useQuery({
    queryKey: ['component-materials', componentId, filterConfig],
    queryFn: async () => {
      if (!componentId) return [];

      // Get component default category
      const { data: component } = await supabase
        .from('component_definitions')
        .select('default_category, default_sub_category')
        .eq('id', componentId)
        .single();

      // Build material query
      let query = supabase
        .from('materials')
        .select('*')
        .eq('status', 'Active')
        .order('material_name');

      // Apply category filter
      const category = filterConfig?.category || component?.default_category;
      if (category) {
        query = query.eq('category', category);
      }

      // Apply sub-category filter
      const subCategory = filterConfig?.sub_category || component?.default_sub_category;
      if (subCategory) {
        query = query.eq('sub_category', subCategory);
      }

      // Apply dimension filters
      if (filterConfig?.min_length) {
        query = query.gte('length_ft', filterConfig.min_length);
      }
      if (filterConfig?.max_length) {
        query = query.lte('length_ft', filterConfig.max_length);
      }
      if (filterConfig?.min_width) {
        query = query.gte('actual_width', filterConfig.min_width);
      }
      if (filterConfig?.max_width) {
        query = query.lte('actual_width', filterConfig.max_width);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Material[];
    },
    enabled: !!componentId,
  });
}

// Save SKU component configuration
export function useSaveSKUComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      fenceType: FenceTypeDB | 'custom';
      productId: string;
      componentId: string;
      filterConfig?: ComponentFilterConfig;
      defaultMaterialId?: string | null;
      displayName?: string | null;
      displayOrder?: number;
      isRequired?: boolean;
      isVisible?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('sku_components')
        .upsert({
          fence_type: config.fenceType,
          product_id: config.productId,
          component_id: config.componentId,
          filter_config: config.filterConfig || {},
          default_material_id: config.defaultMaterialId,
          display_name: config.displayName,
          display_order: config.displayOrder ?? 0,
          is_required: config.isRequired ?? true,
          is_visible: config.isVisible ?? true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'fence_type,product_id,component_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as SKUComponent;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['sku-components', variables.fenceType, variables.productId],
      });
    },
  });
}

// Delete SKU component configuration
export function useDeleteSKUComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      fenceType: FenceTypeDB | 'custom';
      productId: string;
      componentId: string;
    }) => {
      const { error } = await supabase
        .from('sku_components')
        .delete()
        .eq('fence_type', config.fenceType)
        .eq('product_id', config.productId)
        .eq('component_id', config.componentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['sku-components', variables.fenceType, variables.productId],
      });
    },
  });
}

// Initialize default components for a new SKU
export function useInitializeSKUComponents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      fenceType: FenceTypeDB;
      productId: string;
    }) => {
      // Get default components for this fence type
      const { data: components, error: fetchError } = await supabase
        .from('component_definitions')
        .select('id, display_order, is_required')
        .eq('is_active', true)
        .contains('fence_types', [config.fenceType])
        .order('display_order');

      if (fetchError) throw fetchError;
      if (!components || components.length === 0) return [];

      // Create SKU component entries
      const entries = components.map(c => ({
        fence_type: config.fenceType,
        product_id: config.productId,
        component_id: c.id,
        display_order: c.display_order,
        is_required: c.is_required,
        is_visible: true,
        filter_config: {},
      }));

      const { data, error } = await supabase
        .from('sku_components')
        .upsert(entries, {
          onConflict: 'fence_type,product_id,component_id',
        })
        .select();

      if (error) throw error;
      return data as SKUComponent[];
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['sku-components', variables.fenceType, variables.productId],
      });
    },
  });
}

// Get materials for a specific component with smart filtering
export async function getFilteredMaterials(
  componentCode: string,
  fenceType: FenceTypeDB | 'custom',
  productId?: string,
  additionalFilters?: Partial<ComponentFilterConfig>
): Promise<Material[]> {
  // Get component definition
  const { data: component } = await supabase
    .from('component_definitions')
    .select('id, default_category, default_sub_category')
    .eq('code', componentCode)
    .single();

  if (!component) return [];

  // Get SKU-specific config if available
  let filterConfig: ComponentFilterConfig = {};
  if (productId) {
    const { data: skuComponent } = await supabase
      .from('sku_components')
      .select('filter_config')
      .eq('fence_type', fenceType)
      .eq('product_id', productId)
      .eq('component_id', component.id)
      .single();

    if (skuComponent?.filter_config) {
      filterConfig = skuComponent.filter_config as ComponentFilterConfig;
    }
  }

  // Merge filters
  const finalFilters = {
    category: filterConfig.category || component.default_category,
    sub_category: filterConfig.sub_category || component.default_sub_category,
    ...additionalFilters,
  };

  // Build query
  let query = supabase
    .from('materials')
    .select('*')
    .eq('status', 'Active')
    .order('material_name');

  if (finalFilters.category) {
    query = query.eq('category', finalFilters.category);
  }
  if (finalFilters.sub_category) {
    query = query.eq('sub_category', finalFilters.sub_category);
  }
  if (finalFilters.min_length) {
    query = query.gte('length_ft', finalFilters.min_length);
  }
  if (finalFilters.max_length) {
    query = query.lte('length_ft', finalFilters.max_length);
  }

  const { data } = await query;
  return data as Material[] || [];
}
