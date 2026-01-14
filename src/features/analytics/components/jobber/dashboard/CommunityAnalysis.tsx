// Community analysis component

import { useCommunityMetrics } from '../../../hooks/jobber/useClientMetrics';
import { DataTable, type Column } from '../shared/DataTable';
import type { JobberFilters } from '../../../types/jobber';

interface CommunityMetric {
  community: string;
  revenue: number;
  jobs: number;
  avg_job_value: number;
  primary_builders: string[];
  primary_salespersons: string[];
}

interface CommunityAnalysisProps {
  filters: JobberFilters;
}

export function CommunityAnalysis({ filters }: CommunityAnalysisProps) {
  const { data: communities, isLoading } = useCommunityMetrics(filters, 20);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const columns: Column<CommunityMetric & { rank: number }>[] = [
    {
      key: 'rank',
      header: '#',
      width: '40px',
      render: (row) => <span className="text-gray-400">{row.rank}</span>,
    },
    {
      key: 'community',
      header: 'Community',
      render: (row) => <span className="font-medium">{row.community}</span>,
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
      key: 'avg_job_value',
      header: 'Avg Value',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.avg_job_value),
    },
    {
      key: 'primary_builders',
      header: 'Builders',
      render: (row) => (
        <div className="text-sm text-gray-600 max-w-[200px] truncate" title={row.primary_builders.join(', ')}>
          {row.primary_builders.join(', ') || '-'}
        </div>
      ),
    },
    {
      key: 'primary_salespersons',
      header: 'Salespeople',
      render: (row) => (
        <div className="text-sm text-gray-600 max-w-[150px] truncate" title={row.primary_salespersons.join(', ')}>
          {row.primary_salespersons.join(', ') || '-'}
        </div>
      ),
    },
  ];

  // Add rank to data
  const rankedData = (communities || []).map((c, i) => ({ ...c, rank: i + 1 }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 20 Communities</h3>
        <span className="text-sm text-gray-500">{rankedData.length} communities</span>
      </div>

      <DataTable
        columns={columns}
        data={rankedData}
        keyField="community"
        loading={isLoading}
        showPagination={false}
        compact
        emptyMessage="No community data available"
      />
    </div>
  );
}
