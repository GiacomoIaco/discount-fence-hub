// Conversion Funnel Tab - Core metrics and funnel visualization
// Shows: Opportunities, Won/Lost/Pending, Win%, Won$, Value Win%, Avg Days

import { useState } from 'react';
import { TrendingUp, CheckCircle, XCircle, Clock, DollarSign, Percent, Timer, BarChart3 } from 'lucide-react';
import { useResidentialFunnelMetrics, useResidentialEnhancedMonthlyTotals } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, MonthlyTotals } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface ConversionFunnelProps {
  filters: ResidentialFilters;
}

type ViewMode = 'count' | 'value';

export function ConversionFunnel({ filters }: ConversionFunnelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('count');
  const { data: metrics, isLoading } = useResidentialFunnelMetrics(filters);
  const { data: monthlyData } = useResidentialEnhancedMonthlyTotals(13, filters.revenueBucket || undefined);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No data available. Upload Residential CSV files to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Opportunities */}
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          label="Total Opportunities"
          value={metrics.total_opportunities.toLocaleString()}
          bgColor="bg-blue-50"
        />

        {/* Won */}
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Won"
          value={metrics.won_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(metrics.win_rate)}
          bgColor="bg-green-50"
        />

        {/* Lost */}
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label="Lost"
          value={metrics.lost_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(
            metrics.total_opportunities > 0
              ? (metrics.lost_opportunities / metrics.total_opportunities) * 100
              : null
          )}
          bgColor="bg-red-50"
        />

        {/* Pending */}
        <MetricCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Pending"
          value={metrics.pending_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(
            metrics.total_opportunities > 0
              ? (metrics.pending_opportunities / metrics.total_opportunities) * 100
              : null
          )}
          bgColor="bg-amber-50"
        />

        {/* Won Value */}
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          label="Won Value"
          value={formatResidentialCurrency(metrics.won_value)}
          bgColor="bg-emerald-50"
        />

        {/* Value Win Rate */}
        <MetricCard
          icon={<Percent className="w-5 h-5 text-purple-600" />}
          label="Value Win Rate"
          value={formatResidentialPercent(metrics.value_win_rate)}
          subValue={`of ${formatResidentialCurrency(metrics.total_value)} total`}
          bgColor="bg-purple-50"
        />

        {/* Avg Days to Quote */}
        <MetricCard
          icon={<Timer className="w-5 h-5 text-indigo-600" />}
          label="Avg Days to Quote"
          value={metrics.avg_days_to_quote?.toFixed(1) || '-'}
          subValue="from assessment"
          bgColor="bg-indigo-50"
        />

        {/* Closed Win Rate */}
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-teal-600" />}
          label="Closed Win Rate"
          value={formatResidentialPercent(metrics.closed_win_rate)}
          subValue="won / (won + lost)"
          bgColor="bg-teal-50"
        />
      </div>

      {/* Monthly Histogram with Toggle */}
      {monthlyData && monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Monthly Trend (Last 13 Months)</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">View:</span>
              <button
                onClick={() => setViewMode('count')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'count'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                # Opportunities
              </button>
              <button
                onClick={() => setViewMode('value')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'value'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                $ Value
              </button>
            </div>
          </div>

          {/* Histogram Chart */}
          <MonthlyHistogram data={monthlyData} viewMode={viewMode} />
        </div>
      )}

      {/* Monthly Data Table - Always show all columns */}
      {monthlyData && monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Opps</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Opp Value</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won Value</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyData.map((month) => (
                  <tr key={month.month} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{month.month_label}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{month.total_opps.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-green-600">{month.won_opps.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.win_rate)}`}>
                        {formatResidentialPercent(month.win_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {formatResidentialCurrency(month.total_value)}
                    </td>
                    <td className="py-2 px-3 text-right text-green-600">
                      {formatResidentialCurrency(month.won_value)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.value_win_rate)}`}>
                        {formatResidentialPercent(month.value_win_rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="flex items-end justify-center gap-8 h-64">
          <FunnelBar
            label="Quoted"
            value={metrics.total_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-blue-500"
          />
          <FunnelBar
            label="Won"
            value={metrics.won_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-green-500"
          />
          <FunnelBar
            label="Lost"
            value={metrics.lost_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-red-400"
          />
          <FunnelBar
            label="Pending"
            value={metrics.pending_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-amber-400"
          />
        </div>
      </div>
    </div>
  );
}

// Monthly Histogram Component
function MonthlyHistogram({ data, viewMode }: { data: MonthlyTotals[]; viewMode: ViewMode }) {
  // Prepare chart data based on view mode
  const chartData = data.map((month) => ({
    label: month.month_label,
    total: viewMode === 'count' ? month.total_opps : month.total_value,
    won: viewMode === 'count' ? month.won_opps : month.won_value,
    winRate: viewMode === 'count' ? month.win_rate : month.value_win_rate,
  }));

  // Calculate max for scaling
  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);

  // Calculate average win rate
  const validRates = chartData.filter((d) => d.winRate !== null);
  const avgWinRate =
    validRates.length > 0
      ? validRates.reduce((sum, d) => sum + (d.winRate || 0), 0) / validRates.length
      : 0;

  // Fixed bar height in pixels for consistent rendering
  const barAreaHeight = 180;

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="relative">
        {/* Y-axis for totals */}
        <div className="absolute left-0 top-0 w-16 flex flex-col justify-between text-xs text-gray-500 text-right pr-2" style={{ height: barAreaHeight }}>
          <span>{viewMode === 'count' ? maxTotal.toLocaleString() : formatResidentialCurrency(maxTotal)}</span>
          <span>{viewMode === 'count' ? Math.round(maxTotal * 0.5).toLocaleString() : formatResidentialCurrency(maxTotal * 0.5)}</span>
          <span>0</span>
        </div>

        {/* Bars */}
        <div className="ml-16 flex items-end gap-2 overflow-x-auto pb-12" style={{ minHeight: barAreaHeight + 60 }}>
          {chartData.map((item, idx) => {
            const totalHeightPx = (item.total / maxTotal) * barAreaHeight;
            const wonHeightPx = (item.won / maxTotal) * barAreaHeight;

            return (
              <div key={idx} className="flex flex-col items-center min-w-[50px] group">
                {/* Win rate label above bar */}
                <div className="text-xs font-bold mb-1 h-5">
                  <span className={getWinRateColor(item.winRate)}>
                    {item.winRate !== null ? `${item.winRate.toFixed(0)}%` : '-'}
                  </span>
                </div>

                {/* Bar container */}
                <div className="relative w-10" style={{ height: barAreaHeight }}>
                  {/* Total bar (background) */}
                  <div
                    className="w-full bg-blue-200 rounded-t absolute bottom-0"
                    style={{ height: totalHeightPx }}
                  />
                  {/* Won bar (foreground) */}
                  <div
                    className="w-full bg-green-500 rounded-t absolute bottom-0"
                    style={{ height: wonHeightPx }}
                  />

                  {/* Tooltip */}
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    <div className="font-medium">{item.label}</div>
                    <div>Total: {viewMode === 'count' ? item.total.toLocaleString() : formatResidentialCurrency(item.total)}</div>
                    <div>Won: {viewMode === 'count' ? item.won.toLocaleString() : formatResidentialCurrency(item.won)}</div>
                    <div>Win Rate: {formatResidentialPercent(item.winRate)}</div>
                  </div>
                </div>

                {/* X-axis label */}
                <div className="text-xs text-gray-600 mt-2 text-center w-12 truncate" title={item.label}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-200 rounded" />
          <span>Total {viewMode === 'count' ? 'Opportunities' : 'Value'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span>Won {viewMode === 'count' ? 'Opportunities' : 'Value'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-600">Avg Win Rate: {formatResidentialPercent(avgWinRate)}</span>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function MetricCard({
  icon,
  label,
  value,
  subValue,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const height = Math.max(percentage * 2, 20); // Min 20px height

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-medium text-gray-600 mb-2">{value.toLocaleString()}</div>
      <div
        className={`w-24 ${color} rounded-t-lg transition-all duration-500`}
        style={{ height: `${height}px` }}
      />
      <div className="text-sm text-gray-700 mt-2">{label}</div>
      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
    </div>
  );
}

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 40) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 20) return 'text-amber-600';
  return 'text-red-600';
}
