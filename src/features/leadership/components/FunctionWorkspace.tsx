import { useState } from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import FunctionTabs, { type TabType } from './FunctionTabs';
import InitiativeTableView from './InitiativeTableView';
import AnnualGoalPlanning from './Goals/AnnualGoalPlanning';
import StrategyAndPlanning from './Strategy/StrategyAndPlanning';
import { useFunctionsQuery, useAreasQuery } from '../hooks/useLeadershipQuery';
import { useInitiativesByFunctionQuery } from '../hooks/useLeadershipQuery';
import InitiativeDetailModal from './InitiativeDetailModal';
import AreaManagementModal from './AreaManagementModal';

interface FunctionWorkspaceProps {
  functionId: string;
}

export default function FunctionWorkspace({ functionId }: FunctionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('strategy');
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [isCreatingInitiative, setIsCreatingInitiative] = useState(false);
  const [selectedAreaIdForCreate, setSelectedAreaIdForCreate] = useState<string | null>(null);
  const [showAreaManagement, setShowAreaManagement] = useState(false);

  const { data: functions } = useFunctionsQuery();
  const { data: initiatives, isLoading } = useInitiativesByFunctionQuery(functionId);
  const { data: areas } = useAreasQuery(functionId);

  const selectedFunction = functions?.find(f => f.id === functionId);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <FunctionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        functionName={selectedFunction?.name}
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {activeTab === 'strategy' && (
          <div className="p-4">
            <StrategyAndPlanning functionId={functionId} />
          </div>
        )}

        {activeTab === 'initiatives' && (
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading initiatives...
              </div>
            ) : (
              <>
                {/* Add Initiative and Manage Areas Buttons */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Initiatives</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAreaManagement(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Manage Areas
                    </button>
                    <button
                      onClick={() => {
                        if (!areas || areas.length === 0) {
                          alert('Please create an Area first before adding initiatives.\n\nClick "Manage Areas" to get started.');
                          return;
                        }
                        // Default to first area, or show selector in modal
                        setSelectedAreaIdForCreate(areas[0].id);
                        setIsCreatingInitiative(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New Initiative
                    </button>
                  </div>
                </div>

                {/* Initiatives List */}
                {initiatives && initiatives.length > 0 ? (
                  <InitiativeTableView
                    initiatives={initiatives}
                    onInitiativeClick={(id) => setSelectedInitiativeId(id)}
                  />
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No initiatives yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {!areas || areas.length === 0
                        ? 'Create an Area first to organize your initiatives'
                        : 'Get started by creating your first initiative for this function'}
                    </p>
                    {(!areas || areas.length === 0) ? (
                      <>
                        <p className="text-sm text-gray-500 mb-4">
                          Areas are organizational units within a function (e.g., "Process Improvement", "Cost Reduction")
                        </p>
                        <button
                          onClick={() => setShowAreaManagement(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Create Your First Area
                        </button>
                      </>
                    ) : (
                      <button
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => {
                          setSelectedAreaIdForCreate(areas[0].id);
                          setIsCreatingInitiative(true);
                        }}
                      >
                        Create Initiative
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="p-4">
            <AnnualGoalPlanning functionId={functionId} />
          </div>
        )}
      </div>

      {/* Initiative Detail Modal - View/Edit */}
      {selectedInitiativeId && (
        <InitiativeDetailModal
          initiativeId={selectedInitiativeId}
          onClose={() => setSelectedInitiativeId(null)}
        />
      )}

      {/* Initiative Detail Modal - Create */}
      {isCreatingInitiative && selectedAreaIdForCreate && (
        <InitiativeDetailModal
          areaId={selectedAreaIdForCreate}
          onClose={() => {
            setIsCreatingInitiative(false);
            setSelectedAreaIdForCreate(null);
          }}
        />
      )}

      {/* Area Management Modal */}
      {showAreaManagement && (
        <AreaManagementModal
          functionId={functionId}
          onClose={() => setShowAreaManagement(false)}
        />
      )}
    </div>
  );
}
