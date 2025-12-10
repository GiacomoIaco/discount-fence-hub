/**
 * SKU Builder Page - V2
 *
 * Build and configure product SKUs using the formula-based architecture.
 * Uses sku_catalog_v2 with JSONB for variables and components.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, AlertTriangle, ArrowLeft, Package
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import {
  useProductTypesV2,
  useProductStylesV2,
  useProductVariablesV2,
  useComponentTypesV2,
  useSKUV2,
  type ProductTypeV2,
} from '../hooks';

interface SKUBuilderPageProps {
  editingSKUId?: string | null;
  onClearSelection?: () => void;
  isAdmin?: boolean;
}

interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
  length_ft: number | null;
  actual_width: number | null;
}

export function SKUBuilderPage({ editingSKUId, onClearSelection, isAdmin: _isAdmin = true }: SKUBuilderPageProps) {
  const queryClient = useQueryClient();

  // Core state
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [height, setHeight] = useState(6);
  const [postType, setPostType] = useState<'WOOD' | 'STEEL'>('WOOD');

  // Variables (JSONB)
  const [variables, setVariables] = useState<Record<string, number | string>>({});

  // Components (JSONB): component_code -> material_sku
  const [components, setComponents] = useState<Record<string, string>>({});

  // Preview parameters
  const [previewLength, setPreviewLength] = useState(100);
  const [previewLines, setPreviewLines] = useState(1);

  // Fetch product types (V2)
  const { data: productTypes = [], isLoading: loadingTypes } = useProductTypesV2();

  // Fetch styles for selected type (V2)
  const { data: productStyles = [] } = useProductStylesV2(selectedTypeId);

  // Fetch variables for selected type (V2)
  const { data: productVariables = [] } = useProductVariablesV2(selectedTypeId);

  // Fetch all component types (V2)
  const { data: componentTypes = [] } = useComponentTypesV2();

  // Fetch SKU details if editing
  const { data: editingSKU } = useSKUV2(editingSKUId || null);

  // Fetch all materials
  const { data: allMaterials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-builder-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_sku, material_name, category, sub_category, unit_cost, length_ft, actual_width')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Fetch component-material eligibility from V1 shared table
  const { data: eligibilityRules = [] } = useQuery({
    queryKey: ['component-material-eligibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_material_eligibility')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Load editing SKU data
  useEffect(() => {
    if (editingSKU) {
      setSelectedTypeId(editingSKU.product_type_id);
      setSelectedStyleId(editingSKU.product_style_id);
      setSkuCode(editingSKU.sku_code);
      setSkuName(editingSKU.sku_name);
      setHeight(editingSKU.height);
      setPostType(editingSKU.post_type);
      setVariables(editingSKU.variables || {});
      setComponents(editingSKU.components || {});
    }
  }, [editingSKU]);

  // Get selected type and style
  const selectedType = productTypes.find(t => t.id === selectedTypeId);
  const selectedStyle = productStyles.find(s => s.id === selectedStyleId);

  // Set default variable values when type changes
  useEffect(() => {
    if (productVariables.length > 0) {
      const defaults: Record<string, number | string> = {};
      productVariables.forEach(v => {
        if (v.default_value && !(v.variable_code in variables)) {
          if (v.variable_type === 'integer') {
            defaults[v.variable_code] = parseInt(v.default_value);
          } else if (v.variable_type === 'decimal') {
            defaults[v.variable_code] = parseFloat(v.default_value);
          } else {
            defaults[v.variable_code] = v.default_value;
          }
        }
      });
      if (Object.keys(defaults).length > 0) {
        setVariables(prev => ({ ...defaults, ...prev }));
      }
    }
  }, [productVariables, variables]);

  // Filter materials for a component type based on eligibility rules
  const getEligibleMaterials = useMemo(() => {
    return (componentCode: string): Material[] => {
      const rules = eligibilityRules.filter(r => r.component_code === componentCode);
      if (rules.length === 0) return allMaterials;

      return allMaterials.filter(m => {
        return rules.some(rule => {
          if (rule.material_sku && rule.material_sku === m.material_sku) return true;
          if (rule.material_sub_category && rule.material_sub_category === m.sub_category) return true;
          if (rule.material_category && !rule.material_sub_category && rule.material_category === m.category) return true;
          return false;
        });
      });
    };
  }, [eligibilityRules, allMaterials]);

  // Get relevant component types for the selected product type
  const relevantComponentTypes = useMemo(() => {
    if (!selectedType) return [];
    const typeCode = selectedType.code;
    // Filter by product type code - components with matching eligibility rules
    const relevantCodes = new Set<string>();
    eligibilityRules
      .filter(r => !r.product_type_code || r.product_type_code === typeCode)
      .forEach(r => relevantCodes.add(r.component_code));

    return componentTypes.filter(c => relevantCodes.has(c.code));
  }, [selectedType, componentTypes, eligibilityRules]);

  // Set component material
  const setComponentMaterial = (componentCode: string, materialSku: string) => {
    setComponents(prev => ({
      ...prev,
      [componentCode]: materialSku,
    }));
  };

  // Set variable value
  const setVariable = (code: string, value: number | string) => {
    setVariables(prev => ({
      ...prev,
      [code]: value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setSelectedTypeId(null);
    setSelectedStyleId(null);
    setSkuCode('');
    setSkuName('');
    setHeight(6);
    setPostType('WOOD');
    setVariables({});
    setComponents({});
    onClearSelection?.();
  };

  // Save SKU mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!skuCode) throw new Error('SKU code is required');
      if (!selectedTypeId) throw new Error('Product type is required');
      if (!selectedStyleId) throw new Error('Style is required');

      const skuData = {
        sku_code: skuCode,
        sku_name: skuName || generateSkuName(),
        product_type_id: selectedTypeId,
        product_style_id: selectedStyleId,
        height,
        post_type: postType,
        variables,
        components,
        is_active: true,
      };

      if (editingSKUId) {
        // Update existing
        const { error } = await supabase
          .from('sku_catalog_v2')
          .update(skuData)
          .eq('id', editingSKUId);
        if (error) throw error;
        return editingSKUId;
      } else {
        // Insert new
        const { data: newSku, error } = await supabase
          .from('sku_catalog_v2')
          .insert(skuData)
          .select('id')
          .single();
        if (error) throw error;
        return newSku.id;
      }
    },
    onSuccess: () => {
      showSuccess(editingSKUId ? 'SKU updated successfully' : 'SKU created successfully');
      queryClient.invalidateQueries({ queryKey: ['sku-catalog-v2'] });
      queryClient.invalidateQueries({ queryKey: ['sku-v2'] });
      resetForm();
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to save SKU');
    },
  });

  // Generate suggested SKU name
  const generateSkuName = () => {
    const typeName = selectedType?.name || '';
    const styleName = selectedStyle?.name || '';
    const h = `${height}'`;
    const pt = postType === 'STEEL' ? 'Steel Post' : 'Wood Post';
    return `${typeName} ${styleName} ${h} ${pt}`.trim();
  };

  // Loading state
  if (loadingTypes || loadingMaterials) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // No product types available
  if (productTypes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Product Types</h2>
          <p className="text-gray-600">
            Product types need to be configured in the database (product_types_v2).
          </p>
        </div>
      </div>
    );
  }

  const hasRequiredFields = skuCode && selectedTypeId && selectedStyleId;

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden h-full">
      {/* Left Panel - Configuration */}
      <div className="w-[500px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {editingSKUId && (
              <button
                onClick={resetForm}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title="New SKU"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {editingSKUId ? 'Edit SKU' : 'SKU Builder'}
              </h1>
              {editingSKUId && (
                <p className="text-xs text-purple-600">{skuCode}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasRequiredFields}
              className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm font-medium flex items-center gap-1.5 transition-colors disabled:bg-gray-400 hover:bg-purple-700"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingSKUId ? 'Update' : 'Save SKU'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* SKU Code & Name */}
          <div className="flex gap-3">
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU Code *</label>
              <input
                type="text"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
                placeholder="A07"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU Name</label>
              <input
                type="text"
                value={skuName || generateSkuName()}
                onChange={(e) => setSkuName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Product Type Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Product Type *</label>
            <div className="flex flex-wrap gap-2">
              {productTypes.map((type: ProductTypeV2) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedTypeId(type.id);
                    setSelectedStyleId(null);
                    setVariables({});
                    setComponents({});
                  }}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    selectedTypeId === type.id
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Style Selection */}
          {selectedTypeId && productStyles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Style *</label>
              <div className="flex flex-wrap gap-2">
                {productStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyleId(style.id)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedStyleId === style.id
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Specifications */}
          {selectedTypeId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Height</label>
                <select
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {[4, 5, 6, 7, 8].map(h => (
                    <option key={h} value={h}>{h} ft</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post Type</label>
                <select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as 'WOOD' | 'STEEL')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="WOOD">Wood</option>
                  <option value="STEEL">Steel</option>
                </select>
              </div>
            </div>
          )}

          {/* Product Variables */}
          {selectedTypeId && productVariables.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Variables</h3>
              <div className="bg-blue-50 rounded-lg p-3 grid grid-cols-2 gap-3">
                {productVariables.map((v) => (
                  <div key={v.id}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {v.variable_name} {v.unit && `(${v.unit})`}
                    </label>
                    {v.variable_type === 'select' && v.allowed_values ? (
                      <select
                        value={variables[v.variable_code] ?? v.default_value ?? ''}
                        onChange={(e) => setVariable(v.variable_code, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                      >
                        {v.allowed_values.map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={variables[v.variable_code] ?? v.default_value ?? ''}
                        onChange={(e) => setVariable(v.variable_code,
                          v.variable_type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value)
                        )}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                        step={v.variable_type === 'decimal' ? '0.1' : '1'}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Component Materials */}
          {selectedTypeId && relevantComponentTypes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Components</h3>
              <div className="bg-purple-50 rounded-lg p-3 space-y-3">
                {relevantComponentTypes.map((comp) => {
                  const eligible = getEligibleMaterials(comp.code);
                  const selected = components[comp.code];

                  return (
                    <div key={comp.id} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-24 flex-shrink-0">
                        {comp.name}
                      </span>
                      <select
                        value={selected || ''}
                        onChange={(e) => setComponentMaterial(comp.code, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                      >
                        <option value="">Select {comp.name.toLowerCase()}...</option>
                        {eligible.map(m => (
                          <option key={m.id} value={m.material_sku}>
                            {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warning if no type selected */}
          {!selectedTypeId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Select a product type</p>
                <p className="text-xs text-amber-600 mt-1">
                  Choose a product type above to configure variables and components.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Preview Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Length:</span>
                <input
                  type="number"
                  value={previewLength}
                  onChange={(e) => setPreviewLength(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-400">ft</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Lines:</span>
                <select
                  value={previewLines}
                  onChange={(e) => setPreviewLines(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedTypeId && Object.keys(components).length > 0 ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-purple-600 text-white rounded-lg px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide opacity-80">Cost/Ft</div>
                  <div className="text-xl font-bold">$0.00</div>
                </div>
                <div className="bg-green-600 text-white rounded-lg px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide opacity-80">Total Cost</div>
                  <div className="text-xl font-bold">$0.00</div>
                </div>
                <div className="bg-amber-500 text-white rounded-lg px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide opacity-80">Material/Ft</div>
                  <div className="text-xl font-bold">$0.00</div>
                </div>
                <div className="bg-blue-500 text-white rounded-lg px-4 py-3 text-center">
                  <div className="text-xs uppercase tracking-wide opacity-80">Labor/Ft</div>
                  <div className="text-xl font-bold">$0.00</div>
                </div>
              </div>

              {/* Variables Summary */}
              {Object.keys(variables).length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Variables</h3>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(variables).map(([code, value]) => (
                        <span key={code} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {code}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Materials */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Selected Materials</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(components).map(([componentCode, materialSku]) => {
                    const material = allMaterials.find(m => m.material_sku === materialSku);
                    const componentType = componentTypes.find(c => c.code === componentCode);

                    if (!materialSku) return null;

                    return (
                      <div key={componentCode} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {componentType?.name || componentCode}
                          </div>
                          <div className="text-xs text-gray-500">
                            {materialSku} - {material?.material_name}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-green-600">
                          ${material?.unit_cost.toFixed(2) || '0.00'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calculation Preview Placeholder */}
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <p className="text-gray-500 text-sm">
                  BOM calculation preview will use FormulaInterpreter when Calculator is implemented.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select materials to see preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
