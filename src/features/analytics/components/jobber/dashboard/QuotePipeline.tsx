// Quote pipeline component

import { useQuoteStatusMetrics, useQuoteConversionMetrics } from '../../../hooks/jobber/useJobberQuotes';
import type { JobberFilters } from '../../../types/jobber';

interface QuotePipelineProps {
  filters: JobberFilters;
}

export function QuotePipeline({ filters }: QuotePipelineProps) {
  const { data: statusMetrics, isLoading: statusLoading } = useQuoteStatusMetrics(filters);
  const { data: conversionMetrics, isLoading: conversionLoading } = useQuoteConversionMetrics(filters);

  const isLoading = statusLoading || conversionLoading;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Status color mapping
  const statusColors: Record<string, string> = {
    'Draft': 'bg-gray-100 border-gray-300 text-gray-700',
    'Awaiting response': 'bg-yellow-50 border-yellow-300 text-yellow-700',
    'Approved': 'bg-green-50 border-green-300 text-green-700',
    'Converted': 'bg-blue-50 border-blue-300 text-blue-700',
    'Archived': 'bg-red-50 border-red-300 text-red-700',
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Pipeline</h3>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Pipeline</h3>

      {/* Conversion Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-700">
            {(conversionMetrics?.conversionRate || 0).toFixed(1)}%
          </div>
          <div className="text-sm text-blue-600">Conversion Rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-700">
            {(conversionMetrics?.avgDaysToConvert || 0).toFixed(1)}
          </div>
          <div className="text-sm text-blue-600">Avg Days to Convert</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-700">
            {(conversionMetrics?.medianDaysToConvert || 0).toFixed(0)}
          </div>
          <div className="text-sm text-blue-600">Median Days</div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="space-y-3">
        {(statusMetrics || []).map((status) => {
          const colorClass = statusColors[status.status] || 'bg-gray-50 border-gray-200 text-gray-600';

          return (
            <div
              key={status.status}
              className={`flex items-center justify-between p-3 border rounded-lg ${colorClass}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{status.status}</span>
                <span className="text-sm opacity-75">{status.count} quotes</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{formatCurrency(status.value)}</span>
                <div className="w-20">
                  <div className="w-full bg-white/50 rounded-full h-2">
                    <div
                      className="bg-current h-2 rounded-full opacity-50"
                      style={{ width: `${Math.min(status.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm w-12 text-right">{status.percentage.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
