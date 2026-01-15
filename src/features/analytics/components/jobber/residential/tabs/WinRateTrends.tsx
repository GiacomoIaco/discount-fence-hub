// Win Rate Trends Tab - Monthly trends and patterns
// Shows: Monthly win rate over time, YoY comparison, Seasonality

import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from 'lucide-react';
import { useResidentialMonthlyTotals } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, MonthlyTotals } from '../../../../types/residential';
// MonthlyTotals extends MonthlyTrend with optional pending_opps
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface WinRateTrendsProps {
  filters: ResidentialFilters;
}

export function WinRateTrends({ filters }: WinRateTrendsProps) {
  const { data: monthlyData, isLoading } = useResidentialMonthlyTotals(24, filters.revenueBucket || undefined);

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

  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No monthly data available. Upload CSV files to see trends.
      </div>
    );
  }

  // Calculate trend (compare last 3 months to previous 3 months)
  const recent3 = monthlyData.slice(0, 3);
  const previous3 = monthlyData.slice(3, 6);

  const recentAvgWinRate =
    recent3.reduce((sum, m) => sum + (m.win_rate || 0), 0) / recent3.length;
  const previousAvgWinRate =
    previous3.length > 0
      ? previous3.reduce((sum, m) => sum + (m.win_rate || 0), 0) / previous3.length
      : 0;
  const trendDiff = recentAvgWinRate - previousAvgWinRate;

  // Find best and worst months
  const sortedByWinRate = [...monthlyData].sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));
  const bestMonth = sortedByWinRate[0];
  const worstMonth = sortedByWinRate[sortedByWinRate.length - 1];

  // Calculate overall average
  const overallAvg =
    monthlyData.reduce((sum, m) => sum + (m.win_rate || 0), 0) / monthlyData.length;

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Avg Win Rate (All Time)</div>
          <div className="text-2xl font-bold text-blue-600">{formatResidentialPercent(overallAvg)}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Recent Trend (3mo)</div>
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
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Best Month</div>
          <div className="text-lg font-bold text-green-600">{bestMonth?.month_label}</div>
          <div className="text-sm text-gray-500">{formatResidentialPercent(bestMonth?.win_rate || null)}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Lowest Month</div>
          <div className="text-lg font-bold text-red-600">{worstMonth?.month_label}</div>
          <div className="text-sm text-gray-500">{formatResidentialPercent(worstMonth?.win_rate || null)}</div>
        </div>
      </div>

      {/* Win Rate Chart (Simple Bar Visualization) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Monthly Win Rate Trend</h3>
        </div>

        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500">
            <span>50%</span>
            <span>40%</span>
            <span>30%</span>
            <span>20%</span>
            <span>10%</span>
            <span>0%</span>
          </div>

          {/* Chart area */}
          <div className="ml-14 h-full flex items-end gap-1 overflow-x-auto pb-8">
            {[...monthlyData].reverse().map((month) => {
              const height = Math.max((month.win_rate || 0) * 4, 4);
              const isAboveAvg = (month.win_rate || 0) >= overallAvg;

              return (
                <div key={month.month} className="flex flex-col items-center min-w-[40px]">
                  <div className="flex-1 flex items-end">
                    <div
                      className={`w-8 rounded-t transition-all duration-300 ${
                        isAboveAvg ? 'bg-green-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${height}px` }}
                      title={`${month.month_label}: ${formatResidentialPercent(month.win_rate)}`}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-2 rotate-45 origin-top-left w-12">
                    {month.month_label.slice(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Average line */}
          <div
            className="absolute left-14 right-0 border-t-2 border-dashed border-blue-400"
            style={{ bottom: `${32 + overallAvg * 4}px` }}
          >
            <span className="absolute -top-3 right-0 text-xs text-blue-600 bg-white px-1">
              Avg: {formatResidentialPercent(overallAvg)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Monthly Breakdown</h3>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Month</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opportunities</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Lost</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyData.map((month) => (
                <MonthRow key={month.month} month={month} avgWinRate={overallAvg} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonality Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Trend Insights</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>
            {trendDiff >= 0 ? (
              <>Win rate is <span className="font-bold">trending up</span> - keep up the momentum!</>
            ) : (
              <>Win rate is <span className="font-bold">trending down</span> - review recent processes</>
            )}
          </li>
          <li>Fence business often has seasonal patterns - Q2/Q3 typically stronger</li>
          <li>Use slow months (winter) for training and process improvement</li>
          <li>Monitor pending quotes during peak months to avoid backlogs</li>
        </ul>
      </div>
    </div>
  );
}

function MonthRow({ month, avgWinRate }: { month: MonthlyTotals; avgWinRate: number }) {
  const diff = (month.win_rate || 0) - avgWinRate;
  const lostOpps = month.total_opps - month.won_opps - (month.pending_opps || 0);

  return (
    <tr className="hover:bg-gray-50">
      <td className="py-3 px-4 font-medium text-gray-900">{month.month_label}</td>
      <td className="py-3 px-4 text-right text-gray-600">{month.total_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-green-600">{month.won_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-red-600">{Math.max(0, lostOpps).toLocaleString()}</td>
      <td className="py-3 px-4 text-right">
        <span className={`font-semibold ${getWinRateColor(month.win_rate)}`}>
          {formatResidentialPercent(month.win_rate)}
        </span>
      </td>
      <td className="py-3 px-4 text-right font-medium text-gray-900">
        {formatResidentialCurrency(month.won_value)}
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`flex items-center justify-end gap-1 ${getDiffColor(diff)}`}>
          {diff > 2 ? (
            <TrendingUp className="w-4 h-4" />
          ) : diff < -2 ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
          <span className="font-medium">
            {diff > 0 ? '+' : ''}
            {diff.toFixed(1)}%
          </span>
        </span>
      </td>
    </tr>
  );
}

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 40) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 25) return 'text-amber-600';
  return 'text-red-600';
}

function getTrendColor(diff: number): string {
  if (diff > 3) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -3) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-600';
}

function getDiffColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
