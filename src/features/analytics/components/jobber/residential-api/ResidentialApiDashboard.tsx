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
  TrendingUp,
  Zap,
  Calendar,
  BarChart3,
  PieChart,
  LineChart,
  Timer,
} from 'lucide-react';
import { ResidentialFilters } from '../residential/ResidentialFilters';
import {
  useApiSyncStatus,
  useApiResidentialFunnelMetrics,
  useApiResidentialSalespersonMetrics,
  useApiResidentialSpeedMetrics,
  useApiResidentialBucketMetrics,
  useApiResidentialQuoteCountMetrics,
  useApiResidentialCycleBreakdown,
  useApiResidentialTrends,
  useApiRawDataCounts,
  triggerManualSync,
} from '../../../hooks/jobber/residential';
import type {
  ResidentialFilters as ResidentialFiltersType,
} from '../../../types/residential';
import { DEFAULT_RESIDENTIAL_FILTERS } from '../../../types/residential';

type ApiDashboardTab = 'funnel' | 'salespeople' | 'speed' | 'size' | 'options' | 'cycletime' | 'trends' | 'sync';

const TAB_LABELS: Record<ApiDashboardTab, string> = {
  funnel: 'Conversion Funnel',
  salespeople: 'Salespeople',
  speed: 'Speed to Quote',
  size: 'Project Size',
  options: 'Quote Options',
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

  const tabs: ApiDashboardTab[] = ['funnel', 'salespeople', 'speed', 'size', 'options', 'cycletime', 'trends', 'sync'];

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
        {activeTab === 'funnel' && hasData && <FunnelTab filters={filters} />}
        {activeTab === 'salespeople' && hasData && <SalespeopleTab filters={filters} />}
        {activeTab === 'speed' && hasData && <SpeedTab filters={filters} />}
        {activeTab === 'size' && hasData && <SizeTab filters={filters} />}
        {activeTab === 'options' && hasData && <OptionsTab filters={filters} />}
        {activeTab === 'cycletime' && hasData && <CycleTimeTab filters={filters} />}
        {activeTab === 'trends' && hasData && <TrendsTab filters={filters} />}
        {activeTab === 'sync' && <SyncStatusTab rawCounts={rawCounts} syncStatus={syncStatus} />}
      </div>
    </div>
  );
}

// =====================
// TAB COMPONENTS
// =====================

function FunnelTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: metrics, isLoading } = useApiResidentialFunnelMetrics(filters);

  if (isLoading) {
    return <LoadingGrid count={8} />;
  }

  if (!metrics) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
          label="Total Opportunities"
          value={metrics.total_opportunities?.toLocaleString() || '0'}
        />
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Won"
          value={metrics.won_opportunities?.toLocaleString() || '0'}
          subtext={`${metrics.lost_opportunities?.toLocaleString() || '0'} lost, ${metrics.pending_opportunities?.toLocaleString() || '0'} pending`}
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          label="Win Rate"
          value={`${metrics.win_rate || 0}%`}
          subtext={`Closed: ${metrics.closed_win_rate || 0}%`}
          highlight={true}
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="Won Value"
          value={`$${((metrics.won_value || 0) / 1000000).toFixed(2)}M`}
          subtext={`Value Win Rate: ${metrics.value_win_rate || 0}%`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Zap className="w-5 h-5 text-amber-600" />}
          label="Same-Day Quote %"
          value={`${metrics.same_day_quote_pct || 0}%`}
        />
        <MetricCard
          icon={<PieChart className="w-5 h-5 text-purple-600" />}
          label="Multi-Quote %"
          value={`${metrics.multi_quote_pct || 0}%`}
        />
        <MetricCard
          icon={<Timer className="w-5 h-5 text-indigo-600" />}
          label="Avg Days to Quote"
          value={`${metrics.avg_days_to_quote?.toFixed(1) || '-'}`}
        />
        <MetricCard
          icon={<Timer className="w-5 h-5 text-pink-600" />}
          label="Avg Days to Decision"
          value={`${metrics.avg_days_to_decision?.toFixed(1) || '-'}`}
        />
      </div>
    </div>
  );
}

function SalespeopleTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: metrics, isLoading } = useApiResidentialSalespersonMetrics(filters);

  if (isLoading) {
    return <LoadingGrid count={4} />;
  }

  if (!metrics || metrics.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Salesperson</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Opps</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Win Rate</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Closed Win</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won Value</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Deal</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Same-Day %</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((sp, idx) => (
              <tr key={sp.salesperson} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 px-4 font-medium">{sp.salesperson}</td>
                <td className="text-right py-3 px-4">{sp.total_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-green-600">{sp.won_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4">{sp.win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4 font-semibold text-blue-600">{sp.closed_win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4">${(sp.won_value / 1000).toFixed(0)}K</td>
                <td className="text-right py-3 px-4">${sp.avg_won_value?.toLocaleString() || '-'}</td>
                <td className="text-right py-3 px-4">{sp.same_day_pct?.toFixed(1) || '-'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpeedTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: speedMetrics, isLoading } = useApiResidentialSpeedMetrics(filters);

  if (isLoading) {
    return <LoadingGrid count={4} />;
  }

  if (!speedMetrics || speedMetrics.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">Speed to Quote Impact</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {speedMetrics.map((bucket) => (
          <div
            key={bucket.speed_bucket}
            className={`p-4 rounded-lg border ${
              bucket.speed_bucket === 'Same day'
                ? 'bg-green-50 border-green-200'
                : bucket.speed_bucket === '8+ days'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50'
            }`}
          >
            <div className="text-sm font-medium text-gray-700">{bucket.speed_bucket}</div>
            <div className="text-2xl font-bold mt-1">{bucket.closed_win_rate?.toFixed(1) || 0}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {bucket.won_opps?.toLocaleString() || 0} / {bucket.total_opps?.toLocaleString() || 0} won
            </div>
            {bucket.baseline_diff !== null && bucket.baseline_diff !== undefined && (
              <div
                className={`text-xs mt-1 ${
                  bucket.baseline_diff > 0 ? 'text-green-600' : bucket.baseline_diff < 0 ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {bucket.baseline_diff > 0 ? '+' : ''}
                {bucket.baseline_diff.toFixed(1)}% vs avg
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SizeTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: bucketMetrics, isLoading } = useApiResidentialBucketMetrics(filters);

  if (isLoading) {
    return <LoadingGrid count={7} />;
  }

  if (!bucketMetrics || bucketMetrics.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Project Size Analysis</h3>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Size Bucket</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Total Opps</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Win Rate</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Closed Win</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won Value</th>
            </tr>
          </thead>
          <tbody>
            {bucketMetrics.map((bucket, idx) => (
              <tr key={bucket.revenue_bucket} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 px-4 font-medium">{bucket.revenue_bucket}</td>
                <td className="text-right py-3 px-4">{bucket.total_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-green-600">{bucket.won_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4">{bucket.win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4 font-semibold text-blue-600">{bucket.closed_win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4">${(bucket.won_value / 1000).toFixed(0)}K</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OptionsTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: quoteCountMetrics, isLoading } = useApiResidentialQuoteCountMetrics(filters);

  if (isLoading) {
    return <LoadingGrid count={4} />;
  }

  if (!quoteCountMetrics || quoteCountMetrics.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">Quote Options Analysis</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quoteCountMetrics.map((bucket) => (
          <div key={bucket.quote_count_bucket} className="p-4 rounded-lg bg-gray-50 border">
            <div className="text-sm font-medium text-gray-700">{bucket.quote_count_bucket}</div>
            <div className="text-2xl font-bold mt-1">{bucket.closed_win_rate?.toFixed(1) || 0}%</div>
            <div className="text-xs text-gray-500 mt-1">
              {bucket.won_opps?.toLocaleString() || 0} / {bucket.total_opps?.toLocaleString() || 0} won
            </div>
            {bucket.avg_days_to_decision !== null && bucket.avg_days_to_decision !== undefined && (
              <div className="text-xs text-blue-600 mt-1">
                Avg {bucket.avg_days_to_decision.toFixed(0)} days to decision
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CycleTimeTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: cycleBreakdown, isLoading } = useApiResidentialCycleBreakdown(filters);

  if (isLoading) {
    return <LoadingGrid count={5} />;
  }

  if (!cycleBreakdown || cycleBreakdown.length === 0) {
    return <NoDataMessage message="No cycle time data available. Need assessment dates linked to quotes." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-900">
          Cycle Time Breakdown
          <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
            CORRECTED: Using Sent Date
          </span>
        </h3>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Stage</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Days</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Median</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">P25</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">P75</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Range</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Sample</th>
            </tr>
          </thead>
          <tbody>
            {cycleBreakdown.map((row) => (
              <tr key={row.stage} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{row.stage}</td>
                <td className="text-right py-3 px-4 font-semibold text-blue-600">
                  {row.avg_days?.toFixed(1) || '-'}
                </td>
                <td className="text-right py-3 px-4">{row.median_days?.toFixed(1) || '-'}</td>
                <td className="text-right py-3 px-4 text-gray-500">{row.p25_days?.toFixed(0) || '-'}</td>
                <td className="text-right py-3 px-4 text-gray-500">{row.p75_days?.toFixed(0) || '-'}</td>
                <td className="text-right py-3 px-4 text-gray-400 text-xs">
                  {row.min_days ?? '-'} - {row.max_days ?? '-'}
                </td>
                <td className="text-right py-3 px-4 text-gray-500">
                  {row.sample_size?.toLocaleString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendsTab({ filters }: { filters: ResidentialFiltersType }) {
  const { data: trends, isLoading } = useApiResidentialTrends(13, filters.salesperson || undefined, filters.revenueBucket || undefined);

  if (isLoading) {
    return <LoadingGrid count={6} />;
  }

  if (!trends || trends.length === 0) {
    return <NoDataMessage />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <LineChart className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900">Monthly Trends (Last 13 Months)</h3>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-600">Month</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Opps</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Lost</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Win Rate</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Closed Win</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Won Value</th>
              <th className="text-right py-3 px-4 font-medium text-gray-600">Value Win %</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((row, idx) => (
              <tr key={row.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 px-4 font-medium">{row.month_label}</td>
                <td className="text-right py-3 px-4">{row.total_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-green-600">{row.won_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4 text-red-600">{row.lost_opps?.toLocaleString()}</td>
                <td className="text-right py-3 px-4">{row.win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4 font-semibold text-blue-600">{row.closed_win_rate?.toFixed(1)}%</td>
                <td className="text-right py-3 px-4">${(row.won_value / 1000).toFixed(0)}K</td>
                <td className="text-right py-3 px-4">{row.value_win_rate?.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

// =====================
// HELPER COMPONENTS
// =====================

function MetricCard({
  icon,
  label,
  value,
  subtext,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg border p-4 ${highlight ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

function LoadingGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

function NoDataMessage({ message }: { message?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
      {message || 'No data available for the selected filters.'}
    </div>
  );
}
