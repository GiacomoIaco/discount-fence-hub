/**
 * Hook for fetching component material rules and eligible materials
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

// Types
export interface ComponentMaterialRule {
  id: string;
  product_type_id: string | null;
  product_style_id: string | null;
  component_id: string;
  material_category: string | null;
  material_subcategory: string | null;
  material_id: string | null;
  is_default: boolean;
  display_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EligibleMaterial {
  rule_id: string;
  product_type_id: string | null;
  product_style_id: string | null;
  component_id: string;
  component_code: string;
  component_name: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  material_category: string;
  material_subcategory: string | null;
  unit_cost: number;
  unit_type: string;
  length_ft: number | null;
  actual_width: number | null;
  is_default: boolean;
  display_order: number;
  rule_notes: string | null;
}

export interface ComponentMaterialRuleWithDetails extends ComponentMaterialRule {
  component: {
    code: string;
    name: string;
  };
  product_type?: {
    code: string;
    name: string;
  };
  material?: {
    material_sku: string;
    material_name: string;
  };
}

/**
 * Fetch all material rules for a product type
 */
export function useComponentMaterialRules(productTypeId: string | null) {
  return useQuery({
    queryKey: ['component-material-rules', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return [];

      const { data, error } = await supabase
        .from('component_material_rules')
        .select(`
          *,
          component:component_definitions(code, name),
          product_type:product_types(code, name),
          material:materials(material_sku, material_name)
        `)
        .eq('product_type_id', productTypeId)
        .order('component_id')
        .order('display_order');

      if (error) throw error;
      return data as ComponentMaterialRuleWithDetails[];
    },
    enabled: !!productTypeId,
  });
}

/**
 * Fetch eligible materials for a specific component in a product type
 * Uses the v_component_eligible_materials view
 */
export function useEligibleMaterials(productTypeId: string | null, componentCode: string | null) {
  return useQuery({
    queryKey: ['eligible-materials', productTypeId, componentCode],
    queryFn: async () => {
      if (!productTypeId || !componentCode) return [];

      const { data, error } = await supabase
        .from('v_component_eligible_materials')
        .select('*')
        .eq('product_type_id', productTypeId)
        .eq('component_code', componentCode)
        .order('display_order')
        .order('material_name');

      if (error) throw error;
      return data as EligibleMaterial[];
    },
    enabled: !!productTypeId && !!componentCode,
  });
}

/**
 * Fetch all eligible materials for all components of a product type
 * Useful for SKU Builder to pre-load all options
 */
export function useAllEligibleMaterials(productTypeId: string | null) {
  return useQuery({
    queryKey: ['all-eligible-materials', productTypeId],
    queryFn: async () => {
      if (!productTypeId) return new Map<string, EligibleMaterial[]>();

      const { data, error } = await supabase
        .from('v_component_eligible_materials')
        .select('*')
        .eq('product_type_id', productTypeId)
        .order('component_code')
        .order('display_order')
        .order('material_name');

      if (error) throw error;

      // Group by component code
      const byComponent = new Map<string, EligibleMaterial[]>();
      for (const item of data as EligibleMaterial[]) {
        const existing = byComponent.get(item.component_code) || [];
        existing.push(item);
        byComponent.set(item.component_code, existing);
      }

      return byComponent;
    },
    enabled: !!productTypeId,
  });
}

/**
 * Get unique material categories from the database
 */
export function useMaterialCategories() {
  return useQuery({
    queryKey: ['material-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('category, sub_category')
        .eq('status', 'Active')
        .order('category')
        .order('sub_category');

      if (error) throw error;

      // Build category -> subcategories map
      const categories = new Map<string, Set<string>>();
      for (const item of data) {
        if (!categories.has(item.category)) {
          categories.set(item.category, new Set());
        }
        if (item.sub_category) {
          categories.get(item.category)!.add(item.sub_category);
        }
      }

      // Convert to array format
      return Array.from(categories.entries()).map(([category, subcats]) => ({
        category,
        subcategories: Array.from(subcats).sort(),
      }));
    },
  });
}

/**
 * Create a new component material rule
 */
export function useCreateMaterialRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<ComponentMaterialRule, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('component_material_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['component-material-rules', variables.product_type_id] });
      queryClient.invalidateQueries({ queryKey: ['all-eligible-materials', variables.product_type_id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials'] });
    },
  });
}

/**
 * Update a component material rule
 */
export function useUpdateMaterialRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComponentMaterialRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('component_material_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-material-rules'] });
      queryClient.invalidateQueries({ queryKey: ['all-eligible-materials'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials'] });
    },
  });
}

/**
 * Delete a component material rule
 */
export function useDeleteMaterialRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('component_material_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-material-rules'] });
      queryClient.invalidateQueries({ queryKey: ['all-eligible-materials'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials'] });
    },
  });
}
