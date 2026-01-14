// Monthly trend chart component

import { useMemo } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { useMonthlyTrend } from '../../../hooks/jobber/useSalespersonMetrics';
import type { JobberFilters } from '../../../types/jobber';

interface MonthlyTrendChartProps {
  filters: JobberFilters;
  onMonthClick?: (month: string) => void;
}

export function MonthlyTrendChart({ filters, onMonthClick }: MonthlyTrendChartProps) {
  const { data: trend, isLoading } = useMonthlyTrend(
    12,
    filters.salesperson,
    filters.location
  );

  const chartData = useMemo(() => {
    return (trend || []).map(t => ({
      ...t,
      revenue: t.revenue,
      revenueK: t.revenue / 1000, // For display
      jobs: t.total_jobs,
    }));
  }, [trend]);

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available for the selected period
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue Trend</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            onClick={(e) => {
              if (e?.activeLabel && onMonthClick) {
                const monthData = chartData.find(d => d.label === e.activeLabel);
                if (monthData) onMonthClick(monthData.month);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
                return [value.toLocaleString(), name];
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name="Revenue"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="jobs"
              name="Jobs"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ fill: '#10B981', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats below chart */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="text-sm text-gray-500">Total Revenue</div>
          <div className="text-lg font-semibold text-gray-900">
            ${chartData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">Total Jobs</div>
          <div className="text-lg font-semibold text-gray-900">
            {chartData.reduce((sum, d) => sum + d.jobs, 0).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">Avg Monthly</div>
          <div className="text-lg font-semibold text-gray-900">
            ${(chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  );
}
