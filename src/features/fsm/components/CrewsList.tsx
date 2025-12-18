import { useState } from 'react';
import { Plus, Edit2, Trash2, Users, MapPin, Wrench, UserCircle, Phone, ChevronRight } from 'lucide-react';
import { useCrews, useDeleteCrew } from '../hooks';
import type { Crew } from '../types';
import { CREW_TYPE_LABELS } from '../types';
import CrewEditorModal from './CrewEditorModal';

type FilterMode = 'all' | 'internal' | 'subcontractor';

export default function CrewsList() {
  const { data: crews, isLoading } = useCrews();
  const deleteMutation = useDeleteCrew();

  const [showEditor, setShowEditor] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const handleEdit = (crew: Crew) => {
    setEditingCrew(crew);
    setShowEditor(true);
  };

  const handleDelete = async (crew: Crew) => {
    if (!confirm(`Delete crew "${crew.name}"? This may affect job assignments.`)) return;
    await deleteMutation.mutateAsync(crew.id);
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingCrew(null);
  };

  // Filter crews based on mode
  const filteredCrews = crews?.filter((crew) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'internal') return !crew.is_subcontractor;
    if (filterMode === 'subcontractor') return crew.is_subcontractor;
    return true;
  });

  // Counts for filter badges
  const internalCount = crews?.filter((c) => !c.is_subcontractor).length || 0;
  const subCount = crews?.filter((c) => c.is_subcontractor).length || 0;

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
          <h3 className="text-lg font-semibold text-gray-900">Crews & Subcontractors</h3>
          <p className="text-sm text-gray-500">
            Internal crews and external subcontractors
          </p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Crew
        </button>
      </div>

      {/* Filter Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterMode('all')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filterMode === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All ({crews?.length || 0})
        </button>
        <button
          onClick={() => setFilterMode('internal')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filterMode === 'internal'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Internal ({internalCount})
          </span>
        </button>
        <button
          onClick={() => setFilterMode('subcontractor')}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filterMode === 'subcontractor'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Subcontractors ({subCount})
          </span>
        </button>
      </div>

      {/* List */}
      {filteredCrews && filteredCrews.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {filteredCrews.map((crew) => (
            <div
              key={crew.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  crew.is_subcontractor
                    ? 'bg-blue-100'
                    : 'bg-amber-100'
                }`}>
                  {crew.is_subcontractor ? (
                    <Wrench className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Users className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{crew.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                      {crew.code}
                    </span>
                    {crew.is_subcontractor ? (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Sub
                      </span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        crew.crew_type === 'internal'
                          ? 'bg-purple-100 text-purple-700'
                          : crew.crew_type === 'small_jobs'
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {CREW_TYPE_LABELS[crew.crew_type] || 'Standard'}
                      </span>
                    )}
                    {!crew.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 mt-0.5">
                    {crew.is_subcontractor ? (
                      <>
                        {crew.lead_phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {crew.lead_phone}
                          </span>
                        )}
                        {crew.lead_name && (
                          <span className="flex items-center gap-1">
                            <UserCircle className="w-3.5 h-3.5" />
                            {crew.lead_name}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {crew.crew_size} members
                        </span>
                        <span>{crew.max_daily_lf} LF/day</span>
                        {crew.lead_user && (
                          <span className="flex items-center gap-1">
                            <UserCircle className="w-3.5 h-3.5" />
                            {crew.lead_user.full_name || crew.lead_user.email}
                          </span>
                        )}
                      </>
                    )}
                    {crew.territory && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {crew.territory.name}
                      </span>
                    )}
                  </div>
                  {crew.product_skills.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Wrench className="w-3.5 h-3.5 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {crew.product_skills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {crew.product_skills.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{crew.product_skills.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEdit(crew)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(crew)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="View Details"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          {filterMode === 'all' ? (
            <>
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No crews defined yet</p>
              <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                Create First Crew
              </button>
            </>
          ) : (
            <>
              {filterMode === 'internal' ? (
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              ) : (
                <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              )}
              <p className="text-gray-500 mb-4">
                No {filterMode === 'internal' ? 'internal crews' : 'subcontractors'} found
              </p>
              <button
                onClick={() => setFilterMode('all')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Show All
              </button>
            </>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <CrewEditorModal
          crew={editingCrew}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
