import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Package,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

// Types
interface Yard {
  id: string;
  code: string;
  name: string;
  city: string;
}

interface YardSpot {
  id: string;
  yard_id: string;
  spot_code: string;
  spot_name: string | null;
  is_occupied: boolean;
  occupied_by_project_id: string | null;
  occupied_at: string | null;
  is_active: boolean;
  display_order: number;
}

interface OccupiedProject {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string | null;
  status: string;
}

interface SpotWithProject extends YardSpot {
  project?: OccupiedProject | null;
}

export default function YardSpotsPage() {
  const queryClient = useQueryClient();
  const [selectedYardId, setSelectedYardId] = useState<string>('');
  const [editingSpot, setEditingSpot] = useState<YardSpot | null>(null);
  const [isAddingSpot, setIsAddingSpot] = useState(false);
  const [newSpotCode, setNewSpotCode] = useState('');
  const [newSpotName, setNewSpotName] = useState('');

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
      // Auto-select first yard if none selected
      if (data.length > 0 && !selectedYardId) {
        setSelectedYardId(data[0].id);
      }
      return data as Yard[];
    },
  });

  // Fetch spots for selected yard with occupied project details
  const { data: spots = [], isLoading: loadingSpots } = useQuery({
    queryKey: ['yard-spots-with-projects', selectedYardId],
    queryFn: async () => {
      if (!selectedYardId) return [];

      const { data: spotsData, error: spotsError } = await supabase
        .from('yard_spots')
        .select('*')
        .eq('yard_id', selectedYardId)
        .eq('is_active', true)
        .order('display_order');

      if (spotsError) throw spotsError;

      // Get project details for occupied spots
      const occupiedProjectIds = spotsData
        .filter(s => s.occupied_by_project_id)
        .map(s => s.occupied_by_project_id);

      let projects: OccupiedProject[] = [];
      if (occupiedProjectIds.length > 0) {
        const { data: projectsData, error: projectsError } = await supabase
          .from('bom_projects')
          .select('id, project_code, project_name, customer_name, status')
          .in('id', occupiedProjectIds);

        if (projectsError) throw projectsError;
        projects = projectsData || [];
      }

      // Merge project data into spots
      const spotsWithProjects: SpotWithProject[] = spotsData.map(spot => ({
        ...spot,
        project: projects.find(p => p.id === spot.occupied_by_project_id) || null,
      }));

      return spotsWithProjects;
    },
    enabled: !!selectedYardId,
  });

  // Add spot mutation
  const addSpotMutation = useMutation({
    mutationFn: async () => {
      if (!newSpotCode.trim()) throw new Error('Spot code is required');

      const maxOrder = spots.length > 0 ? Math.max(...spots.map(s => s.display_order)) : 0;

      const { error } = await supabase
        .from('yard_spots')
        .insert({
          yard_id: selectedYardId,
          spot_code: newSpotCode.trim().toUpperCase(),
          spot_name: newSpotName.trim() || null,
          display_order: maxOrder + 1,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-spots-with-projects'] });
      setIsAddingSpot(false);
      setNewSpotCode('');
      setNewSpotName('');
      showSuccess('Spot added successfully');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to add spot');
    },
  });

  // Update spot mutation
  const updateSpotMutation = useMutation({
    mutationFn: async ({ id, spotCode, spotName }: { id: string; spotCode: string; spotName: string }) => {
      const { error } = await supabase
        .from('yard_spots')
        .update({
          spot_code: spotCode.trim().toUpperCase(),
          spot_name: spotName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-spots-with-projects'] });
      setEditingSpot(null);
      showSuccess('Spot updated');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to update spot');
    },
  });

  // Delete spot mutation
  const deleteSpotMutation = useMutation({
    mutationFn: async (spotId: string) => {
      const { error } = await supabase
        .from('yard_spots')
        .update({ is_active: false })
        .eq('id', spotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-spots-with-projects'] });
      showSuccess('Spot removed');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to remove spot');
    },
  });

  // Clear spot mutation (remove project from spot)
  const clearSpotMutation = useMutation({
    mutationFn: async (spotId: string) => {
      const { error } = await supabase
        .from('yard_spots')
        .update({
          is_occupied: false,
          occupied_by_project_id: null,
          occupied_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', spotId);

      if (error) throw error;

      // Also clear the project's yard_spot_id
      const spot = spots.find(s => s.id === spotId);
      if (spot?.occupied_by_project_id) {
        await supabase
          .from('bom_projects')
          .update({ yard_spot_id: null })
          .eq('id', spot.occupied_by_project_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-spots-with-projects'] });
      queryClient.invalidateQueries({ queryKey: ['yard-schedule'] });
      showSuccess('Spot cleared');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to clear spot');
    },
  });

  const selectedYard = yards.find(y => y.id === selectedYardId);
  const occupiedCount = spots.filter(s => s.is_occupied).length;
  const availableCount = spots.filter(s => !s.is_occupied).length;

  if (loadingYards) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Yard Spots</h1>
              <p className="text-xs text-gray-500">Manage staging locations</p>
            </div>
          </div>

          {/* Yard Selector */}
          <div className="flex items-center gap-3">
            <select
              value={selectedYardId}
              onChange={(e) => setSelectedYardId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
            >
              {yards.map(yard => (
                <option key={yard.id} value={yard.id}>
                  {yard.code} - {yard.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsAddingSpot(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Spot
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        {selectedYard && (
          <div className="flex items-center gap-4 mt-3">
            <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
              <span className="text-sm text-gray-600">Total: </span>
              <span className="font-semibold text-gray-900">{spots.length}</span>
            </div>
            <div className="px-3 py-1.5 bg-green-100 rounded-lg">
              <span className="text-sm text-green-600">Available: </span>
              <span className="font-semibold text-green-700">{availableCount}</span>
            </div>
            <div className="px-3 py-1.5 bg-amber-100 rounded-lg">
              <span className="text-sm text-amber-600">Occupied: </span>
              <span className="font-semibold text-amber-700">{occupiedCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loadingSpots ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <MapPin className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No spots configured</p>
            <p className="text-sm mb-4">Add staging spots for this yard</p>
            <button
              onClick={() => setIsAddingSpot(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add First Spot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {spots.map(spot => (
              <div
                key={spot.id}
                className={`rounded-xl border-2 transition-all ${
                  spot.is_occupied
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                {/* Spot Header */}
                <div className={`px-4 py-3 border-b ${spot.is_occupied ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                        spot.is_occupied ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {spot.spot_code}
                      </div>
                      <div>
                        {spot.spot_name && (
                          <p className="text-sm font-medium text-gray-700">{spot.spot_name}</p>
                        )}
                        <p className={`text-xs ${spot.is_occupied ? 'text-amber-600' : 'text-green-600'}`}>
                          {spot.is_occupied ? 'Occupied' : 'Available'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingSpot(spot)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit spot"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!spot.is_occupied && (
                        <button
                          onClick={() => {
                            if (confirm('Remove this spot?')) {
                              deleteSpotMutation.mutate(spot.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove spot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Spot Content */}
                <div className="p-4">
                  {spot.is_occupied && spot.project ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-14 h-8 bg-gray-900 rounded flex items-center justify-center">
                          <span className="text-white font-mono font-bold text-xs">
                            {spot.project.project_code}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate" title={spot.project.project_name}>
                        {spot.project.project_name}
                      </p>
                      {spot.project.customer_name && (
                        <p className="text-xs text-gray-500 truncate">{spot.project.customer_name}</p>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Clear this spot and remove the project assignment?')) {
                            clearSpotMutation.mutate(spot.id);
                          }
                        }}
                        className="mt-3 w-full px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        Clear Spot
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Ready for staging</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Spot Card */}
            {isAddingSpot && (
              <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-700 mb-3">New Spot</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Code (e.g., A1)"
                    value={newSpotCode}
                    onChange={(e) => setNewSpotCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={newSpotName}
                    onChange={(e) => setNewSpotName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addSpotMutation.mutate()}
                      disabled={addSpotMutation.isPending || !newSpotCode.trim()}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-1"
                    >
                      {addSpotMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingSpot(false);
                        setNewSpotCode('');
                        setNewSpotName('');
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Spot Modal */}
      {editingSpot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Spot</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Spot Code</label>
                <input
                  type="text"
                  value={editingSpot.spot_code}
                  onChange={(e) => setEditingSpot({ ...editingSpot, spot_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Spot Name (optional)</label>
                <input
                  type="text"
                  value={editingSpot.spot_name || ''}
                  onChange={(e) => setEditingSpot({ ...editingSpot, spot_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Near Loading Dock"
                />
              </div>
              {editingSpot.is_occupied && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    This spot is currently occupied. Changes will not affect the assigned project.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingSpot(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateSpotMutation.mutate({
                  id: editingSpot.id,
                  spotCode: editingSpot.spot_code,
                  spotName: editingSpot.spot_name || '',
                })}
                disabled={updateSpotMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {updateSpotMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
