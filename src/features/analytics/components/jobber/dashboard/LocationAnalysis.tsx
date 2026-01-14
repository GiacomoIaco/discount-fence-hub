// Location (franchise) analysis component

import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { useJobberJobs } from '../../../hooks/jobber/useJobberJobs';
import { DataTable, type Column } from '../shared/DataTable';
import type { JobberFilters, LocationMetrics } from '../../../types/jobber';

interface LocationAnalysisProps {
  filters: JobberFilters;
  onSelectLocation: (location: string) => void;
}

export function LocationAnalysis({ filters, onSelectLocation }: LocationAnalysisProps) {
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const locationData = useMemo((): LocationMetrics[] => {
    if (!jobs) return [];

    const locationMap = new Map<string, {
      revenue: number;
      jobs: number;
      cycleDays: number[];
    }>();

    let totalRevenue = 0;

    for (const job of jobs) {
      const location = job.franchise_location || 'Unknown';
      const revenue = Number(job.total_revenue) || 0;
      totalRevenue += revenue;

      const existing = locationMap.get(location) || { revenue: 0, jobs: 0, cycleDays: [] };
      existing.revenue += revenue;
      existing.jobs++;
      if (job.total_cycle_days !== null && job.total_cycle_days >= 0) {
        existing.cycleDays.push(job.total_cycle_days);
      }
      locationMap.set(location, existing);
    }

    return Array.from(locationMap.entries())
      .filter(([loc]) => loc !== 'Unknown')
      .map(([location, data]) => ({
        location,
        revenue: data.revenue,
        jobs: data.jobs,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        avg_value: data.jobs > 0 ? data.revenue / data.jobs : 0,
        avg_cycle: data.cycleDays.length > 0
          ? data.cycleDays.reduce((a, b) => a + b, 0) / data.cycleDays.length
          : null,
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

  const columns: Column<LocationMetrics>[] = [
    {
      key: 'location',
      header: 'Location',
      render: (row) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{row.location}</span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-green-700">{formatCurrency(row.revenue)}</span>
      ),
    },
    {
      key: 'jobs',
      header: 'Jobs',
      sortable: true,
      align: 'right',
      render: (row) => row.jobs.toLocaleString(),
    },
    {
      key: 'percentage',
      header: '% of Total',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(row.percentage, 100)}%` }}
            />
          </div>
          <span className="w-12 text-right">{row.percentage.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'avg_value',
      header: 'Avg Value',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.avg_value),
    },
    {
      key: 'avg_cycle',
      header: 'Cycle',
      sortable: true,
      align: 'right',
      render: (row) => row.avg_cycle !== null ? `${row.avg_cycle.toFixed(1)}d` : '-',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Analysis</h3>

      <DataTable
        columns={columns}
        data={locationData}
        keyField="location"
        onRowClick={(row) => onSelectLocation(row.location)}
        loading={isLoading}
        showPagination={false}
        emptyMessage="No location data available"
      />

      {locationData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          Note: Houston started operations mid-2025
        </div>
      )}
    </div>
  );
}
