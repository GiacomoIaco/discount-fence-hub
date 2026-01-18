// Residential Division Analytics Dashboard
// Conversion/win rate focused with 8 tabs + salesperson detail subpage

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { SalespersonDetailPage } from './SalespersonDetailPage';
import { ResidentialFilters } from './ResidentialFilters';
import { ConversionFunnel } from './tabs/ConversionFunnel';
import { SalespersonPerformance } from './tabs/SalespersonPerformance';
import { ProjectSizeAnalysis } from './tabs/ProjectSizeAnalysis';
import { SpeedToQuoteAnalysis } from './tabs/SpeedToQuoteAnalysis';
import { QuoteOptionsAnalysis } from './tabs/QuoteOptionsAnalysis';
import { WinRateTrends } from './tabs/WinRateTrends';
import { CycleTimeAnalysis } from './tabs/CycleTimeAnalysis';
import { AcceptanceTimingAnalysis } from './tabs/AcceptanceTimingAnalysis';
import { ResidentialUploadModal } from './ResidentialUploadModal';
import { useResidentialOpportunityCount } from '../../../hooks/jobber/residential';
import type {
  ResidentialFilters as ResidentialFiltersType,
  ResidentialDashboardTab,
} from '../../../types/residential';
import { DEFAULT_RESIDENTIAL_FILTERS, RESIDENTIAL_TAB_LABELS } from '../../../types/residential';

export function ResidentialDashboard() {
  const [filters, setFilters] = useState<ResidentialFiltersType>(DEFAULT_RESIDENTIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<ResidentialDashboardTab>('funnel');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);

  const { data: totalOpps } = useResidentialOpportunityCount();

  // Show salesperson detail page if one is selected
  if (selectedSalesperson) {
    return (
      <SalespersonDetailPage
        salesperson={selectedSalesperson}
        onBack={() => setSelectedSalesperson(null)}
      />
    );
  }

  const tabs: ResidentialDashboardTab[] = [
    'funnel',
    'salespeople',
    'size',
    'speed',
    'options',
    'trends',
    'cycletime',
    'acceptance',
  ];

  return (
    <div className="space-y-6">
      {/* Header with stats and upload button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{totalOpps?.toLocaleString() || 0}</span>
            {' '}opportunities in database
          </div>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          <Upload className="w-4 h-4" />
          Upload CSV Files
        </button>
      </div>

      {/* Filters */}
      <ResidentialFilters filters={filters} onChange={setFilters} />

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {RESIDENTIAL_TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'funnel' && <ConversionFunnel filters={filters} />}
        {activeTab === 'salespeople' && (
          <SalespersonPerformance
            filters={filters}
            onSelectSalesperson={setSelectedSalesperson}
          />
        )}
        {activeTab === 'size' && <ProjectSizeAnalysis filters={filters} />}
        {activeTab === 'speed' && <SpeedToQuoteAnalysis filters={filters} />}
        {activeTab === 'options' && <QuoteOptionsAnalysis filters={filters} />}
        {activeTab === 'trends' && <WinRateTrends filters={filters} />}
        {activeTab === 'cycletime' && <CycleTimeAnalysis filters={filters} />}
        {activeTab === 'acceptance' && <AcceptanceTimingAnalysis />}
      </div>

      {/* Upload Modal */}
      <ResidentialUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}
