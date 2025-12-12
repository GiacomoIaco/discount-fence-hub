import { useState } from 'react';
import { Plus, Edit2, Trash2, MapPin, Building2 } from 'lucide-react';
import { useTerritories, useDeleteTerritory } from '../hooks';
import type { Territory } from '../types';
import TerritoryEditorModal from './TerritoryEditorModal';

export default function TerritoriesList() {
  const { data: territories, isLoading } = useTerritories();
  const deleteMutation = useDeleteTerritory();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);

  const handleEdit = (territory: Territory) => {
    setEditingTerritory(territory);
    setShowEditor(true);
  };

  const handleDelete = async (territory: Territory) => {
    if (!confirm(`Delete territory "${territory.name}"? This may affect assignments.`)) return;
    await deleteMutation.mutateAsync(territory.id);
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingTerritory(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Territories</h3>
          <p className="text-sm text-gray-500">
            Geographic areas for routing and assignment
          </p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Territory
        </button>
      </div>

      {/* List */}
      {territories && territories.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {territories.map((territory) => (
            <div
              key={territory.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{territory.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                      {territory.code}
                    </span>
                    {!territory.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                    {territory.business_unit && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {territory.business_unit.name}
                      </span>
                    )}
                    {territory.zip_codes.length > 0 && (
                      <span>
                        {territory.zip_codes.length} zip code{territory.zip_codes.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(territory)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(territory)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No territories defined yet</p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Create First Territory
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <TerritoryEditorModal
          territory={editingTerritory}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
