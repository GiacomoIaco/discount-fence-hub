// Quote Options Analysis Tab - Win rate by number of quote options (API Version)
// Shows: Win rate for 1 vs 2+ quotes per opportunity

import { FileText, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useApiResidentialQuoteCountMetrics } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, QuoteCountMetrics } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent, QUOTE_COUNT_BUCKET_ORDER } from '../../../../types/residential';

interface QuoteOptionsAnalysisProps {
  filters: ResidentialFilters;
}

export function QuoteOptionsAnalysis({ filters }: QuoteOptionsAnalysisProps) {
  const { data: quoteCountMetrics, isLoading } = useApiResidentialQuoteCountMetrics(filters);

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

  // Find single vs multiple quote stats
  const singleQuote = quoteCountMetrics?.find((q) => q.quote_count_bucket === '1 quote');
  const multipleQuotes = quoteCountMetrics?.filter((q) => q.quote_count_bucket !== '1 quote');
  const multipleTotal = multipleQuotes?.reduce(
    (acc, q) => ({
      total_opps: acc.total_opps + q.total_opps,
      won_opps: acc.won_opps + q.won_opps,
      won_value: acc.won_value + q.won_value,
    }),
    { total_opps: 0, won_opps: 0, won_value: 0 }
  );
  const multipleWinRate = multipleTotal && multipleTotal.total_opps > 0
    ? (multipleTotal.won_opps / multipleTotal.total_opps) * 100
    : 0;

  // Calculate baseline (single quote)
  const baseline = singleQuote?.win_rate || 0;

  return (
    <div className="space-y-6">
      {/* Key Insight */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div>
            <div className="font-semibold text-indigo-800">Quote Options Strategy</div>
            <div className="text-sm text-indigo-700 mt-1">
              Opportunities with <span className="font-bold">multiple quote options</span> have a{' '}
              <span className={`font-bold ${multipleWinRate > baseline ? 'text-green-700' : 'text-red-700'}`}>
                {formatResidentialPercent(multipleWinRate)}
              </span>{' '}
              win rate vs{' '}
              <span className="font-bold">{formatResidentialPercent(baseline)}</span> for single quotes
              {multipleWinRate > baseline
                ? ' - offering options increases close rate!'
                : ' - focus on single strong recommendations.'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Single Quote Opps</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {singleQuote?.total_opps.toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Win Rate: <span className="font-semibold text-blue-600">{formatResidentialPercent(singleQuote?.win_rate || null)}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Multi-Quote Opps</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {multipleTotal?.total_opps.toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Win Rate: <span className="font-semibold text-purple-600">{formatResidentialPercent(multipleWinRate)}</span>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Win Rate by Quote Count</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">Quote Options</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opportunities</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Win Rate</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Opp Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Won Value</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Value Win %</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">vs Single</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {QUOTE_COUNT_BUCKET_ORDER.map((bucket) => {
                const metric = quoteCountMetrics?.find((q) => q.quote_count_bucket === bucket);
                return metric ? (
                  <QuoteCountRow
                    key={bucket}
                    metric={metric}
                    baseline={baseline}
                  />
                ) : (
                  <tr key={bucket} className="text-gray-400">
                    <td className="py-3 px-4">{bucket}</td>
                    <td colSpan={7} className="py-3 px-4 text-center">No data</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Win Rate Comparison</h3>
        <div className="flex items-end justify-center gap-12 h-48">
          {quoteCountMetrics?.slice(0, 4).map((metric) => {
            const height = Math.max((metric.win_rate || 0) * 3, 20);
            return (
              <div key={metric.quote_count_bucket} className="flex flex-col items-center">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  {formatResidentialPercent(metric.win_rate)}
                </div>
                <div
                  className={`w-20 rounded-t-lg transition-all duration-500 ${getBarColor(metric.quote_count_bucket)}`}
                  style={{ height: `${height}px` }}
                />
                <div className="text-xs text-gray-700 mt-2 text-center">
                  {metric.quote_count_bucket}
                </div>
                <div className="text-xs text-gray-500">
                  {metric.total_opps.toLocaleString()} opps
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Takeaways */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Strategy Recommendations</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Offering 2-3 options (good/better/best) often increases close rates</li>
          <li>Too many options (4+) can cause decision paralysis</li>
          <li>Single quotes work best when customer needs are clear</li>
          <li>Train salespeople to present options based on customer budget signals</li>
        </ul>
      </div>
    </div>
  );
}

function QuoteCountRow({
  metric,
  baseline,
}: {
  metric: QuoteCountMetrics;
  baseline: number;
}) {
  const isBaseline = metric.quote_count_bucket === '1 quote';
  const diff = (metric.win_rate || 0) - baseline;

  return (
    <tr className={`hover:bg-gray-50 ${isBaseline ? 'bg-blue-50' : ''}`}>
      <td className="py-3 px-4">
        <span className="font-medium text-gray-900">{metric.quote_count_bucket}</span>
        {isBaseline && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
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
      <td className="py-3 px-4 text-right text-gray-600">
        {formatResidentialCurrency(metric.total_value)}
      </td>
      <td className="py-3 px-4 text-right font-medium text-green-600">
        {formatResidentialCurrency(metric.won_value)}
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`font-semibold ${getWinRateColor(metric.value_win_rate)}`}>
          {formatResidentialPercent(metric.value_win_rate)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        {isBaseline ? (
          <span className="text-gray-400">-</span>
        ) : (
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
        )}
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

function getBarColor(bucket: string): string {
  if (bucket === '1 quote') return 'bg-blue-400';
  if (bucket === '2 quotes') return 'bg-purple-400';
  if (bucket === '3 quotes') return 'bg-indigo-400';
  return 'bg-violet-400';
}

function getDiffColor(diff: number): string {
  if (diff > 5) return 'text-green-600';
  if (diff > 0) return 'text-green-500';
  if (diff < -5) return 'text-red-600';
  if (diff < 0) return 'text-amber-600';
  return 'text-gray-500';
}
