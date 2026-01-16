// Conversion Funnel Tab - Core metrics and funnel visualization
// Shows: Opportunities, Won/Lost/Pending, Win%, Won$, Value Win%, Avg Days

import { useState } from 'react';
import { TrendingUp, CheckCircle, XCircle, Clock, DollarSign, Percent, Timer } from 'lucide-react';
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
        <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-stone-200">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
              <h3 className="text-lg font-semibold text-stone-800">Monthly Trend</h3>
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Last 13 Months</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
              <button
                onClick={() => setViewMode('count')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'count'
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                # Count
              </button>
              <button
                onClick={() => setViewMode('value')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'value'
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                $ Value
              </button>
            </div>
          </div>

          {/* Histogram Chart */}
          <div className="p-6">
            <MonthlyHistogram data={monthlyData} viewMode={viewMode} />
          </div>
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

// Monthly Histogram Component - Hybrid Editorial + Modern Design
function MonthlyHistogram({ data, viewMode }: { data: MonthlyTotals[]; viewMode: ViewMode }) {
  // Prepare chart data based on view mode
  const chartData = data.map((month) => ({
    label: month.month_label,
    shortLabel: month.month_label.slice(0, 3),
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
  const barAreaHeight = 200;

  return (
    <div className="relative">
      {/* Horizontal Grid Lines */}
      <div className="absolute inset-x-0 top-6 flex flex-col justify-between pointer-events-none" style={{ height: barAreaHeight }}>
        {[100, 75, 50, 25, 0].map((pct, i) => (
          <div key={pct} className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-stone-400 w-12 text-right tabular-nums">
              {viewMode === 'count'
                ? Math.round(maxTotal * (1 - i * 0.25)).toLocaleString()
                : formatResidentialCurrency(maxTotal * (1 - i * 0.25))
              }
            </span>
            <div className="flex-1 border-t border-stone-200/80" />
          </div>
        ))}
      </div>

      {/* Chart Area */}
      <div className="relative ml-14 pt-6 pb-4">
        {/* Average Line */}
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-teal-400/60 pointer-events-none z-10"
          style={{ top: 24 + barAreaHeight - (avgWinRate / 100) * barAreaHeight * 0.6 }}
        />

        {/* Bars Container */}
        <div className="flex items-end gap-3" style={{ height: barAreaHeight }}>
          {chartData.map((item, idx) => {
            const totalHeightPx = Math.max((item.total / maxTotal) * barAreaHeight, 2);
            const wonHeightPx = Math.max((item.won / maxTotal) * barAreaHeight, 0);
            const isHighPerformer = (item.winRate || 0) >= avgWinRate;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center group min-w-0">
                {/* Win rate label - Editorial style with conditional highlight */}
                <div className={`text-[11px] font-bold mb-2 transition-all duration-200
                               ${isHighPerformer ? 'text-teal-600' : 'text-stone-400'}
                               group-hover:scale-110`}>
                  {item.winRate !== null ? `${item.winRate.toFixed(0)}%` : '-'}
                </div>

                {/* Bar Stack */}
                <div className="relative w-full max-w-[32px]" style={{ height: barAreaHeight - 24 }}>
                  {/* Total bar (background) - warm stone */}
                  <div
                    className="absolute bottom-0 w-full bg-stone-200/80 rounded-t-sm transition-all duration-500 ease-out"
                    style={{ height: totalHeightPx }}
                  />
                  {/* Won bar (foreground) - coral/salmon accent */}
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm transition-all duration-500 ease-out
                               bg-gradient-to-t from-[#E07A5F] to-[#F2A490]
                               group-hover:from-[#D66B4F] group-hover:to-[#E8937E]
                               group-hover:shadow-lg group-hover:shadow-[#E07A5F]/20"
                    style={{ height: wonHeightPx }}
                  />

                  {/* Glass Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3
                                  opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100
                                  transition-all duration-200 ease-out pointer-events-none z-20">
                    <div className="bg-white/95 backdrop-blur-sm border border-stone-200
                                    rounded-lg shadow-xl shadow-stone-200/50 px-3 py-2.5 min-w-[140px]">
                      <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
                        {item.label}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Pipeline</span>
                          <span className="font-semibold text-stone-700 tabular-nums">
                            {viewMode === 'count' ? item.total.toLocaleString() : formatResidentialCurrency(item.total)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[#E07A5F]">Won</span>
                          <span className="font-semibold text-[#E07A5F] tabular-nums">
                            {viewMode === 'count' ? item.won.toLocaleString() : formatResidentialCurrency(item.won)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-1.5 mt-1.5 border-t border-stone-100">
                          <span className="text-stone-500">Win Rate</span>
                          <span className="font-bold text-stone-800">{formatResidentialPercent(item.winRate)}</span>
                        </div>
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2
                                      border-[6px] border-transparent border-t-white/95" />
                    </div>
                  </div>
                </div>

                {/* Month Label */}
                <span className="mt-2 text-[10px] font-medium text-stone-500 uppercase tracking-wide
                               group-hover:text-stone-700 transition-colors">
                  {item.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend - Pill Style */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-stone-200">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full">
          <div className="w-3 h-3 bg-stone-300 rounded-sm" />
          <span className="text-xs font-medium text-stone-600">Total Pipeline</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E07A5F]/10 rounded-full">
          <div className="w-3 h-3 bg-gradient-to-t from-[#E07A5F] to-[#F2A490] rounded-sm" />
          <span className="text-xs font-medium text-[#C86A52]">Won</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 rounded-full">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-teal-400" />
          <span className="text-xs font-medium text-teal-700">Avg: {formatResidentialPercent(avgWinRate)}</span>
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
