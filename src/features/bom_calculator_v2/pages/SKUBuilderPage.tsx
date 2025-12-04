/**
 * SKU Builder Page - v2
 *
 * Build and configure product SKUs using the component-based system.
 * Dynamically loads product types, styles, and components.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, AlertTriangle, ArrowLeft, Package
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import {
  useProductTypesWithStyles,
  useProductTypeComponents,
  useComponentMaterialRules,
  useProductSKUWithDetails,
} from '../hooks';

interface SKUBuilderPageProps {
  editingSKUId?: string | null;
  onClearSelection?: () => void;
  isAdmin?: boolean;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
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
  const [postSpacing, setPostSpacing] = useState<number | null>(null);

  // Component material selections: component_id -> material_id
  const [componentMaterials, setComponentMaterials] = useState<Record<string, string>>({});

  // Preview parameters
  const [previewLength, setPreviewLength] = useState(100);
  const [previewLines, setPreviewLines] = useState(1);
  const [businessUnitId, setBusinessUnitId] = useState<string>('');

  // Fetch product types with styles
  const { data: productTypes = [], isLoading: loadingTypes } = useProductTypesWithStyles();

  // Fetch components for selected type
  const { data: typeComponents = [] } = useProductTypeComponents(selectedTypeId);

  // Fetch material rules for selected type
  const { data: materialRules = [] } = useComponentMaterialRules(selectedTypeId);

  // Fetch SKU details if editing
  const { data: editingSKU } = useProductSKUWithDetails(editingSKUId || null);

  // Fetch business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      if (data && data.length > 0 && !businessUnitId) {
        setBusinessUnitId(data[0].id);
      }
      return data as BusinessUnit[];
    },
  });

  // Fetch all materials
  const { data: allMaterials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-builder'],
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

  // Load editing SKU data
  useEffect(() => {
    if (editingSKU) {
      setSelectedTypeId(editingSKU.product_type_id);
      setSelectedStyleId(editingSKU.product_style_id);
      setSkuCode(editingSKU.sku_code);
      setSkuName(editingSKU.sku_name);
      setHeight(editingSKU.height);
      setPostType(editingSKU.post_type);
      setPostSpacing(editingSKU.post_spacing);

      // Set component materials
      const materials: Record<string, string> = {};
      editingSKU.components?.forEach(c => {
        materials[c.component_id] = c.material_id;
      });
      setComponentMaterials(materials);
    }
  }, [editingSKU]);

  // Get selected type and style
  const selectedType = productTypes.find(t => t.id === selectedTypeId);
  const selectedStyle = selectedType?.styles.find(s => s.id === selectedStyleId);

  // Set default post spacing from type
  useEffect(() => {
    if (selectedType && postSpacing === null) {
      setPostSpacing(selectedType.default_post_spacing || 8);
    }
  }, [selectedType, postSpacing]);

  // Filter materials for a component based on rules
  const getEligibleMaterials = (componentId: string): Material[] => {
    const rules = materialRules.filter(r => r.component_id === componentId);
    if (rules.length === 0) return allMaterials;

    return allMaterials.filter(m => {
      return rules.some(rule => {
        if (rule.material_id && rule.material_id === m.id) return true;
        if (rule.material_subcategory && rule.material_subcategory === m.sub_category) return true;
        if (rule.material_category && !rule.material_subcategory && rule.material_category === m.category) return true;
        return false;
      });
    });
  };

  // Set component material
  const setComponentMaterial = (componentId: string, materialId: string) => {
    setComponentMaterials(prev => ({
      ...prev,
      [componentId]: materialId,
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
    setPostSpacing(null);
    setComponentMaterials({});
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
        post_spacing: postSpacing,
        config_json: {},
        is_active: true,
      };

      let skuId: string;

      if (editingSKUId) {
        // Update existing
        const { error } = await supabase
          .from('product_skus')
          .update(skuData)
          .eq('id', editingSKUId);
        if (error) throw error;
        skuId = editingSKUId;

        // Delete existing component mappings
        await supabase
          .from('sku_components')
          .delete()
          .eq('sku_id', editingSKUId);
      } else {
        // Insert new
        const { data: newSku, error } = await supabase
          .from('product_skus')
          .insert(skuData)
          .select('id')
          .single();
        if (error) throw error;
        skuId = newSku.id;
      }

      // Insert component materials
      const componentRows = Object.entries(componentMaterials)
        .filter(([_, materialId]) => materialId)
        .map(([componentId, materialId]) => ({
          sku_id: skuId,
          component_id: componentId,
          material_id: materialId,
        }));

      if (componentRows.length > 0) {
        const { error } = await supabase
          .from('sku_components')
          .insert(componentRows);
        if (error) throw error;
      }

      return skuId;
    },
    onSuccess: () => {
      showSuccess(editingSKUId ? 'SKU updated successfully' : 'SKU created successfully');
      queryClient.invalidateQueries({ queryKey: ['product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-skus'] });
      queryClient.invalidateQueries({ queryKey: ['product-skus-catalog-v2'] });
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
            Configure product types in the Product Types page before creating SKUs.
          </p>
        </div>
      </div>
    );
  }

  const requiredComponents = typeComponents.filter(c => c.is_required);
  const optionalComponents = typeComponents.filter(c => !c.is_required);
  const allRequiredFilled = requiredComponents.every(c => componentMaterials[c.component_id]);

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
              disabled={saveMutation.isPending || !skuCode || !selectedTypeId || !selectedStyleId || !allRequiredFilled}
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
              <label className="block text-xs font-medium text-gray-700 mb-1">SKU Code</label>
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
            <label className="block text-xs font-medium text-gray-700 mb-2">Product Type</label>
            <div className="flex flex-wrap gap-2">
              {productTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedTypeId(type.id);
                    setSelectedStyleId(type.styles[0]?.id || null);
                    setPostSpacing(type.default_post_spacing || 8);
                    setComponentMaterials({});
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
          {selectedType && selectedType.styles.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Style</label>
              <div className="flex flex-wrap gap-2">
                {selectedType.styles.map((style) => (
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
            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post Spacing</label>
                <input
                  type="number"
                  value={postSpacing || ''}
                  onChange={(e) => setPostSpacing(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  step="0.1"
                />
              </div>
            </div>
          )}

          {/* Components */}
          {selectedTypeId && typeComponents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Components</h3>

              {/* Required Components */}
              {requiredComponents.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-purple-700">Required</span>
                    {!allRequiredFilled && (
                      <span className="text-xs text-red-600">* Select all required materials</span>
                    )}
                  </div>
                  {requiredComponents.map((comp) => {
                    const eligible = getEligibleMaterials(comp.component_id);
                    const selected = componentMaterials[comp.component_id];

                    return (
                      <div key={comp.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-24 flex-shrink-0">
                          {comp.component.name}
                        </span>
                        <select
                          value={selected || ''}
                          onChange={(e) => setComponentMaterial(comp.component_id, e.target.value)}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 ${
                            !selected ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">Select {comp.component.name.toLowerCase()}...</option>
                          {eligible.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Optional Components */}
              {optionalComponents.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <span className="text-xs font-medium text-gray-500">Optional</span>
                  {optionalComponents.map((comp) => {
                    const eligible = getEligibleMaterials(comp.component_id);
                    const selected = componentMaterials[comp.component_id];

                    return (
                      <div key={comp.id} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-24 flex-shrink-0">
                          {comp.component.name}
                        </span>
                        <select
                          value={selected || ''}
                          onChange={(e) => setComponentMaterial(comp.component_id, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                        >
                          <option value="">None</option>
                          {eligible.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.material_sku} - {m.material_name} (${m.unit_cost.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Warning if no type selected */}
          {!selectedTypeId && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Select a product type</p>
                <p className="text-xs text-amber-600 mt-1">
                  Choose a product type above to configure components and materials.
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
              <div className="flex items-center gap-2">
                <span className="text-gray-500">BU:</span>
                <select
                  value={businessUnitId}
                  onChange={(e) => setBusinessUnitId(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm w-24"
                >
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedTypeId && Object.keys(componentMaterials).length > 0 ? (
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

              {/* Selected Materials */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Selected Materials</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {typeComponents.map((comp) => {
                    const materialId = componentMaterials[comp.component_id];
                    const material = allMaterials.find(m => m.id === materialId);

                    if (!materialId) return null;

                    return (
                      <div key={comp.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{comp.component.name}</div>
                          <div className="text-xs text-gray-500">
                            {material?.material_sku} - {material?.material_name}
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
                  BOM calculation preview will be available once calculators are implemented.
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

