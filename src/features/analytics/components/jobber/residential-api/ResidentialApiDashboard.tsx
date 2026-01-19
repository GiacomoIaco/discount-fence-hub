// Residential Division Analytics Dashboard (API-Sourced)
// Uses data synced from Jobber API with CORRECTED cycle times
// Days to Quote = Assessment → First SENT (not drafted)

import { useState } from 'react';
import {
  RefreshCw,
  Database,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ResidentialFilters } from '../residential/ResidentialFilters';
import {
  useApiSyncStatus,
  useApiRawDataCounts,
  triggerManualSync,
} from '../../../hooks/jobber/residential';
import type {
  ResidentialFilters as ResidentialFiltersType,
} from '../../../types/residential';
import { DEFAULT_RESIDENTIAL_FILTERS } from '../../../types/residential';

// Import tab components
import {
  ConversionFunnel,
  SalespersonPerformance,
  SpeedToQuoteAnalysis,
  ProjectSizeAnalysis,
  QuoteOptionsAnalysis,
  AcceptanceTimingAnalysis,
  CycleTimeAnalysis,
  WinRateTrends,
} from './tabs';

type ApiDashboardTab = 'funnel' | 'salespeople' | 'speed' | 'size' | 'options' | 'acceptance' | 'cycletime' | 'trends' | 'sync';

const TAB_LABELS: Record<ApiDashboardTab, string> = {
  funnel: 'Conversion Funnel',
  salespeople: 'Salespeople',
  speed: 'Speed to Quote',
  size: 'Project Size',
  options: 'Quote Options',
  acceptance: 'Acceptance Timing',
  cycletime: 'Cycle Time',
  trends: 'Trends',
  sync: 'Sync Status',
};

export function ResidentialApiDashboard() {
  const [filters, setFilters] = useState<ResidentialFiltersType>(DEFAULT_RESIDENTIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<ApiDashboardTab>('funnel');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Sync status
  const { data: syncStatus, refetch: refetchSyncStatus } = useApiSyncStatus();
  const { data: rawCounts, refetch: refetchRawCounts } = useApiRawDataCounts();

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await triggerManualSync();

      if (result.success) {
        setSyncResult({ success: true, message: 'Sync started. Checking progress...' });

        const pollInterval = setInterval(async () => {
          const status = await refetchSyncStatus();
          const currentStatus = status.data?.last_sync_status;

          if (currentStatus === 'success') {
            clearInterval(pollInterval);
            setIsSyncing(false);
            setSyncResult({ success: true, message: 'Sync completed successfully!' });
            refetchRawCounts();
          } else if (currentStatus === 'failed') {
            clearInterval(pollInterval);
            setIsSyncing(false);
            setSyncResult({
              success: false,
              message: status.data?.last_error || 'Sync failed',
            });
          }
        }, 5000);

        setTimeout(() => {
          clearInterval(pollInterval);
          if (isSyncing) {
            setIsSyncing(false);
            setSyncResult({
              success: false,
              message: 'Sync timed out. Check status later.',
            });
          }
        }, 10 * 60 * 1000);
      } else {
        setSyncResult(result);
        setIsSyncing(false);
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      });
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const hasData = (rawCounts?.opportunities || 0) > 0;

  const tabs: ApiDashboardTab[] = ['funnel', 'salespeople', 'speed', 'size', 'options', 'acceptance', 'cycletime', 'trends', 'sync'];

  return (
    <div className="space-y-6">
      {/* Header with sync status */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">API-Sourced Data</h2>
              <p className="text-sm text-gray-600">
                Synced from Jobber API with corrected cycle times (Assessment → Sent)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-3.5 h-3.5" />
                <span>Last sync: {formatDate(syncStatus?.last_sync_at || null)}</span>
              </div>
              {syncStatus?.last_sync_status === 'success' && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{syncStatus.opportunities_computed?.toLocaleString() || rawCounts?.opportunities?.toLocaleString() || '0'} opportunities</span>
                </div>
              )}
              {syncStatus?.last_sync_status === 'failed' && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Last sync failed</span>
                </div>
              )}
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {syncResult && (
          <div
            className={`mt-3 p-2 rounded text-sm ${
              syncResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {syncResult.success
              ? syncResult.message
              : `Sync failed: ${syncResult.message || 'Unknown error'}`}
          </div>
        )}
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
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* No data message */}
      {!hasData && activeTab !== 'sync' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-medium text-amber-800">No Data Yet</h3>
          <p className="text-sm text-amber-600 mt-1">
            Click "Sync Now" to fetch data from the Jobber API. This may take a few minutes.
          </p>
        </div>
      )}

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'funnel' && hasData && <ConversionFunnel filters={filters} />}
        {activeTab === 'salespeople' && hasData && <SalespersonPerformance filters={filters} />}
        {activeTab === 'speed' && hasData && <SpeedToQuoteAnalysis filters={filters} />}
        {activeTab === 'size' && hasData && <ProjectSizeAnalysis filters={filters} />}
        {activeTab === 'options' && hasData && <QuoteOptionsAnalysis filters={filters} />}
        {activeTab === 'acceptance' && hasData && <AcceptanceTimingAnalysis />}
        {activeTab === 'cycletime' && hasData && <CycleTimeAnalysis filters={filters} />}
        {activeTab === 'trends' && hasData && <WinRateTrends filters={filters} />}
        {activeTab === 'sync' && <SyncStatusTab rawCounts={rawCounts} syncStatus={syncStatus} />}
      </div>
    </div>
  );
}

// =====================
// SYNC STATUS TAB
// =====================

function SyncStatusTab({
  rawCounts,
}: {
  rawCounts?: { quotes: number; jobs: number; requests: number; opportunities: number } | null;
  syncStatus?: { last_sync_at: string | null; last_sync_status: string | null } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Sync Status & Raw Data Counts</h3>
      </div>

      {rawCounts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Quotes Synced</div>
            <div className="text-2xl font-bold text-gray-900">
              {rawCounts.quotes.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Jobs Synced</div>
            <div className="text-2xl font-bold text-gray-900">
              {rawCounts.jobs.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Requests Synced</div>
            <div className="text-2xl font-bold text-gray-900">
              {rawCounts.requests.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Opportunities</div>
            <div className="text-2xl font-bold text-blue-600">
              {rawCounts.opportunities.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-medium text-gray-900 mb-4">About API-Sourced Data</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            This dashboard uses data synced directly from the Jobber API rather than CSV exports.
            The key difference is that cycle times are calculated using the <strong>sent date</strong> instead
            of the drafted date.
          </p>
          <p>
            <strong>Days to Quote</strong> = Assessment Date → First Sent Date (not drafted)
          </p>
          <p>
            <strong>Days to Decision</strong> = First Sent Date → Converted Date
          </p>
          <p>
            This provides more accurate metrics since it measures from when the customer actually
            received the quote, not when it was drafted internally.
          </p>
        </div>
      </div>
    </div>
  );
}

