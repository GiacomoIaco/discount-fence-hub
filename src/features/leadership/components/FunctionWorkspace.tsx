import { useState } from 'react';
import { Upload } from 'lucide-react';
import FunctionTabs, { type TabType } from './FunctionTabs';
import InitiativeTimelineTab from './InitiativeTimelineTab';
import AnnualPlanTab from './OperatingPlan/AnnualPlanTab';
import QuarterlyPlanTab from './OperatingPlan/QuarterlyPlanTab';
import BonusKPIsTab from './OperatingPlan/BonusKPIsTab';
import OperatingPlanUploadModal from './OperatingPlan/OperatingPlanUploadModal';
import StrategyAndPlanning from './Strategy/StrategyAndPlanning';
import { useFunctionsQuery } from '../hooks/useLeadershipQuery';
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

  const selectedFunction = functions?.find(f => f.id === functionId);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <FunctionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        functionName={selectedFunction?.name}
        selectedYear={selectedYear}
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
            <InitiativeTimelineTab functionId={functionId} />
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
