// Project type breakdown component - Table format

import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useJobberJobs } from '../../../hooks/jobber/useJobberJobs';
import type { JobberFilters } from '../../../types/jobber';

interface ProjectTypeBreakdownProps {
  filters: JobberFilters;
}

export function ProjectTypeBreakdown({ filters }: ProjectTypeBreakdownProps) {
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const { typeData, totals } = useMemo(() => {
    if (!jobs) return { typeData: [], totals: null };

    const typeMap = new Map<string, {
      revenue: number;
      jobs: number;
      warrantyJobs: number;
      standardJobs: number;
      smallJobs: number;
    }>();

    let totalRevenue = 0;
    let totalJobs = 0;
    let totalWarranty = 0;
    let totalStandard = 0;
    let totalSmall = 0;

    for (const job of jobs) {
      // Normalize project type
      let type = job.project_type || 'Unknown';

      // Categorize based on common patterns
      if (type.toLowerCase().includes('fence') || type.toLowerCase().includes('wood') || type.toLowerCase().includes('chain link') || type.toLowerCase().includes('iron')) {
        type = 'Fence +';
      } else if (type.toLowerCase().includes('deck')) {
        type = 'Deck ONLY';
      } else if (type.toLowerCase().includes('railing') || type.toLowerCase().includes('rail')) {
        type = 'Railing ONLY';
      } else if (type.toLowerCase().includes('warranty')) {
        type = 'Warranty';
      } else if (type.toLowerCase().includes('service') || type.toLowerCase().includes('repair')) {
        type = 'Services/Repairs';
      } else if (type === 'Unknown' || !type) {
        type = 'Other';
      }

      const revenue = Number(job.total_revenue) || 0;
      totalRevenue += revenue;
      totalJobs++;

      // Categorize job size
      const isStandard = revenue > 500;
      const isSmall = revenue > 0 && revenue <= 500;
      const isWarranty = revenue === 0;

      if (isWarranty) totalWarranty++;
      if (isStandard) totalStandard++;
      if (isSmall) totalSmall++;

      const existing = typeMap.get(type) || {
        revenue: 0,
        jobs: 0,
        warrantyJobs: 0,
        standardJobs: 0,
        smallJobs: 0,
      };
      existing.revenue += revenue;
      existing.jobs++;
      if (isWarranty) existing.warrantyJobs++;
      if (isStandard) existing.standardJobs++;
      if (isSmall) existing.smallJobs++;
      typeMap.set(type, existing);
    }

    const typeData = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        revenue: data.revenue,
        jobs: data.jobs,
        standardJobs: data.standardJobs,
        smallJobs: data.smallJobs,
        warrantyJobs: data.warrantyJobs,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        warrantyRate: data.jobs > 0 ? (data.warrantyJobs / data.jobs) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totals = {
      revenue: totalRevenue,
      jobs: totalJobs,
      standardJobs: totalStandard,
      smallJobs: totalSmall,
      warrantyJobs: totalWarranty,
      warrantyRate: totalJobs > 0 ? (totalWarranty / totalJobs) * 100 : 0,
    };

    return { typeData, totals };
  }, [jobs]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Type Breakdown</h3>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Project Type Breakdown</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Revenue</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">%</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700" title="Jobs over $500">Std</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700" title="Jobs $1-500">Small</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700" title="Jobs at $0">Warr</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-700">% Warr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {typeData.map((item, idx) => (
              <tr key={item.type} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 font-medium text-gray-900">{item.type}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-700">
                  {formatCurrency(item.revenue)}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{item.percentage.toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{item.standardJobs}</td>
                <td className="px-3 py-2 text-right text-gray-600">{item.smallJobs}</td>
                <td className="px-3 py-2 text-right text-gray-500">{item.warrantyJobs}</td>
                <td className="px-3 py-2 text-right font-medium">{item.jobs}</td>
                <td className="px-3 py-2 text-right">
                  <span className={item.warrantyRate > 20 ? 'text-red-600' : 'text-gray-500'}>
                    {item.warrantyRate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            {totals && (
              <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                <td className="px-3 py-2 text-gray-900">TOTAL</td>
                <td className="px-3 py-2 text-right text-blue-700">{formatCurrency(totals.revenue)}</td>
                <td className="px-3 py-2 text-right">100%</td>
                <td className="px-3 py-2 text-right">{totals.standardJobs}</td>
                <td className="px-3 py-2 text-right">{totals.smallJobs}</td>
                <td className="px-3 py-2 text-right">{totals.warrantyJobs}</td>
                <td className="px-3 py-2 text-right">{totals.jobs}</td>
                <td className="px-3 py-2 text-right">{totals.warrantyRate.toFixed(1)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {typeData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No project type data available for the selected filters
        </div>
      )}
    </div>
  );
}
