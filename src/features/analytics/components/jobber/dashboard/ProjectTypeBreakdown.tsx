// Project type breakdown component

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useJobberJobs } from '../../../hooks/jobber/useJobberJobs';
import type { JobberFilters } from '../../../types/jobber';

interface ProjectTypeBreakdownProps {
  filters: JobberFilters;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function ProjectTypeBreakdown({ filters }: ProjectTypeBreakdownProps) {
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const typeData = useMemo(() => {
    if (!jobs) return [];

    const typeMap = new Map<string, {
      revenue: number;
      jobs: number;
      warrantyJobs: number;
    }>();

    let totalRevenue = 0;

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

      const existing = typeMap.get(type) || { revenue: 0, jobs: 0, warrantyJobs: 0 };
      existing.revenue += revenue;
      existing.jobs++;
      if (job.is_warranty) existing.warrantyJobs++;
      typeMap.set(type, existing);
    }

    return Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        revenue: data.revenue,
        jobs: data.jobs,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        warrantyRate: data.jobs > 0 ? (data.warrantyJobs / data.jobs) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [jobs]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Type Breakdown</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={typeData.slice(0, 6)}
                dataKey="revenue"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => `${entry.name}: ${((entry.percent || 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {typeData.slice(0, 6).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="space-y-2">
          {typeData.map((item, index) => (
            <div
              key={item.type}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium">{item.type}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-700 font-semibold">{formatCurrency(item.revenue)}</span>
                <span className="text-gray-500">{item.jobs} jobs</span>
                <span className="text-gray-400">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
