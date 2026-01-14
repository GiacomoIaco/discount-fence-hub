// Main Jobber Data Tab container

import { useState } from 'react';
import { Upload, Building2, Home, ArrowLeft } from 'lucide-react';
import { JobberFiltersBar } from './JobberFilters';
import { JobberUploadModal } from './JobberUploadModal';
import { ExecutiveSummaryCards } from './dashboard/ExecutiveSummaryCards';
import { MonthlyTrendChart } from './dashboard/MonthlyTrendChart';
import { SalespersonLeaderboard } from './dashboard/SalespersonLeaderboard';
import { LocationAnalysis } from './dashboard/LocationAnalysis';
import { ProjectTypeBreakdown } from './dashboard/ProjectTypeBreakdown';
import { ClientAnalysis } from './dashboard/ClientAnalysis';
import { CommunityAnalysis } from './dashboard/CommunityAnalysis';
import { QuotePipeline } from './dashboard/QuotePipeline';
import { CycleTimeAnalysis } from './dashboard/CycleTimeAnalysis';
import { DayOfWeekPatterns } from './dashboard/DayOfWeekPatterns';
import { CrewPerformance } from './dashboard/CrewPerformance';
import { OpenPipelineTracker } from './dashboard/OpenPipelineTracker';
import { QBOSyncStatus } from './dashboard/QBOSyncStatus';
import { useImportStats } from '../../hooks/jobber';
import { useSalespersonDetail } from '../../hooks/jobber/useSalespersonMetrics';
import { useClientDetail } from '../../hooks/jobber/useClientMetrics';
import type { JobberFilters, JobberDashboardTab } from '../../types/jobber';

type BusinessUnit = 'builder' | 'residential';

