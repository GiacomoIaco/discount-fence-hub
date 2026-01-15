// Monthly trend chart component with bar labels and YoY growth

import { useMemo } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, LabelList } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMonthlyTrend } from '../../../hooks/jobber/useSalespersonMetrics';
import type { JobberFilters, DateFieldType } from '../../../types/jobber';

interface MonthlyTrendChartProps {
  filters: JobberFilters;
  onMonthClick?: (month: string) => void;
}

export function MonthlyTrendChart({ filters, onMonthClick }: MonthlyTrendChartProps) {
  // Override date range to always show last 15 months for trend visualization
  // Keep salesperson, location, and job size filters
  const chartFilters = useMemo(() => {
    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
    fifteenMonthsAgo.setDate(1); // Start of month

    return {
      ...filters,
      dateRange: {
        start: fifteenMonthsAgo,
        end: new Date(),
      },
      dateField: 'created_date' as DateFieldType, // Always use created_date for trend analysis
    };
  }, [filters]);

  const { data: trend, isLoading } = useMonthlyTrend(chartFilters);

  const { chartData, yoyGrowth, periodStats } = useMemo(() => {
    const data = (trend || []).map(t => ({
      ...t,
      revenue: t.revenue,
      revenueK: t.revenue / 1000, // For display
      jobs: t.total_jobs,
    }));

    // Calculate YoY growth if we have at least 12 months of data
    let yoyGrowth: { revenue: number | null; jobs: number | null } = { revenue: null, jobs: null };

    if (data.length >= 12) {
      const currentYearData = data.slice(-6);
      const priorYearData = data.slice(-12, -6);

      const currentRevenue = currentYearData.reduce((sum, d) => sum + d.revenue, 0);
      const priorRevenue = priorYearData.reduce((sum, d) => sum + d.revenue, 0);
      const currentJobs = currentYearData.reduce((sum, d) => sum + d.jobs, 0);
      const priorJobs = priorYearData.reduce((sum, d) => sum + d.jobs, 0);

      if (priorRevenue > 0) {
        yoyGrowth.revenue = ((currentRevenue - priorRevenue) / priorRevenue) * 100;
      }
      if (priorJobs > 0) {
        yoyGrowth.jobs = ((currentJobs - priorJobs) / priorJobs) * 100;
      }
    }

    // Period stats - use last 12 months for summary
    const last12Months = data.slice(-12);
    const totalRevenue = last12Months.reduce((sum, d) => sum + d.revenue, 0);
    const totalJobs = last12Months.reduce((sum, d) => sum + d.jobs, 0);
    const avgMonthly = last12Months.length > 0 ? totalRevenue / last12Months.length : 0;
    const monthCount = last12Months.length;

    return {
      chartData: data,
      yoyGrowth,
      periodStats: { totalRevenue, totalJobs, avgMonthly, monthCount },
    };
  }, [trend]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatBarLabel = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
  };

  const renderGrowthIndicator = (value: number | null, label: string) => {
    if (value === null) return null;

    const isPositive = value > 0;
    const isNeutral = Math.abs(value) < 1;

    return (
      <div className={`flex items-center gap-1 ${
        isNeutral ? 'text-gray-500' :
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isNeutral ? (
          <Minus className="w-4 h-4" />
        ) : isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span className="font-semibold">{isPositive ? '+' : ''}{value.toFixed(1)}%</span>
        <span className="text-xs text-gray-500">YoY {label}</span>
      </div>
    );
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue Trend</h3>

        {/* YoY Growth Indicators */}
        <div className="flex gap-4">
          {renderGrowthIndicator(yoyGrowth.revenue, 'Revenue')}
          {renderGrowthIndicator(yoyGrowth.jobs, 'Jobs')}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 25, right: 30, left: 20, bottom: 5 }}
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
            >
              {/* Bar Labels */}
              <LabelList
                dataKey="revenue"
                position="top"
                formatter={(value: unknown) => formatBarLabel(Number(value))}
                fill="#374151"
                fontSize={10}
              />
            </Bar>
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

      {/* Summary stats below chart - Last 12 months */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500 mb-2 text-center">
          Last {periodStats.monthCount} Month{periodStats.monthCount !== 1 ? 's' : ''} Summary
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">Total Revenue</div>
            <div className="text-lg font-semibold text-gray-900">
              ${periodStats.totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Total Jobs</div>
            <div className="text-lg font-semibold text-gray-900">
              {periodStats.totalJobs.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Avg Monthly</div>
            <div className="text-lg font-semibold text-gray-900">
              ${periodStats.avgMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
