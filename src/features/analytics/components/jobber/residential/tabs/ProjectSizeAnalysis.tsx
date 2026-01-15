// Project Size Analysis Tab - Win rate by project size
// Shows: Win rate by revenue bucket, Salesperson x Size matrix

import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useResidentialBucketMetrics } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, BucketMetrics } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent, REVENUE_BUCKET_ORDER } from '../../../../types/residential';

interface ProjectSizeAnalysisProps {
  filters: ResidentialFilters;
}

export function ProjectSizeAnalysis({ filters }: ProjectSizeAnalysisProps) {
  const { data: sizeMetrics, isLoading } = useResidentialBucketMetrics(filters);

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

  // Calculate overall average win rate
  const overallWinRate = sizeMetrics && sizeMetrics.length > 0
    ? sizeMetrics.reduce((sum, s) => sum + s.won_opps, 0) /
      sizeMetrics.reduce((sum, s) => sum + s.total_opps, 0) * 100
    : 0;

  // Find best and worst performing sizes
  const sortedByWinRate = [...(sizeMetrics || [])].sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));
  const bestSize = sortedByWinRate[0];
  const worstSize = sortedByWinRate[sortedByWinRate.length - 1];

  return (
    <div className="space-y-6">
      {/* Key Insight */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-800">Project Size Impact</div>
            <div className="text-sm text-emerald-700 mt-1">
              {bestSize ? (
                <>
                  <span className="font-bold">{bestSize.revenue_bucket}</span> projects have the highest
                  win rate at <span className="font-bold">{formatResidentialPercent(bestSize.win_rate)}</span>.
                  {worstSize && worstSize.revenue_bucket !== bestSize.revenue_bucket && (
                    <>
                      {' '}<span className="font-bold">{worstSize.revenue_bucket}</span> projects
                      have the lowest at <span className="font-bold">{formatResidentialPercent(worstSize.win_rate)}</span>.
                    </>
                  )}
                </>
              ) : (
                'Upload data to see project size insights.'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Win Rate by Size Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Win Rate by Project Size</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Size Bucket</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opportunities</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Total Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {REVENUE_BUCKET_ORDER.map((bucket) => {
                const metric = sizeMetrics?.find((s) => s.revenue_bucket === bucket);
                return metric ? (
                  <SizeRow
                    key={bucket}
                    metric={metric}
                    avgWinRate={overallWinRate}
                    isBest={metric.revenue_bucket === bestSize?.revenue_bucket}
                    isWorst={metric.revenue_bucket === worstSize?.revenue_bucket}
                  />
                ) : (
                  <tr key={bucket} className="text-gray-400">
                    <td className="py-3 px-4">{bucket}</td>
                    <td colSpan={6} className="py-3 px-4 text-center">No data</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Size Distribution Visual */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume by Size</h3>
        <div className="space-y-3">
          {REVENUE_BUCKET_ORDER.map((bucket) => {
            const metric = sizeMetrics?.find((s) => s.revenue_bucket === bucket);
            const maxOpps = Math.max(...(sizeMetrics?.map((s) => s.total_opps) || [1]));
            const percentage = metric ? (metric.total_opps / maxOpps) * 100 : 0;

            return (
              <div key={bucket} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-700 truncate">{bucket}</div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 ${getBarColor(metric?.win_rate || 0)}`}
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-sm">
                    <span className="font-medium text-gray-900">
                      {metric?.total_opps.toLocaleString() || 0} opps
                    </span>
                    <span className="ml-auto text-gray-600">
                      {formatResidentialPercent(metric?.win_rate || null)} win
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Takeaways */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Key Takeaways</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Larger projects often have higher win rates due to less competition</li>
          <li>Small projects ($0-$1K) may have lower win rates due to price shopping</li>
          <li>Focus sales training on size buckets with below-average win rates</li>
          <li>Consider minimum project thresholds if small projects have very low win rates</li>
        </ul>
      </div>
    </div>
  );
}

function SizeRow({
  metric,
  avgWinRate,
  isBest,
  isWorst,
}: {
  metric: BucketMetrics;
  avgWinRate: number;
  isBest: boolean;
  isWorst: boolean;
}) {
  const diff = (metric.win_rate || 0) - avgWinRate;

  return (
    <tr className={`hover:bg-gray-50 ${isBest ? 'bg-green-50' : isWorst ? 'bg-red-50' : ''}`}>
      <td className="py-3 px-4">
        <span className="font-medium text-gray-900">{metric.revenue_bucket}</span>
        {isBest && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
            Best
          </span>
        )}
        {isWorst && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
            Lowest
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-right text-gray-600">{metric.total_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right text-green-600">{metric.won_opps.toLocaleString()}</td>
      <td className="py-3 px-4 text-right">
        <span className={`font-semibold ${getWinRateColor(metric.win_rate)}`}>
          {formatResidentialPercent(metric.win_rate)}
        </span>
      </td>
      <td className="py-3 px-4 text-right text-gray-600">
        {formatResidentialCurrency(metric.total_value)}
      </td>
      <td className="py-3 px-4 text-right font-medium text-gray-900">
        {formatResidentialCurrency(metric.won_value)}
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

function getBarColor(rate: number): string {
  if (rate >= 40) return 'bg-green-400';
  if (rate >= 30) return 'bg-blue-400';
  if (rate >= 25) return 'bg-amber-400';
  return 'bg-red-400';
}

function getDiffColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
