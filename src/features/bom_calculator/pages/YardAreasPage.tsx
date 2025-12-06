import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Check,
  Search,
  MapPin,
  Package,
  ChevronRight,
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

// Types
interface Yard {
  id: string;
  code: string;
  name: string;
}

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

interface YardSlot {
  id: string;
  area_id: string;
  slot_code: string;
  slot_name: string | null;
  display_order: number;
  is_active: boolean;
}

interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
}

interface MaterialLocationView {
  location_id: string;
  material_id: string;
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  area_id: string;
  slot_id: string | null;
  slot_code: string | null;
  slot_name: string | null;
}

export default function YardAreasPage() {
  const queryClient = useQueryClient();
  const [selectedYardId, setSelectedYardId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isAddingArea, setIsAddingArea] = useState(false);
  const [editingArea, setEditingArea] = useState<YardArea | null>(null);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [editingSlot, setEditingSlot] = useState<YardSlot | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [newArea, setNewArea] = useState({
    area_code: '',
    area_name: '',
    color_hex: '#2563EB',
    color_name: 'Blue',
    description: '',
  });
  const [newSlot, setNewSlot] = useState({ slot_code: '', slot_name: '' });

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

  // Set initial selectedYardId when yards load
  useEffect(() => {
    if (yards.length > 0 && !selectedYardId) {
      setSelectedYardId(yards[0].id);
    }
  }, [yards, selectedYardId]);

  // Fetch areas for selected yard
  const { data: areas = [], isLoading: loadingAreas } = useQuery({
    queryKey: ['yard-areas', selectedYardId],
    queryFn: async () => {
      if (!selectedYardId) return [];
      const { data, error } = await supabase
        .from('yard_areas')
        .select('*')
        .eq('yard_id', selectedYardId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as YardArea[];
    },
    enabled: !!selectedYardId,
  });

  // Fetch slots for selected area
  const { data: slots = [] } = useQuery({
    queryKey: ['yard-slots', selectedAreaId],
    queryFn: async () => {
      if (!selectedAreaId) return [];
      const { data, error } = await supabase
        .from('yard_slots')
        .select('*')
        .eq('area_id', selectedAreaId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as YardSlot[];
    },
    enabled: !!selectedAreaId,
  });

  // Fetch material locations for selected area
  const { data: materialLocations = [] } = useQuery({
    queryKey: ['material-locations', selectedAreaId],
    queryFn: async () => {
      if (!selectedAreaId) return [];
      const { data, error } = await supabase
        .from('v_material_locations')
        .select('*')
        .eq('area_id', selectedAreaId);
      if (error) throw error;
      return data as MaterialLocationView[];
    },
    enabled: !!selectedAreaId,
  });

  // Fetch all materials for the browser
  const { data: allMaterials = [] } = useQuery({
    queryKey: ['all-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_sku, material_name, category, sub_category')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(allMaterials.map(m => m.category))].sort();
  }, [allMaterials]);

  // Filter materials for browser
  const filteredMaterials = useMemo(() => {
    return allMaterials.filter(m => {
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (materialSearch) {
        const search = materialSearch.toLowerCase();
        if (!m.material_sku.toLowerCase().includes(search) &&
            !m.material_name.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [allMaterials, categoryFilter, materialSearch]);

  // Check if material is already assigned to this area
  const isMaterialAssigned = (materialId: string) => {
    return materialLocations.some(ml => ml.material_id === materialId);
  };

  // Get selected area
  const selectedArea = areas.find(a => a.id === selectedAreaId);

  // ============================================
  // MUTATIONS
  // ============================================

  // Add area
  const addAreaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedYardId) {
        throw new Error('Please select a yard first');
      }
      if (!newArea.area_code.trim() || !newArea.area_name.trim()) {
        throw new Error('Area code and name are required');
      }
      const maxOrder = areas.length > 0 ? Math.max(...areas.map(a => a.display_order)) : 0;
      const { error } = await supabase.from('yard_areas').insert({
        yard_id: selectedYardId,
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
      setNewArea({ area_code: '', area_name: '', color_hex: '#2563EB', color_name: 'Blue', description: '' });
      showSuccess('Area created');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Update area
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
    onError: (err: Error) => showError(err.message),
  });

  // Delete area
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
      if (selectedAreaId) setSelectedAreaId(null);
      showSuccess('Area deleted');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Add slot
  const addSlotMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAreaId || !newSlot.slot_code.trim()) {
        throw new Error('Slot code is required');
      }
      const maxOrder = slots.length > 0 ? Math.max(...slots.map(s => s.display_order)) : 0;
      const { error } = await supabase.from('yard_slots').insert({
        area_id: selectedAreaId,
        slot_code: newSlot.slot_code.trim(),
        slot_name: newSlot.slot_name.trim() || null,
        display_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-slots'] });
      setIsAddingSlot(false);
      setNewSlot({ slot_code: '', slot_name: '' });
      showSuccess('Slot added');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Update slot
  const updateSlotMutation = useMutation({
    mutationFn: async (slot: YardSlot) => {
      const { error } = await supabase
        .from('yard_slots')
        .update({
          slot_code: slot.slot_code.trim(),
          slot_name: slot.slot_name?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', slot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-slots'] });
      setEditingSlot(null);
      showSuccess('Slot updated');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Delete slot
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('yard_slots')
        .update({ is_active: false })
        .eq('id', slotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-slots'] });
      queryClient.invalidateQueries({ queryKey: ['material-locations'] });
      showSuccess('Slot deleted');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Assign material to area/slot
  const assignMaterialMutation = useMutation({
    mutationFn: async ({ materialId, slotId }: { materialId: string; slotId?: string }) => {
      if (!selectedAreaId) throw new Error('No area selected');
      const { error } = await supabase.from('material_locations').upsert({
        material_id: materialId,
        area_id: selectedAreaId,
        slot_id: slotId || null,
      }, {
        onConflict: 'material_id,area_id',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-locations'] });
      showSuccess('Material assigned');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Remove material assignment
  const removeMaterialMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from('material_locations')
        .delete()
        .eq('id', locationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-locations'] });
      showSuccess('Material removed');
    },
    onError: (err: Error) => showError(err.message),
  });

  // Update material slot
  const updateMaterialSlotMutation = useMutation({
    mutationFn: async ({ locationId, slotId }: { locationId: string; slotId: string | null }) => {
      const { error } = await supabase
        .from('material_locations')
        .update({ slot_id: slotId, updated_at: new Date().toISOString() })
        .eq('id', locationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-locations'] });
      showSuccess('Slot updated');
    },
    onError: (err: Error) => showError(err.message),
  });

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
              <p className="text-xs text-gray-500">Organize warehouse by areas and slots, assign SKUs to locations</p>
            </div>
          </div>

          <select
            value={selectedYardId}
            onChange={(e) => {
              setSelectedYardId(e.target.value);
              setSelectedAreaId(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500"
          >
            {yards.map(yard => (
              <option key={yard.id} value={yard.id}>
                {yard.code} - {yard.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Areas List */}
        <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Areas</h2>
            <button
              onClick={() => setIsAddingArea(true)}
              className="p-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1">
            {loadingAreas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : areas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No areas yet</p>
                <button
                  onClick={() => setIsAddingArea(true)}
                  className="mt-2 text-sm text-purple-600 hover:underline"
                >
                  Add first area
                </button>
              </div>
            ) : (
              areas.map(area => (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
                    selectedAreaId === area.id
                      ? 'bg-purple-100 text-purple-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: area.color_hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{area.area_name}</div>
                    <div className="text-xs text-gray-500">{area.area_code}</div>
                  </div>
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    selectedAreaId === area.id ? 'text-purple-600' : 'text-gray-400'
                  }`} />
                </button>
              ))
            )}

            {/* Add Area Form */}
            {isAddingArea && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 mt-2">
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Code (e.g., A1)"
                    value={newArea.area_code}
                    onChange={(e) => setNewArea({ ...newArea, area_code: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Name (e.g., Corner Section)"
                    value={newArea.area_name}
                    onChange={(e) => setNewArea({ ...newArea, area_name: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <div className="flex flex-wrap gap-1">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => setNewArea({ ...newArea, color_hex: color.hex, color_name: color.name })}
                        className={`w-6 h-6 rounded transition-all ${
                          newArea.color_hex === color.hex ? 'ring-2 ring-offset-1 ring-purple-500 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addAreaMutation.mutate()}
                      disabled={addAreaMutation.isPending || !newArea.area_code.trim() || !newArea.area_name.trim()}
                      className="flex-1 px-2 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:bg-gray-400 flex items-center justify-center gap-1"
                    >
                      {addAreaMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingArea(false);
                        setNewArea({ area_code: '', area_name: '', color_hex: '#2563EB', color_name: 'Blue', description: '' });
                      }}
                      className="px-2 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel - Area Details & Slots */}
        {selectedArea ? (
          <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
            {/* Area Header */}
            <div className="p-3 bg-white border-b border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: selectedArea.color_hex }}
                >
                  {selectedArea.area_code.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{selectedArea.area_name}</h3>
                  <p className="text-xs text-gray-500">{selectedArea.area_code}</p>
                </div>
                <button
                  onClick={() => setEditingArea(selectedArea)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selectedArea.area_name}"?`)) {
                      deleteAreaMutation.mutate(selectedArea.id);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Slots Section */}
            <div className="p-3 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Slots</h4>
                <button
                  onClick={() => setIsAddingSlot(true)}
                  className="p-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {slots.length === 0 && !isAddingSlot ? (
                  <p className="text-xs text-gray-400 py-2">No slots - materials assigned to area only</p>
                ) : (
                  slots.map(slot => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-2 p-1.5 bg-gray-50 rounded text-sm group"
                    >
                      <GripVertical className="w-3 h-3 text-gray-300" />
                      <span className="font-mono font-medium text-gray-700">{slot.slot_code}</span>
                      {slot.slot_name && <span className="text-gray-500">- {slot.slot_name}</span>}
                      <div className="flex-1" />
                      <button
                        onClick={() => setEditingSlot(slot)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-600"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this slot?')) deleteSlotMutation.mutate(slot.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
                {isAddingSlot && (
                  <div className="flex items-center gap-1 p-1">
                    <input
                      type="text"
                      placeholder="#1"
                      value={newSlot.slot_code}
                      onChange={(e) => setNewSlot({ ...newSlot, slot_code: e.target.value })}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Name (opt)"
                      value={newSlot.slot_name}
                      onChange={(e) => setNewSlot({ ...newSlot, slot_name: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => addSlotMutation.mutate()}
                      disabled={addSlotMutation.isPending || !newSlot.slot_code.trim()}
                      className="p-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingSlot(false);
                        setNewSlot({ slot_code: '', slot_name: '' });
                      }}
                      className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Materials */}
            <div className="flex-1 overflow-auto p-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Assigned Materials ({materialLocations.length})
              </h4>
              {materialLocations.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">
                  No materials assigned yet.<br />
                  Use the browser to add SKUs →
                </p>
              ) : (
                <div className="space-y-1">
                  {materialLocations.map(ml => (
                    <div
                      key={ml.location_id}
                      className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{ml.material_sku}</div>
                        <div className="text-xs text-gray-500 truncate">{ml.material_name}</div>
                      </div>
                      {slots.length > 0 && (
                        <select
                          value={ml.slot_id || ''}
                          onChange={(e) => updateMaterialSlotMutation.mutate({
                            locationId: ml.location_id,
                            slotId: e.target.value || null,
                          })}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5"
                        >
                          <option value="">No slot</option>
                          {slots.map(s => (
                            <option key={s.id} value={s.id}>{s.slot_code}</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={() => removeMaterialMutation.mutate(ml.location_id)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-80 bg-gray-50 border-r border-gray-200 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select an area to view details</p>
            </div>
          </div>
        )}

        {/* Right Panel - Material Browser */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Material Browser</h3>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search SKU or name..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {!selectedAreaId ? (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>Select an area to assign materials</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredMaterials.slice(0, 100).map(material => {
                  const isAssigned = isMaterialAssigned(material.id);
                  return (
                    <div
                      key={material.id}
                      className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                        isAssigned
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-white border-gray-100 hover:border-purple-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{material.material_sku}</div>
                        <div className="text-xs text-gray-500 truncate">{material.material_name}</div>
                        <div className="text-xs text-gray-400">{material.category}</div>
                      </div>
                      {isAssigned ? (
                        <span className="text-xs text-purple-600 font-medium px-2 py-1 bg-purple-100 rounded">
                          Assigned
                        </span>
                      ) : (
                        <button
                          onClick={() => assignMaterialMutation.mutate({ materialId: material.id })}
                          disabled={assignMaterialMutation.isPending}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
                {filteredMaterials.length > 100 && (
                  <p className="text-center text-xs text-gray-400 py-2">
                    Showing first 100 of {filteredMaterials.length} materials
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Area Modal */}
      {editingArea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Area</h3>
              <button onClick={() => setEditingArea(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={editingArea.area_code}
                    onChange={(e) => setEditingArea({ ...editingArea, area_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingArea.area_name}
                    onChange={(e) => setEditingArea({ ...editingArea, area_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map(color => (
                    <button
                      key={color.hex}
                      onClick={() => setEditingArea({ ...editingArea, color_hex: color.hex, color_name: color.name })}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        editingArea.color_hex === color.hex ? 'ring-2 ring-offset-2 ring-purple-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setEditingArea(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => updateAreaMutation.mutate(editingArea)}
                disabled={updateAreaMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {updateAreaMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Slot Modal */}
      {editingSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Slot</h3>
              <button onClick={() => setEditingSlot(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slot Code</label>
                <input
                  type="text"
                  value={editingSlot.slot_code}
                  onChange={(e) => setEditingSlot({ ...editingSlot, slot_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={editingSlot.slot_name || ''}
                  onChange={(e) => setEditingSlot({ ...editingSlot, slot_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setEditingSlot(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSlotMutation.mutate(editingSlot)}
                disabled={updateSlotMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {updateSlotMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