export function JobberDataTab() {
  // State
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit>('builder');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<JobberDashboardTab>('overview');
  const [filters, setFilters] = useState<JobberFilters>({
    dateRange: { start: null, end: null },
    salesperson: null,
    location: null,
    includeWarranties: false,
  });
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Data
  const { data: importStats } = useImportStats(businessUnit);
  const { data: salespersonDetail } = useSalespersonDetail(selectedSalesperson);
  const { data: clientDetail } = useClientDetail(selectedClient);

  // Dashboard tabs
  const tabs: { id: JobberDashboardTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'salespeople', label: 'Salespeople' },
    { id: 'clients', label: 'Clients' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'cycletime', label: 'Cycle Time' },
  ];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle drill-down views
  if (selectedSalesperson && salespersonDetail) {
    return (
      <SalespersonDetailView
        data={salespersonDetail}
        onBack={() => setSelectedSalesperson(null)}
        filters={filters}
      />
    );
  }

  if (selectedClient && clientDetail) {
    return (
      <ClientDetailView
        data={clientDetail}
        onBack={() => setSelectedClient(null)}
        filters={filters}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Business Unit Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setBusinessUnit('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              businessUnit === 'builder'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Builder Division
          </button>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            <Home className="w-4 h-4" />
            Residential
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Coming Soon</span>
          </button>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          <Upload className="w-4 h-4" />
          Upload CSV
        </button>
      </div>

      {/* Import Stats */}
      {importStats && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm">
          <div>
            <span className="text-gray-500">Jobs:</span>
            <span className="ml-2 font-medium">{importStats.totalJobs.toLocaleString()} records</span>
            {importStats.lastJobsImport && (
              <span className="text-gray-400 ml-1">
                (Last: {formatDate(importStats.lastJobsImport.uploaded_at)})
              </span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Quotes:</span>
            <span className="ml-2 font-medium">{importStats.totalQuotes.toLocaleString()} records</span>
            {importStats.lastQuotesImport && (
              <span className="text-gray-400 ml-1">
                (Last: {formatDate(importStats.lastQuotesImport.uploaded_at)})
              </span>
            )}
          </div>
          <div>
            <span className="text-gray-500">Invoices:</span>
            <span className="ml-2 font-medium">{importStats.totalInvoices.toLocaleString()} records</span>
            {importStats.lastInvoicesImport && (
              <span className="text-gray-400 ml-1">
                (Last: {formatDate(importStats.lastInvoicesImport.uploaded_at)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <JobberFiltersBar filters={filters} onChange={setFilters} />

      {/* Dashboard Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDashboardTab(tab.id)}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                dashboardTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Content */}
      <div className="space-y-6">
        {dashboardTab === 'overview' && (
          <>
            <ExecutiveSummaryCards filters={filters} />
            <MonthlyTrendChart filters={filters} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LocationAnalysis
                filters={filters}
                onSelectLocation={(loc) => setFilters({ ...filters, location: loc })}
              />
              <ProjectTypeBreakdown filters={filters} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OpenPipelineTracker filters={filters} />
              <QBOSyncStatus filters={filters} />
            </div>
          </>
        )}

        {dashboardTab === 'salespeople' && (
          <>
            <SalespersonLeaderboard
              filters={filters}
              onSelectSalesperson={setSelectedSalesperson}
            />
          </>
        )}

        {dashboardTab === 'clients' && (
          <>
            <ClientAnalysis
              filters={filters}
              onSelectClient={setSelectedClient}
            />
            <CommunityAnalysis filters={filters} />
          </>
        )}

        {dashboardTab === 'pipeline' && (
          <>
            <QuotePipeline filters={filters} />
          </>
        )}

        {dashboardTab === 'cycletime' && (
          <>
            <CycleTimeAnalysis filters={filters} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DayOfWeekPatterns filters={filters} />
              <CrewPerformance filters={filters} />
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      <JobberUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
}

// Salesperson Detail View
function SalespersonDetailView({
  data,
  onBack,
  filters: _filters,
}: {
  data: NonNullable<ReturnType<typeof useSalespersonDetail>['data']>;
  onBack: () => void;
  filters: JobberFilters;
}) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const totalRevenue = data.jobs.reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);
  const billableJobs = data.jobs.filter(j => j.is_substantial).length;
  const warrantyJobs = data.jobs.filter(j => j.is_warranty).length;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{data.salesperson}</h2>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600">Total Revenue</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Total Jobs</div>
            <div className="text-2xl font-bold text-blue-700">{data.jobs.length}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600">Billable Jobs</div>
            <div className="text-2xl font-bold text-purple-700">{billableJobs}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600">Warranty</div>
            <div className="text-2xl font-bold text-orange-700">{warrantyJobs}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Top 10 Clients</h3>
            <div className="space-y-2">
              {data.topClients.map((client, i) => (
                <div key={client.name} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{i + 1}. {client.name}</span>
                  <span className="font-medium text-green-700">{formatCurrency(client.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">Top 10 Communities</h3>
            <div className="space-y-2">
              {data.topCommunities.map((comm, i) => (
                <div key={comm.name} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{i + 1}. {comm.name}</span>
                  <span className="font-medium text-green-700">{formatCurrency(comm.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client Detail View
function ClientDetailView({
  data,
  onBack,
  filters: _filters,
}: {
  data: NonNullable<ReturnType<typeof useClientDetail>['data']>;
  onBack: () => void;
  filters: JobberFilters;
}) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Client List
      </button>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{data.clientName}</h2>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600">Total Revenue</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(data.totalRevenue)}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600">Total Jobs</div>
            <div className="text-2xl font-bold text-blue-700">{data.totalJobs}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-purple-600">Quotes</div>
            <div className="text-2xl font-bold text-purple-700">{data.quotes.length}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-orange-600">Warranty</div>
            <div className="text-2xl font-bold text-orange-700">{data.warrantyJobs}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Top Communities</h3>
            <div className="space-y-2">
              {data.topCommunities.map((comm, i) => (
                <div key={comm.name} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{i + 1}. {comm.name}</span>
                  <span className="font-medium text-green-700">{formatCurrency(comm.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">Salesperson Breakdown</h3>
            <div className="space-y-2">
              {data.salespersonBreakdown.map((sp) => (
                <div key={sp.name} className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>{sp.name}</span>
                  <span className="font-medium">{sp.jobs} jobs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
