import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Check,
  GripVertical,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

// Predefined color palette
const COLOR_PALETTE = [
  { hex: '#DC2626', name: 'Red' },
  { hex: '#EA580C', name: 'Orange' },
  { hex: '#CA8A04', name: 'Yellow' },
  { hex: '#16A34A', name: 'Green' },
  { hex: '#0891B2', name: 'Cyan' },
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#DB2777', name: 'Pink' },
  { hex: '#4B5563', name: 'Gray' },
  { hex: '#1F2937', name: 'Dark Gray' },
];

interface YardArea {
  id: string;
  yard_id: string | null;
  area_code: string;
  area_name: string;
  color_hex: string;
  color_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface Yard {
  id: string;
  code: string;
  name: string;
}

export default function YardAreasPage() {
  const queryClient = useQueryClient();
  const [selectedYardId, setSelectedYardId] = useState<string>('global');
  const [editingArea, setEditingArea] = useState<YardArea | null>(null);
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [newArea, setNewArea] = useState({
    area_code: '',
    area_name: '',
    color_hex: '#2563EB',
    color_name: 'Blue',
    description: '',
  });

  // Fetch yards
  const { data: yards = [], isLoading: loadingYards } = useQuery({
    queryKey: ['yards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yards')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as Yard[];
    },
  });

  // Fetch areas
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['yard-areas', selectedYardId],
    queryFn: async () => {
      let query = supabase
        .from('yard_areas')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (selectedYardId === 'global') {
        query = query.is('yard_id', null);
      } else {
        query = query.eq('yard_id', selectedYardId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as YardArea[];
    },
  });

  // Add area mutation
  const addAreaMutation = useMutation({
    mutationFn: async () => {
      if (!newArea.area_code.trim()) throw new Error('Area code is required');
      if (!newArea.area_name.trim()) throw new Error('Area name is required');

      const maxOrder = areas.length > 0 ? Math.max(...areas.map(a => a.display_order)) : 0;

      const { error } = await supabase
        .from('yard_areas')
        .insert({
          yard_id: selectedYardId === 'global' ? null : selectedYardId,
          area_code: newArea.area_code.trim().toUpperCase(),
          area_name: newArea.area_name.trim(),
          color_hex: newArea.color_hex,
          color_name: newArea.color_name,
          description: newArea.description.trim() || null,
          display_order: maxOrder + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-areas'] });
      setIsAddingArea(false);
      setNewArea({
        area_code: '',
        area_name: '',
        color_hex: '#2563EB',
        color_name: 'Blue',
        description: '',
      });
      showSuccess('Area added successfully');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to add area');
    },
  });

  // Update area mutation
  const updateAreaMutation = useMutation({
    mutationFn: async (area: YardArea) => {
      const { error } = await supabase
        .from('yard_areas')
        .update({
          area_code: area.area_code.trim().toUpperCase(),
          area_name: area.area_name.trim(),
          color_hex: area.color_hex,
          color_name: area.color_name,
          description: area.description?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', area.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-areas'] });
      setEditingArea(null);
      showSuccess('Area updated');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to update area');
    },
  });

  // Delete area mutation
  const deleteAreaMutation = useMutation({
    mutationFn: async (areaId: string) => {
      const { error } = await supabase
        .from('yard_areas')
        .update({ is_active: false })
        .eq('id', areaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-areas'] });
      showSuccess('Area removed');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to remove area');
    },
  });

  const selectColor = (hex: string, name: string, isNew: boolean) => {
    if (isNew) {
      setNewArea({ ...newArea, color_hex: hex, color_name: name });
    } else if (editingArea) {
      setEditingArea({ ...editingArea, color_hex: hex, color_name: name });
    }
  };

  if (loadingYards) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Stocking Areas</h1>
              <p className="text-xs text-gray-500">Organize materials by yard sections with colors</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Yard/Global Selector */}
            <select
              value={selectedYardId}
              onChange={(e) => setSelectedYardId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500"
            >
              <option value="global">Global (All Yards)</option>
              {yards.map(yard => (
                <option key={yard.id} value={yard.id}>
                  {yard.code} - {yard.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsAddingArea(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Area
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loadingAreas ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : areas.length === 0 && !isAddingArea ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Palette className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No stocking areas defined</p>
            <p className="text-sm mb-4">
              {selectedYardId === 'global'
                ? 'Add global areas that apply to all yards'
                : 'Add areas specific to this yard'}
            </p>
            <button
              onClick={() => setIsAddingArea(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Area
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {/* Existing Areas */}
            {areas.map((area, index) => (
              <div
                key={area.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden flex items-stretch"
              >
                {/* Color Stripe */}
                <div
                  className="w-3 flex-shrink-0"
                  style={{ backgroundColor: area.color_hex }}
                />

                {/* Content */}
                <div className="flex-1 p-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-gray-400 cursor-grab">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-sm font-medium text-gray-500 w-6">{index + 1}</span>
                  </div>

                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: area.color_hex }}
                  >
                    {area.area_code.slice(0, 3)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{area.area_name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {area.area_code}
                      </span>
                    </div>
                    {area.description && (
                      <p className="text-sm text-gray-500">{area.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingArea(area)}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Edit area"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${area.area_name}" area?`)) {
                          deleteAreaMutation.mutate(area.id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove area"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Area Form */}
            {isAddingArea && (
              <div className="bg-purple-50 rounded-xl border-2 border-dashed border-purple-300 p-4">
                <h4 className="text-sm font-semibold text-purple-700 mb-4">New Stocking Area</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Area Code *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., POSTS"
                      value={newArea.area_code}
                      onChange={(e) => setNewArea({ ...newArea, area_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Area Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Posts & Rails"
                      value={newArea.area_name}
                      onChange={(e) => setNewArea({ ...newArea, area_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Wood and steel posts, rails"
                      value={newArea.description}
                      onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map(color => (
                        <button
                          key={color.hex}
                          onClick={() => selectColor(color.hex, color.name, true)}
                          className={`w-8 h-8 rounded-lg transition-all ${
                            newArea.color_hex === color.hex
                              ? 'ring-2 ring-offset-2 ring-purple-500 scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setIsAddingArea(false);
                      setNewArea({
                        area_code: '',
                        area_name: '',
                        color_hex: '#2563EB',
                        color_name: 'Blue',
                        description: '',
                      });
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addAreaMutation.mutate()}
                    disabled={addAreaMutation.isPending || !newArea.area_code.trim() || !newArea.area_name.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {addAreaMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Add Area
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Area Modal */}
      {editingArea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit Stocking Area</h3>
              <button
                onClick={() => setEditingArea(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area Code *
                  </label>
                  <input
                    type="text"
                    value={editingArea.area_code}
                    onChange={(e) => setEditingArea({ ...editingArea, area_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area Name *
                  </label>
                  <input
                    type="text"
                    value={editingArea.area_name}
                    onChange={(e) => setEditingArea({ ...editingArea, area_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingArea.description || ''}
                  onChange={(e) => setEditingArea({ ...editingArea, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Wood and steel posts, rails"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map(color => (
                    <button
                      key={color.hex}
                      onClick={() => selectColor(color.hex, color.name, false)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        editingArea.color_hex === color.hex
                          ? 'ring-2 ring-offset-2 ring-purple-500 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Selected: <span style={{ color: editingArea.color_hex }} className="font-medium">{editingArea.color_name}</span>
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setEditingArea(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateAreaMutation.mutate(editingArea)}
                disabled={updateAreaMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {updateAreaMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
