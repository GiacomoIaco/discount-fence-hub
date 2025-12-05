import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Settings2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Package,
  Loader2,
  Check,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type {
  ComponentDefinition,
  SKUComponentWithDetails,
  FenceTypeDB,
  Material,
  ComponentFilterConfig,
} from '../database.types';

interface ComponentConfigPanelProps {
  fenceType: FenceTypeDB;
  productId: string | null;
  onMaterialChange?: (componentCode: string, materialId: string) => void;
  currentMaterials?: Record<string, string>; // componentCode -> materialId
}

export default function ComponentConfigPanel({
  fenceType,
  productId,
  onMaterialChange,
  currentMaterials = {},
}: ComponentConfigPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch component definitions for this fence type
  const { data: componentDefs = [] } = useQuery({
    queryKey: ['component-definitions', fenceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_definitions')
        .select('*')
        .eq('is_active', true)
        .contains('fence_types', [fenceType])
        .order('display_order');

      if (error) throw error;
      return data as ComponentDefinition[];
    },
  });

  // Fetch SKU component configurations
  const { data: skuComponents = [], refetch: refetchComponents } = useQuery({
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

  // Merge component definitions with SKU configs
  const components = componentDefs.map(def => {
    const config = skuComponents.find(sc => sc.component_id === def.id);
    return {
      ...def,
      config,
      isConfigured: !!config,
      isVisible: config?.is_visible ?? true,
      filterConfig: config?.filter_config || {},
    };
  });

  // Initialize components for new SKU
  const initializeComponents = async () => {
    if (!productId) return;

    setSaving(true);
    try {
      const entries = componentDefs.map(def => ({
        fence_type: fenceType,
        product_id: productId,
        component_id: def.id,
        display_order: def.display_order,
        is_required: def.is_required,
        is_visible: true,
        filter_config: {},
      }));

      const { error } = await supabase
        .from('sku_components')
        .upsert(entries, {
          onConflict: 'fence_type,product_id,component_id',
        });

      if (error) throw error;
      showSuccess('Components initialized');
      refetchComponents();
    } catch (error) {
      console.error('Error initializing components:', error);
      showError('Failed to initialize components');
    } finally {
      setSaving(false);
    }
  };

  // Toggle component visibility
  const toggleVisibility = async (componentId: string, currentVisibility: boolean) => {
    if (!productId) return;

    try {
      const { error } = await supabase
        .from('sku_components')
        .upsert({
          fence_type: fenceType,
          product_id: productId,
          component_id: componentId,
          is_visible: !currentVisibility,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'fence_type,product_id,component_id',
        });

      if (error) throw error;
      refetchComponents();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      showError('Failed to update component');
    }
  };

  // Save filter configuration
  const saveFilterConfig = async (componentId: string, filterConfig: ComponentFilterConfig) => {
    if (!productId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sku_components')
        .upsert({
          fence_type: fenceType,
          product_id: productId,
          component_id: componentId,
          filter_config: filterConfig,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'fence_type,product_id,component_id',
        });

      if (error) throw error;
      showSuccess('Filter saved');
      setEditingComponent(null);
      refetchComponents();
    } catch (error) {
      console.error('Error saving filter:', error);
      showError('Failed to save filter');
    } finally {
      setSaving(false);
    }
  };

  if (!productId) {
    return null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Component Configuration</span>
          {skuComponents.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
              {skuComponents.filter(c => c.is_visible).length}/{componentDefs.length} active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-200 p-3 space-y-2">
          {/* Initialize button if no configs exist */}
          {skuComponents.length === 0 && componentDefs.length > 0 && (
            <button
              onClick={initializeComponents}
              disabled={saving}
              className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Initialize Default Components
            </button>
          )}

          {/* Component list */}
          <div className="space-y-1">
            {components.map(component => (
              <ComponentRow
                key={component.id}
                component={component}
                fenceType={fenceType}
                productId={productId}
                isEditing={editingComponent === component.id}
                onToggleVisibility={() => toggleVisibility(component.id, component.isVisible)}
                onEdit={() => setEditingComponent(component.id)}
                onSaveFilter={(config) => saveFilterConfig(component.id, config)}
                onCancelEdit={() => setEditingComponent(null)}
                saving={saving}
                currentMaterialId={currentMaterials[component.code]}
                onMaterialChange={onMaterialChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual component row
interface ComponentRowProps {
  component: ComponentDefinition & {
    config?: SKUComponentWithDetails;
    isConfigured: boolean;
    isVisible: boolean;
    filterConfig: ComponentFilterConfig;
  };
  fenceType: FenceTypeDB;
  productId: string;
  isEditing: boolean;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onSaveFilter: (config: ComponentFilterConfig) => void;
  onCancelEdit: () => void;
  saving: boolean;
  currentMaterialId?: string;
  onMaterialChange?: (componentCode: string, materialId: string) => void;
}

function ComponentRow({
  component,
  isEditing,
  onToggleVisibility,
  onEdit,
  onSaveFilter,
  onCancelEdit,
  saving,
}: ComponentRowProps) {
  const [filterConfig, setFilterConfig] = useState<ComponentFilterConfig>(component.filterConfig);

  // Fetch available categories
  const { data: categories = [] } = useQuery({
    queryKey: ['material-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('category')
        .eq('status', 'Active');

      const unique = [...new Set(data?.map(m => m.category))].sort();
      return unique;
    },
  });

  // Fetch materials for this component
  const { data: materials = [] } = useQuery({
    queryKey: ['component-materials', component.id, filterConfig],
    queryFn: async () => {
      let query = supabase
        .from('materials')
        .select('*')
        .eq('status', 'Active')
        .order('material_name');

      const category = filterConfig.category || component.default_category;
      if (category) {
        query = query.eq('category', category);
      }

      const { data } = await query;
      return data as Material[] || [];
    },
  });

  useEffect(() => {
    setFilterConfig(component.filterConfig);
  }, [component.filterConfig]);

  return (
    <div className={`border rounded-lg ${component.isVisible ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Visibility toggle */}
        <button
          onClick={onToggleVisibility}
          className={`p-1 rounded ${component.isVisible ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
          title={component.isVisible ? 'Hide component' : 'Show component'}
        >
          {component.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {/* Component name */}
        <div className="flex-1">
          <span className={`text-sm font-medium ${component.isVisible ? 'text-gray-900' : 'text-gray-400'}`}>
            {component.name}
          </span>
          {component.is_required && (
            <span className="ml-1 text-[10px] text-red-500">*</span>
          )}
          {Object.keys(component.filterConfig).length > 0 && (
            <span className="ml-2 text-[10px] text-blue-500 bg-blue-50 px-1 rounded">filtered</span>
          )}
        </div>

        {/* Filter button */}
        {component.isVisible && (
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Configure filter"
          >
            <Filter className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter editor */}
      {isEditing && (
        <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Category filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category Filter</label>
              <select
                value={filterConfig.category || ''}
                onChange={(e) => setFilterConfig({ ...filterConfig, category: e.target.value || undefined })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Default ({component.default_category || 'All'})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Min length */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min Length (ft)</label>
              <input
                type="number"
                step="0.5"
                value={filterConfig.min_length || ''}
                onChange={(e) => setFilterConfig({
                  ...filterConfig,
                  min_length: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="Any"
              />
            </div>

            {/* Max length */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Length (ft)</label>
              <input
                type="number"
                step="0.5"
                value={filterConfig.max_length || ''}
                onChange={(e) => setFilterConfig({
                  ...filterConfig,
                  max_length: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                placeholder="Any"
              />
            </div>

            {/* Preview count */}
            <div className="flex items-end">
              <span className="text-xs text-gray-500">
                {materials.length} materials match
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => onSaveFilter(filterConfig)}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
