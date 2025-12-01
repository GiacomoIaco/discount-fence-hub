import { useState } from 'react';
import { ArrowLeft, Plus, FolderOpen, LayoutGrid, Table } from 'lucide-react';
import { useAreasWithInitiativesQuery, useFunctionQuery } from '../hooks/useLeadershipQuery';
import InitiativeCard from './InitiativeCard';
import InitiativeDetailModal from './InitiativeDetailModal';
import InitiativeTableView from './InitiativeTableView';

interface FunctionViewProps {
  functionId: string;
  onBack: () => void;
}

type ViewMode = 'cards' | 'table';

export default function FunctionView({ functionId, onBack }: FunctionViewProps) {
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [isCreatingInitiative, setIsCreatingInitiative] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const { data: func, isLoading: functionLoading } = useFunctionQuery(functionId);
  const { data: areas, isLoading: areasLoading } = useAreasWithInitiativesQuery(functionId);

  if (functionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading function...</p>
        </div>
      </div>
    );
  }

  if (!func) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Function not found</p>
          <button
            onClick={onBack}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{func.name}</h1>
              {func.description && (
                <p className="text-sm text-gray-600 mt-1">{func.description}</p>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm font-medium">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Table className="w-4 h-4" />
                <span className="text-sm font-medium">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {areasLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading areas and initiatives...</p>
          </div>
        ) : areas && areas.length > 0 ? (
          viewMode === 'table' ? (
            /* Table View */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <InitiativeTableView
                initiatives={areas.flatMap((area) => area.initiatives || [])}
                areas={areas}
                onInitiativeClick={(id) => setSelectedInitiativeId(id)}
                onAddInitiativeToArea={(areaId) => {
                  setSelectedAreaId(areaId);
                  setIsCreatingInitiative(true);
                }}
              />
            </div>
          ) : (
            /* Card View */
            <div className="space-y-8">
              {areas.map((area) => (
                <div key={area.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {/* Area Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{area.name}</h2>
                        {area.description && (
                          <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedAreaId(area.id);
                          setIsCreatingInitiative(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Initiative
                      </button>
                    </div>
                  </div>

                  {/* Initiatives Grid */}
                  <div className="p-6">
                    {area.initiatives && area.initiatives.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {area.initiatives.map((initiative) => (
                          <InitiativeCard
                            key={initiative.id}
                            initiative={initiative}
                            onClick={() => setSelectedInitiativeId(initiative.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No initiatives yet</p>
                        <button
                          onClick={() => {
                            setSelectedAreaId(area.id);
                            setIsCreatingInitiative(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Create your first initiative
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <FolderOpen className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No areas yet</h3>
            <p className="text-gray-600 mb-4">
              This function doesn't have any areas. Create areas in Settings to organize initiatives.
            </p>
          </div>
        )}
      </div>

      {/* Initiative Detail Modal */}
      {selectedInitiativeId && (
        <InitiativeDetailModal
          initiativeId={selectedInitiativeId}
          onClose={() => setSelectedInitiativeId(null)}
        />
      )}

      {/* Create Initiative Modal */}
      {isCreatingInitiative && selectedAreaId && (
        <InitiativeDetailModal
          areaId={selectedAreaId}
          onClose={() => {
            setIsCreatingInitiative(false);
            setSelectedAreaId(null);
          }}
        />
      )}
    </div>
  );
}
