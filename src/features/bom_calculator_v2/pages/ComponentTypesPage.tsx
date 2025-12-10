/**
 * Component Types Page - V2
 *
 * Full-featured component management with V1 UI style.
 * Uses component_types_v2 for definitions and shared eligibility views.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings2,
  Search,
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  Package,
  Layers,
  Grid3X3,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

// =============================================================================
// TYPES
// =============================================================================

interface ComponentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit_type: string;
  display_order: number;
  is_active: boolean;
}

interface FenceTypeComponent {
  fence_type: string;
  component_id: string;
  component_code: string;
  component_name: string;
  component_description: string | null;
  default_category: string | null;
  is_required: boolean;
  filter_attribute: string | null;
  filter_values: string[] | null;
  display_order: number;
  is_visible: boolean;
}

interface EligibleMaterial {
  fence_type: string;
  component_id: string;
  component_code: string;
  component_name: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_cost: number;
}

type FenceTab = 'wood_vertical' | 'wood_horizontal' | 'iron';

const FENCE_TABS: { key: FenceTab; label: string; icon: React.ReactNode }[] = [
  { key: 'wood_vertical', label: 'Wood Vertical', icon: <Grid3X3 className="w-4 h-4" /> },
  { key: 'wood_horizontal', label: 'Wood Horizontal', icon: <Layers className="w-4 h-4" /> },
  { key: 'iron', label: 'Iron', icon: <Package className="w-4 h-4" /> },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ComponentTypesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FenceTab>('wood_vertical');
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Fetch all V2 component types
  const { data: componentTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['component-types-v2-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_types_v2')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as ComponentType[];
    },
  });

  // Fetch fence type components from V1 view (shared)
  const { data: fenceTypeComponents = [] } = useQuery({
    queryKey: ['fence-type-components-v2', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_fence_type_components')
        .select('*')
        .eq('fence_type', activeTab)
        .order('display_order');

      if (error) {
        console.log('v_fence_type_components not available, using component_types_v2');
        return [];
      }
      return data as FenceTypeComponent[];
    },
  });

  // Fetch eligible materials from V1 view (shared)
  const { data: eligibleMaterials = [] } = useQuery({
    queryKey: ['eligible-materials-v2', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_component_eligible_materials')
        .select('*')
        .eq('fence_type', activeTab);

      if (error) {
        console.log('v_component_eligible_materials not available');
        return [];
      }
      return data as EligibleMaterial[];
    },
  });

  // =============================================================================
  // MUTATIONS
  // =============================================================================

  const addMutation = useMutation({
    mutationFn: async (newComp: Omit<ComponentType, 'id' | 'is_active'>) => {
      const { error } = await supabase
        .from('component_types_v2')
        .insert({ ...newComp, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2-list'] });
      setShowAddForm(false);
      showSuccess('Component type added');
    },
    onError: () => {
      showError('Failed to add component type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComponentType> & { id: string }) => {
      const { error } = await supabase
        .from('component_types_v2')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2-list'] });
      setEditingId(null);
      showSuccess('Component type updated');
    },
    onError: () => {
      showError('Failed to update component type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('component_types_v2')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2-list'] });
      showSuccess('Component type archived');
    },
    onError: () => {
      showError('Failed to archive component type');
    },
  });

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  // Get material count per component
  const materialCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    eligibleMaterials.forEach(em => {
      const key = em.component_code;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [eligibleMaterials]);

  // Filter component types based on search
  const filteredComponentTypes = useMemo(() => {
    const active = componentTypes.filter(c => c.is_active);
    if (!searchTerm) return active;
    const search = searchTerm.toLowerCase();
    return active.filter(c =>
      c.code.toLowerCase().includes(search) ||
      c.name.toLowerCase().includes(search)
    );
  }, [componentTypes, searchTerm]);

  // Toggle component expansion
  const toggleExpanded = (code: string) => {
    const newSet = new Set(expandedComponents);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setExpandedComponents(newSet);
  };

  // Get materials for a component
  const getMaterialsForComponent = (code: string) => {
    return eligibleMaterials.filter(em => em.component_code === code);
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loadingTypes) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading component types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Component Types</h1>
              <p className="text-sm text-gray-500">
                Manage component slots for SKU formulas (V2)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Component Type
          </button>
        </div>
      </div>

      {/* Fence Type Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {FENCE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Component List */}
        <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search components..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="p-4 border-b border-gray-200 bg-purple-50">
              <AddComponentForm
                onSave={(data) => addMutation.mutate(data)}
                onCancel={() => setShowAddForm(false)}
                nextOrder={filteredComponentTypes.length + 1}
                isLoading={addMutation.isPending}
              />
            </div>
          )}

          {/* Component List */}
          <div className="flex-1 overflow-y-auto">
            {filteredComponentTypes.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No component types found
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredComponentTypes.map((comp) => {
                  const isExpanded = expandedComponents.has(comp.code);
                  const materials = getMaterialsForComponent(comp.code);
                  const count = materialCounts[comp.code] || 0;
                  const isEditing = editingId === comp.id;

                  return (
                    <div key={comp.id} className="bg-white">
                      {isEditing ? (
                        <EditComponentRow
                          component={comp}
                          onSave={(updates) => updateMutation.mutate({ id: comp.id, ...updates })}
                          onCancel={() => setEditingId(null)}
                          isLoading={updateMutation.isPending}
                        />
                      ) : (
                        <div
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => toggleExpanded(comp.code)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button className="p-0.5 text-gray-400">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                    {comp.code}
                                  </span>
                                  <span className="font-medium text-gray-900">{comp.name}</span>
                                </div>
                                {comp.description && (
                                  <p className="text-xs text-gray-500 mt-0.5">{comp.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {count} materials
                              </span>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setEditingId(comp.id)}
                                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Archive "${comp.name}"?`)) {
                                      deleteMutation.mutate(comp.id);
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Materials */}
                          {isExpanded && materials.length > 0 && (
                            <div className="mt-3 ml-7 space-y-1">
                              {materials.slice(0, 10).map((mat) => (
                                <div
                                  key={mat.material_id}
                                  className="flex items-center justify-between text-xs text-gray-600 py-1"
                                >
                                  <span className="font-mono">{mat.material_sku}</span>
                                  <span className="truncate max-w-[180px]">{mat.material_name}</span>
                                  <span className="text-gray-400">${mat.unit_cost.toFixed(2)}</span>
                                </div>
                              ))}
                              {materials.length > 10 && (
                                <div className="text-xs text-gray-400 italic">
                                  + {materials.length - 10} more materials
                                </div>
                              )}
                            </div>
                          )}

                          {isExpanded && materials.length === 0 && (
                            <div className="mt-3 ml-7 text-xs text-gray-400 italic">
                              No materials configured for {activeTab.replace('_', ' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Info */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Component Types (V2 Architecture)
              </h2>

              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Component types define the available slots in SKU configurations.
                  Each SKU can have materials assigned to these component slots.
                </p>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-medium text-purple-900 mb-2">V2 vs V1 Architecture</h3>
                  <ul className="space-y-2 text-purple-700">
                    <li>• <strong>V2:</strong> Uses <code className="bg-purple-100 px-1 rounded">component_types_v2</code> - simple component slot definitions</li>
                    <li>• <strong>V1:</strong> Uses <code className="bg-purple-100 px-1 rounded">component_definitions</code> with fence type associations</li>
                    <li>• Material eligibility rules are shared between V1 and V2</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Material Counts</h3>
                  <p className="text-gray-600">
                    Material counts shown are from the shared eligibility rules view
                    (<code className="bg-gray-100 px-1 rounded">v_component_eligible_materials</code>).
                    To manage eligibility rules, use the V1 Component Configurator.
                  </p>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Summary for {activeTab.replace('_', ' ')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {filteredComponentTypes.length}
                      </div>
                      <div className="text-xs text-gray-500">Component Types</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Object.values(materialCounts).reduce((a, b) => a + b, 0)}
                      </div>
                      <div className="text-xs text-gray-500">Total Materials</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {fenceTypeComponents.length}
                      </div>
                      <div className="text-xs text-gray-500">Fence Type Config</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function AddComponentForm({
  onSave,
  onCancel,
  nextOrder,
  isLoading,
}: {
  onSave: (data: Omit<ComponentType, 'id' | 'is_active'>) => void;
  onCancel: () => void;
  nextOrder: number;
  isLoading: boolean;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitType, setUnitType] = useState('Each');

  const handleSubmit = () => {
    if (!code || !name) return;
    onSave({
      code: code.toLowerCase().replace(/\s+/g, '_'),
      name,
      description: description || null,
      unit_type: unitType,
      display_order: nextOrder,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">Add New Component Type</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
            placeholder="e.g., post"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
            placeholder="e.g., Post"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
          placeholder="Optional description"
        />
      </div>
      <div className="flex gap-2">
        <div className="w-24">
          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Unit</label>
          <input
            type="text"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex-1 flex items-end gap-2">
          <button
            onClick={handleSubmit}
            disabled={!code || !name || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditComponentRow({
  component,
  onSave,
  onCancel,
  isLoading,
}: {
  component: ComponentType;
  onSave: (updates: Partial<ComponentType>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(component.name);
  const [description, setDescription] = useState(component.description || '');
  const [unitType, setUnitType] = useState(component.unit_type);

  return (
    <div className="px-4 py-3 bg-purple-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">{component.code}</span>
        <span className="text-xs text-gray-500">(code cannot be changed)</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
          placeholder="Name"
        />
        <input
          type="text"
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
          placeholder="Unit"
        />
        <button
          onClick={() => onSave({ name, description: description || null, unit_type: unitType })}
          disabled={isLoading}
          className="p-1.5 text-green-600 hover:bg-green-100 rounded"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        </button>
        <button
          onClick={onCancel}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-2 w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
        placeholder="Description (optional)"
      />
    </div>
  );
}

export default ComponentTypesPage;
