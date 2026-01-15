// Salesperson leaderboard component - Enhanced with new columns and totals row

import { useMemo } from 'react';
import { useSalespersonMetrics } from '../../../hooks/jobber/useSalespersonMetrics';
import type { JobberFilters } from '../../../types/jobber';

interface SalespersonLeaderboardProps {
  filters: JobberFilters;
  onSelectSalesperson: (name: string) => void;
}

export function SalespersonLeaderboard({ filters, onSelectSalesperson }: SalespersonLeaderboardProps) {
  const { data: metrics, isLoading } = useSalespersonMetrics(filters);

  // Calculate totals row
  const totals = useMemo(() => {
    if (!metrics?.length) return null;

    const totalRevenue = metrics.reduce((sum, m) => sum + m.total_revenue, 0);
    const totalJobs = metrics.reduce((sum, m) => sum + m.total_jobs, 0);
    const totalSubstantial = metrics.reduce((sum, m) => sum + m.substantial_jobs, 0);
    const totalSmall = metrics.reduce((sum, m) => sum + m.small_jobs, 0);
    const totalWarranty = metrics.reduce((sum, m) => sum + m.warranty_jobs, 0);

    // Calculate weighted averages for cycle times
    const scheduleDaysData = metrics.filter(m => m.avg_days_to_schedule !== null);
    const closeDaysData = metrics.filter(m => m.avg_days_to_close !== null);
    const cycleDaysData = metrics.filter(m => m.avg_total_days !== null);

    return {
      total_revenue: totalRevenue,
      total_jobs: totalJobs,
      substantial_jobs: totalSubstantial,
      small_jobs: totalSmall,
      warranty_jobs: totalWarranty,
      warranty_percent: totalJobs > 0 ? (totalWarranty / totalJobs) * 100 : 0,
      avg_job_value: totalSubstantial > 0 ? totalRevenue / totalSubstantial : 0,
      avg_days_to_schedule: scheduleDaysData.length > 0
        ? scheduleDaysData.reduce((sum, m) => sum + (m.avg_days_to_schedule || 0), 0) / scheduleDaysData.length
        : null,
      avg_days_to_close: closeDaysData.length > 0
        ? closeDaysData.reduce((sum, m) => sum + (m.avg_days_to_close || 0), 0) / closeDaysData.length
        : null,
      avg_total_days: cycleDaysData.length > 0
        ? cycleDaysData.reduce((sum, m) => sum + (m.avg_total_days || 0), 0) / cycleDaysData.length
        : null,
    };
  }, [metrics]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDays = (value: number | null) => {
    if (value === null) return '-';
    return `${value.toFixed(0)}d`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Salesperson Leaderboard</h3>
        <div className="h-96 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Salesperson Leaderboard</h3>
        <span className="text-sm text-gray-500">{metrics?.length || 0} salespeople</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-3 text-left font-semibold text-gray-700 w-10">#</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-700 min-w-[140px]">Salesperson</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">Revenue</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Jobs over $500">Jobs &gt;$500</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Jobs $1-500">Small</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Jobs at $0">Warranty</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700">Total</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Warranty percentage">% Warr</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Average job value">Avg Value</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Days from create to schedule">Create→Sched</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Days from schedule to close">Sched→Close</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-700" title="Total cycle time">Cycle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(metrics || []).map((row, idx) => (
              <tr
                key={row.name}
                onClick={() => onSelectSalesperson(row.name)}
                className={`cursor-pointer hover:bg-blue-50 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-2 py-2">
                  <span className={`font-bold ${
                    idx === 0 ? 'text-yellow-600' :
                    idx === 1 ? 'text-gray-400' :
                    idx === 2 ? 'text-orange-600' : 'text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium text-blue-600 hover:text-blue-800">{row.name}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-semibold text-green-700">{formatCurrency(row.total_revenue ?? 0)}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium">{(row.substantial_jobs ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-600">{(row.small_jobs ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-500">{(row.warranty_jobs ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{(row.total_jobs ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <span className={(row.warranty_percent ?? 0) > 20 ? 'text-red-600' : 'text-gray-600'}>
                    {(row.warranty_percent ?? 0).toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{formatCurrency(row.avg_job_value ?? 0)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatDays(row.avg_days_to_schedule)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatDays(row.avg_days_to_close)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={
                    row.avg_total_days !== null && row.avg_total_days > 30 ? 'text-orange-600 font-medium' : 'text-gray-600'
                  }>
                    {formatDays(row.avg_total_days)}
                  </span>
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            {totals && (
              <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                <td className="px-2 py-3"></td>
                <td className="px-3 py-3 text-gray-900">TOTALS / AVG</td>
                <td className="px-3 py-3 text-right text-blue-700">{formatCurrency(totals.total_revenue)}</td>
                <td className="px-3 py-3 text-right">{totals.substantial_jobs.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{totals.small_jobs.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{totals.warranty_jobs.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{totals.total_jobs.toLocaleString()}</td>
                <td className="px-3 py-3 text-right">{totals.warranty_percent.toFixed(1)}%</td>
                <td className="px-3 py-3 text-right">{formatCurrency(totals.avg_job_value)}</td>
                <td className="px-3 py-3 text-right text-blue-600">{formatDays(totals.avg_days_to_schedule)}</td>
                <td className="px-3 py-3 text-right text-blue-600">{formatDays(totals.avg_days_to_close)}</td>
                <td className="px-3 py-3 text-right text-blue-600">{formatDays(totals.avg_total_days)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(!metrics || metrics.length === 0) && (
        <div className="text-center py-8 text-gray-500">
          No salesperson data available for the selected filters
        </div>
      )}
    </div>
  );
}
