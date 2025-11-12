import { useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import FunctionTabs, { type TabType } from './FunctionTabs';
import InitiativeTableView from './InitiativeTableView';
import AnnualPlanTab from './OperatingPlan/AnnualPlanTab';
import QuarterlyPlanTab from './OperatingPlan/QuarterlyPlanTab';
import BonusKPIsTab from './OperatingPlan/BonusKPIsTab';
import OperatingPlanUploadModal from './OperatingPlan/OperatingPlanUploadModal';
import StrategyAndPlanning from './Strategy/StrategyAndPlanning';
import { useFunctionsQuery, useAreasQuery } from '../hooks/useLeadershipQuery';
import { useInitiativesByFunctionQuery } from '../hooks/useLeadershipQuery';
import InitiativeDetailModal from './InitiativeDetailModal';
import AreaManagementModal from './AreaManagementModal';

interface FunctionWorkspaceProps {
  functionId: string;
}

export default function FunctionWorkspace({ functionId }: FunctionWorkspaceProps) {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<TabType>('strategy');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [showUploadModal, setShowUploadModal] = useState(false);
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
        {/* Strategy Tab */}
        {activeTab === 'strategy' && (
          <div className="p-4">
            <StrategyAndPlanning functionId={functionId} />
          </div>
        )}

        {/* Annual Plan Tab */}
        {activeTab === 'annual-plan' && (
          <div className="h-full flex flex-col">
            {/* Year Selector Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Import Plan
                </button>

                <label className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Annual Plan Content */}
            <div className="flex-1 overflow-auto p-6">
              <AnnualPlanTab functionId={functionId} year={selectedYear} />
            </div>
          </div>
        )}

        {/* Quarterly Plan Tab */}
        {activeTab === 'quarterly-plan' && (
          <div className="h-full flex flex-col">
            {/* Year Selector Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Import Plan
                </button>

                <label className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quarterly Plan Content */}
            <div className="flex-1 overflow-auto p-6">
              <QuarterlyPlanTab functionId={functionId} year={selectedYear} />
            </div>
          </div>
        )}

        {/* Initiatives Tab */}
        {activeTab === 'initiatives' && (
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading initiatives...
              </div>
            ) : (
              <>
                {/* Manage Areas Button */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Initiatives</h2>
                  <button
                    onClick={() => setShowAreaManagement(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Manage Areas
                  </button>
                </div>

                {/* Initiatives List */}
                {(areas && areas.length > 0) ? (
                  <InitiativeTableView
                    initiatives={initiatives || []}
                    areas={areas}
                    onInitiativeClick={(id) => setSelectedInitiativeId(id)}
                    onAddInitiativeToArea={(areaId) => {
                      setSelectedAreaIdForCreate(areaId);
                      setIsCreatingInitiative(true);
                    }}
                  />
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No areas created yet
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

        {/* Bonus KPIs Tab */}
        {activeTab === 'bonus-kpis' && (
          <div className="h-full flex flex-col">
            {/* Year Selector Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Import Plan
                </button>

                <label className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bonus KPIs Content */}
            <div className="flex-1 overflow-auto p-6">
              <BonusKPIsTab functionId={functionId} year={selectedYear} />
            </div>
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

      {/* Operating Plan Upload Modal */}
      {showUploadModal && (
        <OperatingPlanUploadModal
          functionId={functionId}
          year={selectedYear}
          onClose={() => setShowUploadModal(false)}
          onImportComplete={() => {
            setShowUploadModal(false);
            // Data will be automatically refreshed by React Query
          }}
        />
      )}
    </div>
  );
}
