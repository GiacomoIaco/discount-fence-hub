import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings2,
  Search,
  Check,
  X,
  Plus,
  Loader2,
  ChevronRight,
  Filter,
  Package,
  Layers,
  Grid3X3,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { Material, FenceTypeDB, ComponentDefinition } from '../database.types';

// Types
interface ComponentMaterialEligibility {
  id: string;
  fence_type: FenceTypeDB;
  component_id: string;
  selection_mode: 'category' | 'subcategory' | 'specific';
  material_category: string | null;
  material_subcategory: string | null;
  material_id: string | null;
  min_length_ft: number | null;
  max_length_ft: number | null;
  notes: string | null;
  display_order: number;
  is_active: boolean;
}

interface EligibleMaterial {
  fence_type: FenceTypeDB;
  component_id: string;
  component_code: string;
  component_name: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
  length_ft: number | null;
}

type FenceTab = 'wood_vertical' | 'wood_horizontal' | 'iron';

const FENCE_TABS: { key: FenceTab; label: string; icon: React.ReactNode }[] = [
  { key: 'wood_vertical', label: 'Wood Vertical', icon: <Grid3X3 className="w-4 h-4" /> },
  { key: 'wood_horizontal', label: 'Wood Horizontal', icon: <Layers className="w-4 h-4" /> },
  { key: 'iron', label: 'Iron', icon: <Package className="w-4 h-4" /> },
];

