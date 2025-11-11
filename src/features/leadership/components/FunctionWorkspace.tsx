import { useState } from 'react';
import FunctionTabs, { type TabType } from './FunctionTabs';
import InitiativeTableView from './InitiativeTableView';
import AnnualGoalPlanning from './Goals/AnnualGoalPlanning';
import { useFunctionsQuery } from '../hooks/useLeadershipQuery';
import { useInitiativesByFunctionQuery } from '../hooks/useLeadershipQuery';
import InitiativeDetailModal from './InitiativeDetailModal';

interface FunctionWorkspaceProps {
  functionId: string;
}

export default function FunctionWorkspace({ functionId }: FunctionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('initiatives');
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);

  const { data: functions } = useFunctionsQuery();
  const { data: initiatives, isLoading } = useInitiativesByFunctionQuery(functionId);

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
        {activeTab === 'initiatives' && (
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading initiatives...
              </div>
            ) : initiatives && initiatives.length > 0 ? (
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
                  Get started by creating your first initiative for this function
                </p>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => {
                    // TODO: Open create initiative modal
                    alert('Create initiative modal - TODO');
                  }}
                >
                  Create Initiative
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="p-6">
            <AnnualGoalPlanning functionId={functionId} />
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
    </div>
  );
}
