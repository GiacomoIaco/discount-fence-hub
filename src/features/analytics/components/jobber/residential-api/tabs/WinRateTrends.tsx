// Win Rate Trends Tab - Monthly/Weekly trends with salesperson matrix (API Version)
// Shows: Monthly/Weekly histograms, Value win rate, Salesperson matrix

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Users, Grid3X3, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import {
  useApiResidentialEnhancedMonthlyTotals,
  useApiResidentialWeeklyTotals,
  useApiResidentialWinRateMatrix,
  type ApiEnhancedMonthlyTotals,
  type WinRateMatrixRow,
  type WeeklyTotals,
} from '../../../../hooks/jobber/residential';
import type { ResidentialFilters } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface WinRateTrendsProps {
  filters: ResidentialFilters;
}

type TimeView = 'monthly' | 'weekly';
type RateType = 'count' | 'value';

const MIN_OPPS_THRESHOLD = 10; // Minimum opportunities to be shown as individual salesperson

export function WinRateTrends({ filters }: WinRateTrendsProps) {
  const [timeView, setTimeView] = useState<TimeView>('monthly');
  const [rateType, setRateType] = useState<RateType>('count');
  const [showMatrix, setShowMatrix] = useState(true);
  const [showAllSalespeople, setShowAllSalespeople] = useState(false);

  // Fetch data
  const { data: monthlyData, isLoading: monthlyLoading } = useApiResidentialEnhancedMonthlyTotals(
    13,
    filters.revenueBucket || undefined
  );
  const { data: weeklyData, isLoading: weeklyLoading } = useApiResidentialWeeklyTotals(
    13,
    filters.revenueBucket || undefined
  );
  const { data: monthlyMatrix, isLoading: matrixMonthlyLoading } = useApiResidentialWinRateMatrix(
    12,
    filters.revenueBucket || undefined
  );

  const isLoading = monthlyLoading || weeklyLoading || matrixMonthlyLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const currentData = timeView === 'monthly' ? monthlyData : weeklyData;

  // Filter matrix data to only show salespeople with >= MIN_OPPS_THRESHOLD total opportunities
  const filteredMatrix = monthlyMatrix
    ? filterSalespeopleByVolume(monthlyMatrix, showAllSalespeople)
    : null;

  if (!currentData || currentData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No trend data available. Run Jobber API sync to see trends.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeView('monthly')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              timeView === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly (13 mo)
          </button>
          <button
            onClick={() => setTimeView('weekly')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              timeView === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Weekly (13 wk)
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Salesperson Filter Toggle */}
          <button
            onClick={() => setShowAllSalespeople(!showAllSalespeople)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showAllSalespeople
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-purple-600 text-white'
            }`}
            title={showAllSalespeople ? 'Click to show only top performers' : `Showing salespeople with ≥${MIN_OPPS_THRESHOLD} opportunities`}
          >
            <Filter className="w-4 h-4" />
            {showAllSalespeople ? 'Show All' : `Top Performers (≥${MIN_OPPS_THRESHOLD} opps)`}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Win Rate By:</span>
            <button
              onClick={() => setRateType('count')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                rateType === 'count'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              # Opps
            </button>
            <button
              onClick={() => setRateType('value')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                rateType === 'value'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              $ Value
            </button>
          </div>
        </div>
      </div>

      {/* Histogram Chart */}
      <HistogramChart
        data={currentData}
        timeView={timeView}
        rateType={rateType}
      />

      {/* Summary Metrics */}
      <SummaryMetrics data={currentData} timeView={timeView} />

      {/* Win Rate Matrix */}
      {timeView === 'monthly' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Salesperson × Month Matrix
              </h3>
            </div>
            {showMatrix ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showMatrix && filteredMatrix && filteredMatrix.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <WinRateMatrix
                data={filteredMatrix}
                rateType={rateType}
              />
            </div>
          )}
        </div>
      )}

      {/* Salesperson Trend Table */}
      {filteredMatrix && filteredMatrix.length > 0 && (
        <SalespersonTrendTable
          data={filteredMatrix}
          rateType={rateType}
        />
      )}
    </div>
  );
}

// Histogram Chart
function HistogramChart({
  data,
  timeView,
  rateType,
}: {
  data: ApiEnhancedMonthlyTotals[] | WeeklyTotals[];
  timeView: TimeView;
  rateType: RateType;
}) {
  const chartData = data.map((item) => {
    const isMonthly = 'month_label' in item;
    const label = isMonthly
      ? (item as ApiEnhancedMonthlyTotals).month_label
      : (item as WeeklyTotals).week_label;
    const shortLabel = label.slice(0, 6);
    const winRate = rateType === 'count'
      ? item.win_rate
      : 'value_win_rate' in item
        ? (item as ApiEnhancedMonthlyTotals).value_win_rate
        : item.total_value > 0
          ? (item.won_value / item.total_value) * 100
          : null;
    return {
      label,
      shortLabel,
      winRate,
      wonOpps: item.won_opps,
      totalOpps: item.total_opps,
      wonValue: item.won_value,
      totalValue: item.total_value,
    };
  });

  const validRates = chartData.filter((d) => d.winRate !== null);
  const avgWinRate = validRates.length > 0
    ? validRates.reduce((sum, d) => sum + (d.winRate || 0), 0) / validRates.length
    : 0;

  const maxRate = Math.max(...chartData.map((d) => d.winRate || 0), 50);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {rateType === 'count' ? 'Win Rate' : 'Value Win Rate'} Trend ({timeView === 'monthly' ? 'Monthly' : 'Weekly'})
        </h3>
        <div className="text-sm text-gray-500">
          Avg: <span className="font-semibold text-blue-600">{avgWinRate.toFixed(1)}%</span>
        </div>
      </div>

      <div className="flex items-end gap-2 h-48">
        {chartData.map((item, idx) => {
          const heightPct = item.winRate !== null ? (item.winRate / maxRate) * 100 : 0;
          const isAboveAvg = (item.winRate || 0) >= avgWinRate;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center group">
              <div className="text-xs font-medium text-gray-600 mb-1">
                {item.winRate !== null ? `${item.winRate.toFixed(0)}%` : '-'}
              </div>
              <div
                className={`w-full rounded-t transition-all ${isAboveAvg ? 'bg-green-400' : 'bg-amber-400'} hover:opacity-80`}
                style={{ height: `${heightPct}%`, minHeight: item.winRate ? '4px' : '0' }}
                title={`${item.label}: ${item.wonOpps}/${item.totalOpps} won (${formatResidentialCurrency(item.wonValue)})`}
              />
              <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {item.shortLabel}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span className="text-sm text-gray-600">Above Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-400 rounded" />
          <span className="text-sm text-gray-600">Below Average</span>
        </div>
      </div>
    </div>
  );
}

// Summary Metrics
function SummaryMetrics({
  data,
  timeView,
}: {
  data: ApiEnhancedMonthlyTotals[] | WeeklyTotals[];
  timeView: TimeView;
}) {
  const halfPoint = Math.floor(data.length / 2);
  const recentData = data.slice(0, halfPoint);
  const previousData = data.slice(halfPoint);

  const recentAvgWinRate = recentData.length > 0
    ? recentData.reduce((sum, m) => sum + (m.win_rate || 0), 0) / recentData.length
    : 0;
  const previousAvgWinRate = previousData.length > 0
    ? previousData.reduce((sum, m) => sum + (m.win_rate || 0), 0) / previousData.length
    : 0;
  const trendDiff = recentAvgWinRate - previousAvgWinRate;

  const sortedByWinRate = [...data].sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));
  const best = sortedByWinRate[0];
  const bestLabel = 'month_label' in best ? best.month_label : (best as WeeklyTotals).week_label;

  const totalOpps = data.reduce((sum, d) => sum + d.total_opps, 0);
  const totalWon = data.reduce((sum, d) => sum + d.won_opps, 0);
  const totalValue = data.reduce((sum, d) => sum + d.won_value, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-sm text-gray-600">Total Opportunities</div>
        <div className="text-2xl font-bold text-gray-900">{totalOpps.toLocaleString()}</div>
        <div className="text-sm text-green-600">{totalWon.toLocaleString()} won</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-sm text-gray-600">Recent Trend</div>
        <div className={`text-2xl font-bold flex items-center gap-2 ${getTrendColor(trendDiff)}`}>
          {trendDiff > 0 ? (
            <TrendingUp className="w-6 h-6" />
          ) : trendDiff < 0 ? (
            <TrendingDown className="w-6 h-6" />
          ) : (
            <Minus className="w-6 h-6" />
          )}
          {trendDiff > 0 ? '+' : ''}
          {trendDiff.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">vs previous {timeView === 'monthly' ? 'months' : 'weeks'}</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-sm text-gray-600">Best {timeView === 'monthly' ? 'Month' : 'Week'}</div>
        <div className="text-lg font-bold text-green-600">{bestLabel}</div>
        <div className="text-sm text-gray-500">{formatResidentialPercent(best?.win_rate || null)}</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="text-sm text-gray-600">Won Value</div>
        <div className="text-2xl font-bold text-blue-600">{formatResidentialCurrency(totalValue)}</div>
        <div className="text-sm text-gray-500">in {data.length} {timeView === 'monthly' ? 'months' : 'weeks'}</div>
      </div>
    </div>
  );
}

// Win Rate Matrix
function WinRateMatrix({
  data,
  rateType,
}: {
  data: WinRateMatrixRow[];
  rateType: RateType;
}) {
  const salespeople = [...new Set(data.map((d) => d.salesperson))].sort();
  const months = [...new Set(data.map((d) => d.month))].sort();

  const dataMap = new Map<string, WinRateMatrixRow>();
  data.forEach((d) => {
    dataMap.set(`${d.salesperson}|${d.month}`, d);
  });

  const monthLabels = months.map((m) => {
    const entry = data.find((d) => d.month === m);
    return entry?.month_label || m;
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-2 px-3 text-left font-medium text-gray-700 sticky left-0 bg-white min-w-[120px]">
              Salesperson
            </th>
            {monthLabels.map((label, idx) => (
              <th key={idx} className="py-2 px-2 text-center font-medium text-gray-700 min-w-[60px]">
                {label.slice(0, 6)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {salespeople.map((sp) => (
            <tr key={sp} className="hover:bg-gray-50">
              <td className="py-2 px-3 font-medium text-gray-900 sticky left-0 bg-white">
                {sp}
              </td>
              {months.map((month, idx) => {
                const entry = dataMap.get(`${sp}|${month}`);
                const winRate = rateType === 'count' ? entry?.win_rate : entry?.value_win_rate;
                const totalOpps = entry?.total_opps || 0;

                return (
                  <td key={idx} className="py-2 px-2 text-center">
                    {entry && totalOpps > 0 ? (
                      <div
                        className={`px-1 py-0.5 rounded text-xs font-medium ${getMatrixCellColor(winRate)}`}
                        title={`${entry.won_opps}/${entry.total_opps} won (${formatResidentialCurrency(entry.won_value)})`}
                      >
                        {winRate !== null && winRate !== undefined ? `${winRate.toFixed(0)}%` : '-'}
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Salesperson Trend Table
function SalespersonTrendTable({
  data,
  rateType,
}: {
  data: WinRateMatrixRow[];
  rateType: RateType;
}) {
  const salespeople = [...new Set(data.map((d) => d.salesperson))];

  const aggregated = salespeople.map((sp) => {
    const spData = data.filter((d) => d.salesperson === sp);
    const totalOpps = spData.reduce((sum, d) => sum + d.total_opps, 0);
    const wonOpps = spData.reduce((sum, d) => sum + d.won_opps, 0);
    const wonValue = spData.reduce((sum, d) => sum + d.won_value, 0);
    const totalValue = spData.reduce((sum, d) => sum + (d.total_value || 0), 0);

    const winRate = totalOpps > 0 ? (wonOpps / totalOpps) * 100 : null;
    const valueWinRate = totalValue > 0 ? (wonValue / totalValue) * 100 : null;

    const sorted = [...spData].sort((a, b) => b.month.localeCompare(a.month));
    const half = Math.floor(sorted.length / 2);
    const recentData = sorted.slice(0, half);
    const previousData = sorted.slice(half);

    const recentRate = recentData.length > 0
      ? recentData.reduce((sum, d) => sum + (rateType === 'count' ? (d.win_rate || 0) : (d.value_win_rate || 0)), 0) / recentData.length
      : null;
    const previousRate = previousData.length > 0
      ? previousData.reduce((sum, d) => sum + (rateType === 'count' ? (d.win_rate || 0) : (d.value_win_rate || 0)), 0) / previousData.length
      : null;
    const trend = recentRate !== null && previousRate !== null ? recentRate - previousRate : null;

    return { salesperson: sp, totalOpps, wonOpps, winRate, valueWinRate, wonValue, trend };
  });

  const sorted = [...aggregated].sort((a, b) => b.wonValue - a.wonValue);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Salesperson Performance</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 px-4 text-left font-medium text-gray-700">Salesperson</th>
              <th className="py-3 px-4 text-right font-medium text-gray-700">Opps</th>
              <th className="py-3 px-4 text-right font-medium text-gray-700">Won</th>
              <th className="py-3 px-4 text-right font-medium text-gray-700">
                Win Rate {rateType === 'count' ? '(#)' : '($)'}
              </th>
              <th className="py-3 px-4 text-right font-medium text-gray-700">Won Value</th>
              <th className="py-3 px-4 text-right font-medium text-gray-700">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((sp) => (
              <tr key={sp.salesperson} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{sp.salesperson}</td>
                <td className="py-3 px-4 text-right text-gray-600">{sp.totalOpps.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-green-600">{sp.wonOpps.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-semibold ${getWinRateColor(rateType === 'count' ? sp.winRate : sp.valueWinRate)}`}>
                    {formatResidentialPercent(rateType === 'count' ? sp.winRate : sp.valueWinRate)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-medium text-gray-900">
                  {formatResidentialCurrency(sp.wonValue)}
                </td>
                <td className="py-3 px-4 text-right">
                  {sp.trend !== null ? (
                    <span className={`flex items-center justify-end gap-1 ${getTrendColor(sp.trend)}`}>
                      {sp.trend > 2 ? <TrendingUp className="w-4 h-4" /> : sp.trend < -2 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      <span className="font-medium">{sp.trend > 0 ? '+' : ''}{sp.trend.toFixed(1)}%</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper Functions
function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 45) return 'text-green-600';
  if (rate >= 35) return 'text-blue-600';
  if (rate >= 25) return 'text-amber-600';
  return 'text-red-600';
}

function getTrendColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-600';
}

function getMatrixCellColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return 'bg-gray-100 text-gray-400';
  if (rate >= 50) return 'bg-green-100 text-green-800';
  if (rate >= 40) return 'bg-green-50 text-green-700';
  if (rate >= 30) return 'bg-blue-50 text-blue-700';
  if (rate >= 20) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function filterSalespeopleByVolume<T extends { salesperson: string; total_opps: number }>(
  data: T[],
  showAll: boolean
): T[] {
  if (showAll) return data;

  const salespersonTotals = new Map<string, number>();
  data.forEach((d) => {
    const current = salespersonTotals.get(d.salesperson) || 0;
    salespersonTotals.set(d.salesperson, current + d.total_opps);
  });

  const qualifiedSalespeople = new Set<string>();
  salespersonTotals.forEach((total, salesperson) => {
    if (total >= MIN_OPPS_THRESHOLD) {
      qualifiedSalespeople.add(salesperson);
    }
  });

  return data.filter((d) => qualifiedSalespeople.has(d.salesperson));
}