export default function ComponentConfiguratorPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FenceTab>('wood_vertical');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Fetch component definitions for active fence type
  const { data: components = [] } = useQuery({
    queryKey: ['component-definitions', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_definitions')
        .select('*')
        .eq('is_active', true)
        .contains('fence_types', [activeTab])
        .order('display_order');

      if (error) throw error;
      return data as ComponentDefinition[];
    },
  });

  // Fetch all materials
  const { data: allMaterials = [] } = useQuery({
    queryKey: ['all-materials-configurator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');

      if (error) throw error;
      return data as Material[];
    },
  });

  // Fetch eligibility rules for active fence type
  const { data: eligibilityRules = [] } = useQuery({
    queryKey: ['component-eligibility', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_material_eligibility')
        .select('*')
        .eq('fence_type', activeTab)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ComponentMaterialEligibility[];
    },
  });

  // Fetch expanded eligible materials (the view)
  const { data: eligibleMaterials = [] } = useQuery({
    queryKey: ['eligible-materials-view', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_component_eligible_materials')
        .select('*')
        .eq('fence_type', activeTab)
        .order('component_code')
        .order('material_name');

      if (error) throw error;
      return data as EligibleMaterial[];
    },
  });

  // Get unique categories and subcategories
  const categories = useMemo(() => {
    const cats = [...new Set(allMaterials.map(m => m.category))].sort();
    return cats;
  }, [allMaterials]);

  const subcategories = useMemo(() => {
    if (!categoryFilter) return [];
    const subs = [...new Set(
      allMaterials
        .filter(m => m.category === categoryFilter && m.sub_category)
        .map(m => m.sub_category!)
    )].sort();
    return subs;
  }, [allMaterials, categoryFilter]);

  // Get selected component
  const selectedComponent = components.find(c => c.id === selectedComponentId);

  // Get rules for selected component
  const componentRules = eligibilityRules.filter(r => r.component_id === selectedComponentId);

  // Get eligible materials for selected component
  const componentEligibleMaterials = eligibleMaterials.filter(
    m => m.component_id === selectedComponentId
  );

  // Filter all materials for the browser
  const filteredMaterials = useMemo(() => {
    return allMaterials.filter(m => {
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (subcategoryFilter && m.sub_category !== subcategoryFilter) return false;
      if (materialSearch) {
        const search = materialSearch.toLowerCase();
        if (
          !m.material_sku.toLowerCase().includes(search) &&
          !m.material_name.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allMaterials, categoryFilter, subcategoryFilter, materialSearch]);

  // Check if a material is eligible for the selected component
  const isMaterialEligible = (materialId: string) => {
    return componentEligibleMaterials.some(m => m.material_id === materialId);
  };

  // Add category/subcategory rule
  const addCategoryRule = async (category: string, subcategory?: string) => {
    if (!selectedComponentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('component_material_eligibility')
        .insert({
          fence_type: activeTab,
          component_id: selectedComponentId,
          selection_mode: subcategory ? 'subcategory' : 'category',
          material_category: category,
          material_subcategory: subcategory || null,
        });

      if (error) throw error;
      showSuccess(`Added ${subcategory || category} to ${selectedComponent?.name}`);
      queryClient.invalidateQueries({ queryKey: ['component-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials-view'] });
    } catch (err) {
      console.error('Error adding rule:', err);
      showError('Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  // Add specific material
  const addSpecificMaterial = async (materialId: string) => {
    if (!selectedComponentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('component_material_eligibility')
        .insert({
          fence_type: activeTab,
          component_id: selectedComponentId,
          selection_mode: 'specific',
          material_id: materialId,
        });

      if (error) throw error;
      showSuccess('Material added');
      queryClient.invalidateQueries({ queryKey: ['component-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials-view'] });
    } catch (err) {
      console.error('Error adding material:', err);
      showError('Failed to add material');
    } finally {
      setSaving(false);
    }
  };

  // Remove material (specific only)
  const removeSpecificMaterial = async (materialId: string) => {
    if (!selectedComponentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('component_material_eligibility')
        .delete()
        .eq('fence_type', activeTab)
        .eq('component_id', selectedComponentId)
        .eq('material_id', materialId)
        .eq('selection_mode', 'specific');

      if (error) throw error;
      showSuccess('Material removed');
      queryClient.invalidateQueries({ queryKey: ['component-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials-view'] });
    } catch (err) {
      console.error('Error removing material:', err);
      showError('Failed to remove material');
    } finally {
      setSaving(false);
    }
  };

  // Remove a rule
  const removeRule = async (ruleId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('component_material_eligibility')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      showSuccess('Rule removed');
      queryClient.invalidateQueries({ queryKey: ['component-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials-view'] });
    } catch (err) {
      console.error('Error removing rule:', err);
      showError('Failed to remove rule');
    } finally {
      setSaving(false);
    }
  };

  // Toggle material eligibility
  const toggleMaterial = (materialId: string) => {
    if (isMaterialEligible(materialId)) {
      removeSpecificMaterial(materialId);
    } else {
      addSpecificMaterial(materialId);
    }
  };

  // Add all visible materials
  const addAllVisible = async () => {
    if (!selectedComponentId || filteredMaterials.length === 0) return;

    setSaving(true);
    try {
      const newMaterials = filteredMaterials.filter(m => !isMaterialEligible(m.id));
      if (newMaterials.length === 0) {
        showSuccess('All visible materials already added');
        return;
      }

      const inserts = newMaterials.map(m => ({
        fence_type: activeTab,
        component_id: selectedComponentId,
        selection_mode: 'specific' as const,
        material_id: m.id,
      }));

      const { error } = await supabase
        .from('component_material_eligibility')
        .insert(inserts);

      if (error) throw error;
      showSuccess(`Added ${newMaterials.length} materials`);
      queryClient.invalidateQueries({ queryKey: ['component-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-materials-view'] });
    } catch (err) {
      console.error('Error adding materials:', err);
      showError('Failed to add materials');
    } finally {
      setSaving(false);
    }
  };

  // Count eligible materials per component
  const getComponentMaterialCount = (componentId: string) => {
    return eligibleMaterials.filter(m => m.component_id === componentId).length;
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-green-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Component Configurator</h1>
            <p className="text-xs text-gray-500">Define which materials appear in SKU Builder dropdowns</p>
          </div>
        </div>
      </div>

      {/* Fence Type Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-1">
          {FENCE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedComponentId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Components */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Components</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {components.map(comp => {
              const count = getComponentMaterialCount(comp.id);
              const isSelected = selectedComponentId === comp.id;

              return (
                <button
                  key={comp.id}
                  onClick={() => setSelectedComponentId(comp.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-green-50 border-l-2 border-green-600'
                      : 'hover:bg-gray-50 border-l-2 border-transparent'
                  }`}
                >
                  <div>
                    <div className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-900'}`}>
                      {comp.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {comp.default_category || 'No default category'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Material Browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedComponent ? (
            <>
              {/* Component Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{selectedComponent.name}</h2>
                    <p className="text-xs text-gray-500">
                      {componentEligibleMaterials.length} materials eligible for {FENCE_TABS.find(t => t.key === activeTab)?.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addAllVisible}
                      disabled={saving || filteredMaterials.length === 0}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add All Visible ({filteredMaterials.filter(m => !isMaterialEligible(m.id)).length})
                    </button>
                  </div>
                </div>

                {/* Current Rules */}
                {componentRules.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {componentRules.map(rule => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          rule.selection_mode === 'category'
                            ? 'bg-blue-100 text-blue-700'
                            : rule.selection_mode === 'subcategory'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span>
                          {rule.selection_mode === 'category' && `Category: ${rule.material_category}`}
                          {rule.selection_mode === 'subcategory' && `${rule.material_category} → ${rule.material_subcategory}`}
                          {rule.selection_mode === 'specific' && 'Specific materials'}
                        </span>
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="p-0.5 hover:bg-white/50 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setSubcategoryFilter('');
                    }}
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {subcategories.length > 0 && (
                    <select
                      value={subcategoryFilter}
                      onChange={(e) => setSubcategoryFilter(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                    >
                      <option value="">All Subcategories</option>
                      {subcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  )}
                  {categoryFilter && (
                    <button
                      onClick={() => addCategoryRule(categoryFilter, subcategoryFilter || undefined)}
                      disabled={saving}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      + Add as Rule
                    </button>
                  )}
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    placeholder="Search materials..."
                    className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>

              {/* Material List */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="grid grid-cols-1 gap-1">
                  {filteredMaterials.map(material => {
                    const isEligible = isMaterialEligible(material.id);

                    return (
                      <div
                        key={material.id}
                        onClick={() => toggleMaterial(material.id)}
                        className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                          isEligible
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-white border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isEligible
                            ? 'bg-green-600 border-green-600'
                            : 'border-gray-300'
                        }`}>
                          {isEligible && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500">{material.material_sku}</span>
                            <span className="text-sm font-medium text-gray-900 truncate">{material.material_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{material.category}</span>
                            {material.sub_category && (
                              <>
                                <span>•</span>
                                <span>{material.sub_category}</span>
                              </>
                            )}
                            {material.length_ft && (
                              <>
                                <span>•</span>
                                <span>{material.length_ft}ft</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-medium text-gray-600">
                          ${material.unit_cost.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredMaterials.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No materials match your filters</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Settings2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Select a component to configure eligible materials</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
