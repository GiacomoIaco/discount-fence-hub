import { useState } from 'react';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import { TerritoryMap } from '../components/TerritoryMap';
import { ExpandableTerritoryCard } from '../components/ExpandableTerritoryCard';
import { TerritoryEditor } from '../components/TerritoryEditor';
import {
  useTerritories,
  useBusinessUnits,
  useSalesReps,
  useCreateTerritory,
  useUpdateTerritory,
  useDeleteTerritory,
  useAssignRep,
  useUnassignRep,
} from '../hooks/useTerritories';
import type { TerritoryWithReps, TerritoryFormData } from '../types/territory.types';

export function TerritoriesPage() {
  const [selectedBusinessUnitId, setSelectedBusinessUnitId] = useState<string>('');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | undefined>();
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);
  const [editingZips, setEditingZips] = useState<string[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Data queries
  const { data: territories = [], isLoading: loadingTerritories } = useTerritories(
    selectedBusinessUnitId || undefined
  );
  const { data: businessUnits = [], isLoading: loadingBUs } = useBusinessUnits();
  const { data: salesReps = [], isLoading: loadingReps } = useSalesReps();

  // Mutations
  const createTerritory = useCreateTerritory();
  const updateTerritory = useUpdateTerritory();
  const deleteTerritory = useDeleteTerritory();
  const assignRep = useAssignRep();
  const unassignRep = useUnassignRep();

  // Loading state
  const isLoading = loadingTerritories || loadingBUs || loadingReps;

  // Get selected territory's zip codes for highlighting
  // When editing, show the editing zips; otherwise show selected territory's zips
  const selectedTerritory = territories.find(t => t.id === selectedTerritoryId);
  const highlightedZips = expandedTerritoryId ? editingZips : (selectedTerritory?.zip_codes || []);

  // Handlers
  const handleNewTerritory = () => {
    setExpandedTerritoryId(null);
    setEditingZips([]);
    setIsEditorOpen(true);
  };

  const handleExpandTerritory = (territoryId: string) => {
    const territory = territories.find(t => t.id === territoryId);
    setExpandedTerritoryId(territoryId);
    setSelectedTerritoryId(territoryId);
    setEditingZips(territory?.zip_codes || []);
  };

  const handleCollapseTerritory = () => {
    setExpandedTerritoryId(null);
    setEditingZips([]);
  };

  const handleSaveTerritory = async (data: TerritoryFormData) => {
    try {
      await createTerritory.mutateAsync(data);
      setIsEditorOpen(false);
    } catch (error) {
      console.error('Failed to save territory:', error);
      alert('Failed to save territory. Please try again.');
    }
  };

  const handleUpdateTerritory = async (territoryId: string, data: TerritoryFormData) => {
    try {
      await updateTerritory.mutateAsync({ ...data, id: territoryId });
      setExpandedTerritoryId(null);
      setEditingZips([]);
    } catch (error) {
      console.error('Failed to update territory:', error);
      alert('Failed to update territory. Please try again.');
      throw error;
    }
  };

  const handleDeleteTerritory = async (id: string) => {
    try {
      await deleteTerritory.mutateAsync(id);
      if (selectedTerritoryId === id) {
        setSelectedTerritoryId(undefined);
      }
    } catch (error) {
      console.error('Failed to delete territory:', error);
      alert('Failed to delete territory. Please try again.');
    }
  };

  const handleAssignRep = async (territoryId: string, repId: string) => {
    try {
      await assignRep.mutateAsync({ territoryId, salesRepId: repId });
    } catch (error) {
      console.error('Failed to assign rep:', error);
    }
  };

  const handleUnassignRep = async (territoryId: string, repId: string) => {
    try {
      await unassignRep.mutateAsync({ territoryId, salesRepId: repId });
    } catch (error) {
      console.error('Failed to unassign rep:', error);
    }
  };

  // Handle zip click on map when editing
  const handleMapZipClick = (zipCode: string) => {
    if (!expandedTerritoryId) return;
    setEditingZips(prev =>
      prev.includes(zipCode)
        ? prev.filter(z => z !== zipCode)
        : [...prev, zipCode]
    );
  };

  // Handle bulk zip selection from lasso draw
  const handleZipsSelected = (zips: string[]) => {
    if (!expandedTerritoryId) return;
    setEditingZips(zips);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MapPin className="text-blue-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Territories</h1>
            <p className="text-sm text-gray-500">
              Define geographic territories and assign sales reps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Business Unit Filter */}
          <select
            value={selectedBusinessUnitId}
            onChange={(e) => setSelectedBusinessUnitId(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Business Units</option>
            {businessUnits.map(bu => (
              <option key={bu.id} value={bu.id}>{bu.name}</option>
            ))}
          </select>

          <button
            onClick={handleNewTerritory}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            New Territory
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Territory List */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <div className="p-4 border-b bg-white">
            <div className="text-sm text-gray-600">
              {territories.length} {territories.length === 1 ? 'territory' : 'territories'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : territories.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500">No territories yet</p>
                <button
                  onClick={handleNewTerritory}
                  className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Create your first territory
                </button>
              </div>
            ) : (
              territories.map(territory => (
                <ExpandableTerritoryCard
                  key={territory.id}
                  territory={territory}
                  isSelected={territory.id === selectedTerritoryId}
                  isExpanded={territory.id === expandedTerritoryId}
                  salesReps={salesReps}
                  businessUnits={businessUnits}
                  onSelect={() => {
                    if (expandedTerritoryId !== territory.id) {
                      setSelectedTerritoryId(
                        territory.id === selectedTerritoryId ? undefined : territory.id
                      );
                    }
                  }}
                  onExpand={() => handleExpandTerritory(territory.id)}
                  onCollapse={handleCollapseTerritory}
                  onSave={(data) => handleUpdateTerritory(territory.id, data)}
                  onDelete={() => handleDeleteTerritory(territory.id)}
                  onAssignRep={(repId) => handleAssignRep(territory.id, repId)}
                  onUnassignRep={(repId) => handleUnassignRep(territory.id, repId)}
                  onZipsChange={setEditingZips}
                  externalZips={territory.id === expandedTerritoryId ? editingZips : undefined}
                  isSaving={updateTerritory.isPending}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Map */}
        <div className="flex-1">
          {isLoading ? (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          ) : (
            <TerritoryMap
              territories={territories}
              selectedTerritoryId={selectedTerritoryId}
              selectedZips={highlightedZips}
              isSelectionEnabled={!!expandedTerritoryId}
              onZipClick={handleMapZipClick}
              onZipsSelected={handleZipsSelected}
            />
          )}
        </div>
      </div>

      {/* Editor Modal - only for new territories */}
      <TerritoryEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveTerritory}
        initialData={undefined}
        businessUnits={businessUnits}
        isLoading={createTerritory.isPending}
      />
    </div>
  );
}

export default TerritoriesPage;
