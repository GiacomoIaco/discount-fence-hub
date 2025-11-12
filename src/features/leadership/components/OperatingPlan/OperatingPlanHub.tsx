import { useState } from 'react';
import { Calendar, Target, TrendingUp } from 'lucide-react';
import AnnualPlanTab from './AnnualPlanTab';

interface OperatingPlanHubProps {
  functionId: string;
}

type SubTab = 'annual-plan' | 'quarterly-plan' | 'bonus-kpis';

export default function OperatingPlanHub({ functionId }: OperatingPlanHubProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('annual-plan');

  return (
    <div className="h-full flex flex-col">
      {/* Header with Year Selector */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Plans & KPIs</h2>
            <p className="text-sm text-gray-600 mt-1">
              Strategic planning, quarterly execution, and bonus management
            </p>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-3">
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

        {/* Sub-Tabs */}
        <div className="flex gap-1 mt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveSubTab('annual-plan')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'annual-plan'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Target className="w-4 h-4" />
            Annual Plan
          </button>

          <button
            onClick={() => setActiveSubTab('quarterly-plan')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'quarterly-plan'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Quarterly Plan
          </button>

          <button
            onClick={() => setActiveSubTab('bonus-kpis')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeSubTab === 'bonus-kpis'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Annual Bonus KPIs
          </button>
        </div>
      </div>

      {/* Sub-Tab Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {activeSubTab === 'annual-plan' && (
          <div className="p-6">
            <AnnualPlanTab functionId={functionId} year={selectedYear} />
          </div>
        )}

        {activeSubTab === 'quarterly-plan' && (
          <div className="p-6">
            <div className="text-center py-12 text-gray-500">
              Quarterly Plan tab - Coming soon
            </div>
          </div>
        )}

        {activeSubTab === 'bonus-kpis' && (
          <div className="p-6">
            <div className="text-center py-12 text-gray-500">
              Annual Bonus KPIs tab - Coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
