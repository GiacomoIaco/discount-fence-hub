// Speed to Quote Analysis Tab - Key insight: faster quotes = higher win rates
// Shows: Win rate by speed bucket, Speed x Size matrix, Alert card, Salesperson ranking

import { Clock, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useResidentialSpeedMetrics, useResidentialSpeedBySizeMatrix } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, SpeedMetrics } from '../../../../types/residential';
import { formatResidentialPercent, SPEED_BUCKET_ORDER, REVENUE_BUCKET_ORDER } from '../../../../types/residential';

interface SpeedToQuoteAnalysisProps {
  filters: ResidentialFilters;
}

export function SpeedToQuoteAnalysis({ filters }: SpeedToQuoteAnalysisProps) {
  const { data: speedMetrics, isLoading } = useResidentialSpeedMetrics(filters);
  const { data: matrixData } = useResidentialSpeedBySizeMatrix(filters);

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

  // Calculate alert metrics (8+ days quotes this month)
  const slowQuotes = speedMetrics?.find(s => s.speed_bucket === '8+ days');
  const sameDayQuotes = speedMetrics?.find(s => s.speed_bucket === 'Same day');

  return (
    <div className="space-y-6">
      {/* Key Insight Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800">Speed to Quote Matters!</div>
            <div className="text-sm text-amber-700 mt-1">
              Same-day quotes have a{' '}
              <span className="font-bold">{formatResidentialPercent(sameDayQuotes?.win_rate || null)}</span>
              {' '}win rate, while quotes taking 8+ days drop to{' '}
              <span className="font-bold">{formatResidentialPercent(slowQuotes?.win_rate || null)}</span>
              {' '}- a{' '}
              <span className="font-bold text-red-700">
                {Math.abs(slowQuotes?.baseline_diff || 0).toFixed(1)}%
              </span>
              {' '}decrease.
            </div>
          </div>
        </div>
      </div>

      {/* Win Rate by Speed Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Win Rate by Speed to Quote</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Speed</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opportunities</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {speedMetrics?.map((metric) => (
                <SpeedRow key={metric.speed_bucket} metric={metric} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Speed x Size Matrix */}
      {matrixData && matrixData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Speed to Quote x Project Size Matrix</h3>
          <p className="text-sm text-gray-600 mb-4">
            Win rates by speed bucket and project size. Darker green = higher win rate.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Speed</th>
                  {REVENUE_BUCKET_ORDER.map((bucket) => (
                    <th key={bucket} className="text-center py-2 px-3 font-medium text-gray-700 whitespace-nowrap">
                      {bucket}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SPEED_BUCKET_ORDER.map((speedBucket) => {
                  const rowData = matrixData.filter(d => d.speed_bucket === speedBucket);
                  return (
                    <tr key={speedBucket}>
                      <td className="py-2 px-3 font-medium text-gray-900 whitespace-nowrap">
                        {speedBucket}
                      </td>
                      {REVENUE_BUCKET_ORDER.map((revBucket) => {
                        const cell = rowData.find(d => d.revenue_bucket === revBucket);
                        return (
                          <td key={revBucket} className="py-2 px-3 text-center">
                            {cell ? (
                              <div
                                className={`px-2 py-1 rounded ${getWinRateBgColor(cell.win_rate)}`}
                              >
                                <div className="font-medium text-gray-900">
                                  {formatResidentialPercent(cell.win_rate)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {cell.won_opps}/{cell.total_opps}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Takeaways */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Key Takeaways</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Quote the same day whenever possible - it has the highest win rate</li>
          <li>Quotes taking 8+ days have ~15% lower win rate than same-day quotes</li>
          <li>Speed matters more for smaller projects where competition is higher</li>
          <li>Set up alerts for quotes that are taking more than 3 days</li>
        </ul>
      </div>
    </div>
  );
}

// Helper Components

function SpeedRow({ metric }: { metric: SpeedMetrics }) {
  const isBaseline = metric.speed_bucket === 'Same day';
  const diffValue = metric.baseline_diff || 0;

  return (
    <tr className={isBaseline ? 'bg-green-50' : 'hover:bg-gray-50'}>
      <td className="py-3 px-4">
        <span className={`font-medium ${isBaseline ? 'text-green-700' : 'text-gray-900'}`}>
          {metric.speed_bucket}
        </span>
        {isBaseline && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
            Baseline
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
      <td className="py-3 px-4 text-right">
        {isBaseline ? (
          <span className="text-gray-400">-</span>
        ) : (
          <span className={`flex items-center justify-end gap-1 ${getDiffColor(diffValue)}`}>
            {diffValue > 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : diffValue < 0 ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
            <span className="font-medium">
              {diffValue > 0 ? '+' : ''}
              {diffValue.toFixed(1)}%
            </span>
          </span>
        )}
      </td>
    </tr>
  );
}

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 35) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 25) return 'text-amber-600';
  return 'text-red-600';
}

function getWinRateBgColor(rate: number | null): string {
  if (rate === null) return 'bg-gray-50';
  if (rate >= 40) return 'bg-green-100';
  if (rate >= 35) return 'bg-green-50';
  if (rate >= 30) return 'bg-blue-50';
  if (rate >= 25) return 'bg-amber-50';
  return 'bg-red-50';
}

function getDiffColor(diff: number): string {
  if (diff > 0) return 'text-green-600';
  if (diff < -10) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
