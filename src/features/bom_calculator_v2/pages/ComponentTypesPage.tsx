/**
 * Component Types Page (V2)
 *
 * Simple admin view for managing component types.
 * These define which component slots exist (post, picket, rail, etc.)
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Settings2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

interface ComponentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit_type: string;
  display_order: number;
  is_active: boolean;
}

export function ComponentTypesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch all component types
  const { data: componentTypes, isLoading } = useQuery({
    queryKey: ['component-types-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_types_v2')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as ComponentType[];
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComponentType> & { id: string }) => {
      const { error } = await supabase
        .from('component_types_v2')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2'] });
      setEditingId(null);
      showSuccess('Component type updated');
    },
    onError: () => {
      showError('Failed to update component type');
    },
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (newComponent: Omit<ComponentType, 'id' | 'is_active'>) => {
      const { error } = await supabase
        .from('component_types_v2')
        .insert({ ...newComponent, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2'] });
      setShowAddForm(false);
      showSuccess('Component type added');
    },
    onError: () => {
      showError('Failed to add component type');
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('component_types_v2')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types-v2'] });
      showSuccess('Component type archived');
    },
    onError: () => {
      showError('Failed to archive component type');
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const activeComponents = componentTypes?.filter(c => c.is_active) || [];
  const archivedComponents = componentTypes?.filter(c => !c.is_active) || [];

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
                Define which component slots exist for SKUs (post, picket, rail, etc.)
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Add Form */}
        {showAddForm && (
          <div className="mb-6">
            <AddComponentForm
              onSave={(data) => addMutation.mutate(data)}
              onCancel={() => setShowAddForm(false)}
              nextOrder={activeComponents.length + 1}
              isLoading={addMutation.isPending}
            />
          </div>
        )}

        {/* Active Components */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              Active Component Types ({activeComponents.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {activeComponents.map((comp) => (
              <ComponentRow
                key={comp.id}
                component={comp}
                isEditing={editingId === comp.id}
                onEdit={() => setEditingId(comp.id)}
                onCancel={() => setEditingId(null)}
                onSave={(updates) => updateMutation.mutate({ id: comp.id, ...updates })}
                onDelete={() => {
                  if (confirm(`Archive "${comp.name}"?`)) {
                    deleteMutation.mutate(comp.id);
                  }
                }}
                isLoading={updateMutation.isPending || deleteMutation.isPending}
              />
            ))}
            {activeComponents.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No component types defined yet.
              </div>
            )}
          </div>
        </div>

        {/* Archived Components */}
        {archivedComponents.length > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden opacity-75">
            <div className="px-6 py-4 bg-gray-100 border-b border-gray-200">
              <h2 className="font-semibold text-gray-600">
                Archived ({archivedComponents.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {archivedComponents.map((comp) => (
                <div key={comp.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm text-gray-500">{comp.code}</span>
                    <span className="mx-2 text-gray-400">-</span>
                    <span className="text-gray-600">{comp.name}</span>
                  </div>
                  <button
                    onClick={() => updateMutation.mutate({ id: comp.id, is_active: true })}
                    className="text-sm text-purple-600 hover:text-purple-800"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Component row with edit capabilities
function ComponentRow({
  component,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  isLoading,
}: {
  component: ComponentType;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updates: Partial<ComponentType>) => void;
  onDelete: () => void;
  isLoading: boolean;
}) {
  const [editName, setEditName] = useState(component.name);
  const [editDescription, setEditDescription] = useState(component.description || '');
  const [editUnitType, setEditUnitType] = useState(component.unit_type);

  if (isEditing) {
    return (
      <div className="px-6 py-4 bg-purple-50">
        <div className="grid grid-cols-12 gap-4 items-center">
          <div className="col-span-2">
            <span className="font-mono text-sm text-gray-600">{component.code}</span>
          </div>
          <div className="col-span-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              placeholder="Name"
            />
          </div>
          <div className="col-span-4">
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              placeholder="Description"
            />
          </div>
          <div className="col-span-1">
            <input
              type="text"
              value={editUnitType}
              onChange={(e) => setEditUnitType(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              placeholder="Unit"
            />
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button
              onClick={() => onSave({ name: editName, description: editDescription || null, unit_type: editUnitType })}
              disabled={isLoading}
              className="p-2 text-green-600 hover:bg-green-100 rounded"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="grid grid-cols-12 gap-4 items-center">
        <div className="col-span-2">
          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{component.code}</span>
        </div>
        <div className="col-span-3">
          <span className="font-medium text-gray-900">{component.name}</span>
        </div>
        <div className="col-span-4">
          <span className="text-sm text-gray-500">{component.description || '-'}</span>
        </div>
        <div className="col-span-1">
          <span className="text-xs text-gray-400">{component.unit_type}</span>
        </div>
        <div className="col-span-2 flex gap-2 justify-end">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Add new component form
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
    <div className="bg-white rounded-lg border border-purple-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Add New Component Type</h3>
      <div className="grid grid-cols-12 gap-4 items-end">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="e.g., post"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="e.g., Post"
          />
        </div>
        <div className="col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Optional description"
          />
        </div>
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <input
            type="text"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="Each"
          />
        </div>
        <div className="col-span-2 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!code || !name || isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComponentTypesPage;
