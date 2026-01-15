// Trends Analysis - 12-week/month table by salesperson and client

import { useState, useMemo } from 'react';
import { TrendingUp, Users, Building2, Calendar } from 'lucide-react';
import { useJobberJobs } from '../../../hooks/jobber';
import type { JobberFilters } from '../../../types/jobber';

interface TrendsAnalysisProps {
  filters: JobberFilters;
}

type ViewMode = 'weekly' | 'monthly';
type GroupBy = 'salesperson' | 'client';

interface PeriodData {
  key: string;
  label: string;
  revenue: number;
  jobs: number;
}

interface EntityTrend {
  name: string;
  periods: Map<string, PeriodData>;
  totalRevenue: number;
  totalJobs: number;
}

export function TrendsAnalysis({ filters }: TrendsAnalysisProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [groupBy, setGroupBy] = useState<GroupBy>('salesperson');

  // Fetch all jobs, we'll do period grouping client-side
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const { periods, entityTrends, totalsRow } = useMemo(() => {
    if (!jobs?.length) return { periods: [], entityTrends: [], totalsRow: null };

    // Generate period keys for the last 12 periods
    const periodCount = 12;
    const periods: { key: string; label: string }[] = [];
    const now = new Date();

    if (viewMode === 'weekly') {
      // Generate last 12 weeks
      for (let i = periodCount - 1; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay() + 1); // Monday
        const key = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, '0')}`;
        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        periods.push({ key, label });
      }
    } else {
      // Generate last 12 months
      for (let i = periodCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        periods.push({ key, label });
      }
    }

    // Group jobs by entity and period
    const entityMap = new Map<string, EntityTrend>();
    const periodTotals = new Map<string, { revenue: number; jobs: number }>();

    // Initialize period totals
    periods.forEach(p => periodTotals.set(p.key, { revenue: 0, jobs: 0 }));

    for (const job of jobs) {
      if (!job.created_date) continue;

      const entityName = groupBy === 'salesperson'
        ? (job.effective_salesperson || '(Unassigned)')
        : (job.client_name || 'Unknown');

      if (entityName === '(Unassigned)' || entityName === 'Unknown') continue;

      const date = new Date(job.created_date);
      let periodKey: string;

      if (viewMode === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        periodKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + 6) / 7)).padStart(2, '0')}`;
      } else {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      // Only include if period is in our range
      if (!periods.some(p => p.key === periodKey)) continue;

      const revenue = Number(job.total_revenue) || 0;

      // Update entity data
      if (!entityMap.has(entityName)) {
        entityMap.set(entityName, {
          name: entityName,
          periods: new Map(),
          totalRevenue: 0,
          totalJobs: 0,
        });
      }

      const entity = entityMap.get(entityName)!;
      entity.totalRevenue += revenue;
      entity.totalJobs++;

      if (!entity.periods.has(periodKey)) {
        entity.periods.set(periodKey, { key: periodKey, label: '', revenue: 0, jobs: 0 });
      }
      const periodData = entity.periods.get(periodKey)!;
      periodData.revenue += revenue;
      periodData.jobs++;

      // Update period totals
      const totals = periodTotals.get(periodKey);
      if (totals) {
        totals.revenue += revenue;
        totals.jobs++;
      }
    }

    // Convert to sorted array (top 15 by total revenue)
    const entityTrends = Array.from(entityMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 15);

    // Create totals row
    const totalsRow = {
      name: 'TOTAL',
      periods: periodTotals,
      totalRevenue: Array.from(periodTotals.values()).reduce((sum, p) => sum + p.revenue, 0),
      totalJobs: Array.from(periodTotals.values()).reduce((sum, p) => sum + p.jobs, 0),
    };

    return { periods, entityTrends, totalsRow };
  }, [jobs, viewMode, groupBy]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trends Analysis</h3>
        <div className="h-96 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {viewMode === 'weekly' ? '12-Week' : '12-Month'} Trends by {groupBy === 'salesperson' ? 'Salesperson' : 'Client'}
          </h3>
        </div>

        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Monthly
            </button>
          </div>

          {/* Group By Toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setGroupBy('salesperson')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                groupBy === 'salesperson'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Salesperson
            </button>
            <button
              onClick={() => setGroupBy('client')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                groupBy === 'client'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-1" />
              Client
            </button>
          </div>
        </div>
      </div>

      {/* Trends Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[150px]">
                {groupBy === 'salesperson' ? 'Salesperson' : 'Client'}
              </th>
              {periods.map(p => (
                <th key={p.key} className="px-2 py-2 text-center font-medium text-gray-600 min-w-[80px]">
                  {p.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-gray-700 bg-gray-100 min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entityTrends.map((entity, idx) => (
              <tr key={entity.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-inherit">
                  {entity.name}
                </td>
                {periods.map(p => {
                  const periodData = entity.periods.get(p.key);
                  const hasData = periodData && periodData.revenue > 0;
                  return (
                    <td key={p.key} className="px-2 py-2 text-center">
                      {hasData ? (
                        <div>
                          <div className="font-medium text-gray-900">{formatCurrency(periodData.revenue)}</div>
                          <div className="text-xs text-gray-500">{periodData.jobs} jobs</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right bg-gray-100">
                  <div className="font-semibold text-gray-900">{formatCurrency(entity.totalRevenue)}</div>
                  <div className="text-xs text-gray-500">{entity.totalJobs} jobs</div>
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            {totalsRow && (
              <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                <td className="px-3 py-3 text-gray-900 sticky left-0 bg-blue-50">
                  TOTAL
                </td>
                {periods.map(p => {
                  const periodData = totalsRow.periods.get(p.key);
                  return (
                    <td key={p.key} className="px-2 py-3 text-center">
                      {periodData && periodData.revenue > 0 ? (
                        <div>
                          <div className="text-blue-700">{formatCurrency(periodData.revenue)}</div>
                          <div className="text-xs text-blue-500">{periodData.jobs}</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right bg-blue-100">
                  <div className="text-blue-800">{formatCurrency(totalsRow.totalRevenue)}</div>
                  <div className="text-xs text-blue-600">{totalsRow.totalJobs} jobs</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {entityTrends.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No data available for the selected filters
        </div>
      )}
    </div>
  );
}
