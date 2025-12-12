import { useState } from 'react';
import { Plus, Edit2, Trash2, User, MapPin, Wrench, Mail, Phone } from 'lucide-react';
import { useSalesReps, useDeleteSalesRep, useTerritories } from '../hooks';
import type { SalesRep } from '../types';
import SalesRepEditorModal from './SalesRepEditorModal';

export default function SalesRepsList() {
  const { data: salesReps, isLoading } = useSalesReps();
  const { data: territories } = useTerritories();
  const deleteMutation = useDeleteSalesRep();

  const [showEditor, setShowEditor] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);

  const handleEdit = (rep: SalesRep) => {
    setEditingRep(rep);
    setShowEditor(true);
  };

  const handleDelete = async (rep: SalesRep) => {
    if (!confirm(`Delete sales rep "${rep.name}"? This may affect request assignments.`)) return;
    await deleteMutation.mutateAsync(rep.id);
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingRep(null);
  };

  // Get territory names for display
  const getTerritoryNames = (territoryIds: string[]) => {
    if (!territories) return [];
    return territoryIds
      .map((id) => territories.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => t!.name);
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
          <h3 className="text-lg font-semibold text-gray-900">Sales Representatives</h3>
          <p className="text-sm text-gray-500">
            Sales reps handle assessments and quotes
          </p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Sales Rep
        </button>
      </div>

      {/* List */}
      {salesReps && salesReps.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {salesReps.map((rep) => {
            const territoryNames = getTerritoryNames(rep.territory_ids);
            return (
              <div
                key={rep.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rep.name}</span>
                      {!rep.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                      {rep.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {rep.email}
                        </span>
                      )}
                      {rep.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {rep.phone}
                        </span>
                      )}
                      <span>Max {rep.max_daily_assessments} assessments/day</span>
                    </div>
                    {territoryNames.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {territoryNames.join(', ')}
                        </span>
                      </div>
                    )}
                    {rep.product_skills.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Wrench className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {rep.product_skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {rep.product_skills.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{rep.product_skills.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(rep)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rep)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No sales reps defined yet</p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Add First Sales Rep
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <SalesRepEditorModal
          salesRep={editingRep}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
