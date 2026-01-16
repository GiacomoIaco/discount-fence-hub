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
  Users,
  Zap,
  Calendar,
} from 'lucide-react';
import { ResidentialFilters } from '../residential/ResidentialFilters';
import {
  useApiSyncStatus,
  useApiResidentialFunnelMetrics,
  useApiResidentialSpeedMetrics,
  useApiResidentialQuoteCountMetrics,
  useApiResidentialCycleBreakdown,
  useApiRawDataCounts,
  triggerManualSync,
} from '../../../hooks/jobber/residential';
import type {
  ResidentialFilters as ResidentialFiltersType,
} from '../../../types/residential';
import { DEFAULT_RESIDENTIAL_FILTERS } from '../../../types/residential';

export function ResidentialApiDashboard() {
  const [filters, setFilters] = useState<ResidentialFiltersType>(DEFAULT_RESIDENTIAL_FILTERS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message?: string } | null>(null);

  // Sync status
  const { data: syncStatus, refetch: refetchSyncStatus } = useApiSyncStatus();
  const { data: rawCounts, refetch: refetchRawCounts } = useApiRawDataCounts();

  // Metrics
  const { data: funnelMetrics, isLoading: loadingFunnel } = useApiResidentialFunnelMetrics(filters);
  const { data: speedMetrics, isLoading: loadingSpeed } = useApiResidentialSpeedMetrics(filters);
  const { data: quoteCountMetrics, isLoading: loadingQuoteCount } = useApiResidentialQuoteCountMetrics(filters);
  const { data: cycleBreakdown, isLoading: loadingCycle } = useApiResidentialCycleBreakdown(filters);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const result = await triggerManualSync();
      setSyncResult(result);

      // Refresh data after sync
      if (result.success) {
        refetchSyncStatus();
        refetchRawCounts();
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const isLoading = loadingFunnel || loadingSpeed || loadingQuoteCount || loadingCycle;
  const hasData = (rawCounts?.opportunities || 0) > 0;

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
                  <span>{syncStatus.opportunities_computed.toLocaleString()} opportunities</span>
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

        {/* Sync result message */}
        {syncResult && (
          <div
            className={`mt-3 p-2 rounded text-sm ${
              syncResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {syncResult.success
              ? `Sync completed successfully!`
              : `Sync failed: ${syncResult.message || 'Unknown error'}`}
          </div>
        )}
      </div>

      {/* Raw data counts */}
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

      {/* Filters */}
      <ResidentialFilters filters={filters} onChange={setFilters} />

      {/* No data message */}
      {!hasData && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-medium text-amber-800">No Data Yet</h3>
          <p className="text-sm text-amber-600 mt-1">
            Click "Sync Now" to fetch data from the Jobber API. This may take a few minutes.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      {hasData && (
        <div className="space-y-6">
          {/* Funnel Metrics */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Conversion Funnel</h3>
            </div>

            {loadingFunnel ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ) : funnelMetrics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <MetricCard
                  label="Total Opportunities"
                  value={funnelMetrics.total_opportunities?.toLocaleString() || '0'}
                />
                <MetricCard
                  label="Won"
                  value={funnelMetrics.won_opportunities?.toLocaleString() || '0'}
                  color="green"
                />
                <MetricCard
                  label="Win Rate"
                  value={`${funnelMetrics.win_rate || 0}%`}
                  color="blue"
                />
                <MetricCard
                  label="Won Value"
                  value={`$${((funnelMetrics.won_value || 0) / 1000000).toFixed(2)}M`}
                  color="emerald"
                />
                <MetricCard
                  label="Same-Day Quote %"
                  value={`${funnelMetrics.same_day_quote_pct || 0}%`}
                />
                <MetricCard
                  label="Multi-Quote %"
                  value={`${funnelMetrics.multi_quote_pct || 0}%`}
                />
              </div>
            ) : null}
          </div>

          {/* Cycle Time Breakdown - KEY DIFFERENTIATOR */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">
                Cycle Time Breakdown
                <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  CORRECTED: Using Sent Date
                </span>
              </h3>
            </div>

            {loadingCycle ? (
              <div className="animate-pulse h-48 bg-gray-200 rounded"></div>
            ) : cycleBreakdown && cycleBreakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Stage</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Avg Days</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Median</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">P25</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">P75</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Range</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycleBreakdown.map((row) => (
                      <tr key={row.stage} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{row.stage}</td>
                        <td className="text-right py-2 px-3 font-semibold text-blue-600">
                          {row.avg_days?.toFixed(1) || '-'}
                        </td>
                        <td className="text-right py-2 px-3">{row.median_days?.toFixed(1) || '-'}</td>
                        <td className="text-right py-2 px-3 text-gray-500">{row.p25_days?.toFixed(0) || '-'}</td>
                        <td className="text-right py-2 px-3 text-gray-500">{row.p75_days?.toFixed(0) || '-'}</td>
                        <td className="text-right py-2 px-3 text-gray-400 text-xs">
                          {row.min_days ?? '-'} - {row.max_days ?? '-'}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-500">
                          {row.sample_size?.toLocaleString() || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No cycle time data available. Need assessment dates linked to quotes.
              </div>
            )}
          </div>

          {/* Speed to Quote Impact */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Speed to Quote Impact</h3>
            </div>

            {loadingSpeed ? (
              <div className="animate-pulse h-32 bg-gray-200 rounded"></div>
            ) : speedMetrics && speedMetrics.length > 0 ? (
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
                    <div className="text-2xl font-bold mt-1">
                      {bucket.win_rate?.toFixed(1) || 0}%
                    </div>
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
            ) : (
              <div className="text-center text-gray-500 py-8">
                No speed metrics available.
              </div>
            )}
          </div>

          {/* Quote Count Impact */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Quote Count Impact</h3>
            </div>

            {loadingQuoteCount ? (
              <div className="animate-pulse h-32 bg-gray-200 rounded"></div>
            ) : quoteCountMetrics && quoteCountMetrics.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quoteCountMetrics.map((bucket) => (
                  <div key={bucket.quote_count_bucket} className="p-4 rounded-lg bg-gray-50 border">
                    <div className="text-sm font-medium text-gray-700">{bucket.quote_count_bucket}</div>
                    <div className="text-2xl font-bold mt-1">{bucket.win_rate?.toFixed(1) || 0}%</div>
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
            ) : (
              <div className="text-center text-gray-500 py-8">
                No quote count metrics available.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for metric cards
function MetricCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string;
  color?: 'gray' | 'green' | 'blue' | 'emerald' | 'red';
}) {
  const colorClasses = {
    gray: 'text-gray-900',
    green: 'text-green-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}
