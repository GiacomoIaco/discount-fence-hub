// Salesperson Performance Tab - Individual rep metrics (API Version)
// Shows: Win rate, revenue, speed metrics per salesperson

import { Users, TrendingUp, TrendingDown, Minus, Award, Target } from 'lucide-react';
import { useApiResidentialSalespersonMetrics, useApiResidentialSalespersonExtendedMetrics } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface SalespersonPerformanceProps {
  filters: ResidentialFilters;
}

export function SalespersonPerformance({ filters }: SalespersonPerformanceProps) {
  const { data: basicMetrics, isLoading: basicLoading } = useApiResidentialSalespersonMetrics(filters);
  const { data: extendedMetrics, isLoading: extendedLoading } = useApiResidentialSalespersonExtendedMetrics(filters);

  const isLoading = basicLoading || extendedLoading;
  const metrics = extendedMetrics || basicMetrics;

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

  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No salesperson data available. Run Jobber API sync to see performance metrics.
      </div>
    );
  }

  // Calculate team averages
  const teamTotals = metrics.reduce(
    (acc, sp) => ({
      totalOpps: acc.totalOpps + sp.total_opps,
      wonOpps: acc.wonOpps + sp.won_opps,
      wonValue: acc.wonValue + sp.won_value,
    }),
    { totalOpps: 0, wonOpps: 0, wonValue: 0 }
  );
  const teamAvgWinRate = teamTotals.totalOpps > 0 ? (teamTotals.wonOpps / teamTotals.totalOpps) * 100 : 0;

  // Sort by won value descending
  const sortedMetrics = [...metrics].sort((a, b) => b.won_value - a.won_value);
  const topPerformer = sortedMetrics[0];

  return (
    <div className="space-y-6">
      {/* Top Performer Highlight */}
      {topPerformer && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-amber-600" />
            <div>
              <div className="font-semibold text-amber-800">Top Revenue Generator</div>
              <div className="text-sm text-amber-700 mt-1">
                <span className="font-bold">{topPerformer.salesperson}</span> leads with{' '}
                <span className="font-bold">{formatResidentialCurrency(topPerformer.won_value)}</span> in won revenue
                ({topPerformer.won_opps} deals at {formatResidentialPercent(topPerformer.win_rate)} win rate)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Team Size</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{metrics.length}</div>
          <div className="text-sm text-gray-500">active reps</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Team Win Rate</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{(teamAvgWinRate ?? 0).toFixed(1)}%</div>
          <div className="text-sm text-gray-500">{teamTotals.wonOpps.toLocaleString()} won</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Total Pipeline</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{teamTotals.totalOpps.toLocaleString()}</div>
          <div className="text-sm text-gray-500">opportunities</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-700">Total Won</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{formatResidentialCurrency(teamTotals.wonValue)}</div>
          <div className="text-sm text-gray-500">revenue</div>
        </div>
      </div>

      {/* Salesperson Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Salesperson Performance</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Salesperson</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opps</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Avg Deal</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Same Day %</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMetrics.map((sp, index) => (
                <SalespersonRow
                  key={sp.salesperson}
                  metric={sp}
                  rank={index + 1}
                  teamAvgWinRate={teamAvgWinRate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Takeaways */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Coaching Opportunities</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Pair top performers with newer reps for mentoring</li>
          <li>Focus on increasing same-day quote percentage for underperformers</li>
          <li>Review lost opportunities with reps significantly below team average</li>
          <li>Celebrate wins and share best practices in team meetings</li>
        </ul>
      </div>
    </div>
  );
}

interface SalespersonMetric {
  salesperson: string;
  total_opps: number;
  won_opps: number;
  win_rate: number | null;
  won_value: number;
  avg_won_value?: number | null;
  same_day_pct?: number | null;
}

function SalespersonRow({
  metric,
  rank,
  teamAvgWinRate,
}: {
  metric: SalespersonMetric;
  rank: number;
  teamAvgWinRate: number;
}) {
  const diff = (metric.win_rate || 0) - teamAvgWinRate;
  const avgDeal = metric.avg_won_value || (metric.won_opps > 0 ? metric.won_value / metric.won_opps : 0);

  return (
    <tr className={`hover:bg-gray-50 ${rank <= 3 ? 'bg-amber-50/50' : ''}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {rank <= 3 && (
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-gray-400' : 'bg-amber-700'
            }`}>
              {rank}
            </span>
          )}
          <span className="font-medium text-gray-900">{metric.salesperson}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-gray-600">{metric.total_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-green-600">{metric.won_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right">
        <span className={`font-semibold ${getWinRateColor(metric.win_rate)}`}>
          {formatResidentialPercent(metric.win_rate)}
        </span>
      </td>
      <td className="py-3 px-4 text-right font-medium text-green-600">
        {formatResidentialCurrency(metric.won_value)}
      </td>
      <td className="py-3 px-4 text-right text-gray-600">
        {formatResidentialCurrency(avgDeal)}
      </td>
      <td className="py-3 px-4 text-right text-gray-600">
        {metric.same_day_pct != null ? `${metric.same_day_pct.toFixed(0)}%` : '-'}
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`flex items-center justify-end gap-1 ${getDiffColor(diff)}`}>
          {diff > 0 ? (
            <TrendingUp className="w-4 h-4" />
          ) : diff < 0 ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
          <span className="font-medium">
            {diff > 0 ? '+' : ''}
            {(diff ?? 0).toFixed(1)}%
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

function getDiffColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
