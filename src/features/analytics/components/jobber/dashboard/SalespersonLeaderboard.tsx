// Salesperson leaderboard component

import { useSalespersonMetrics } from '../../../hooks/jobber/useSalespersonMetrics';
import { DataTable, type Column } from '../shared/DataTable';
import type { JobberFilters, SalespersonMetrics } from '../../../types/jobber';

interface SalespersonLeaderboardProps {
  filters: JobberFilters;
  onSelectSalesperson: (name: string) => void;
}

export function SalespersonLeaderboard({ filters, onSelectSalesperson }: SalespersonLeaderboardProps) {
  const { data: metrics, isLoading } = useSalespersonMetrics(filters);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const columns: Column<SalespersonMetrics & { rank: number }>[] = [
    {
      key: 'rank',
      header: '#',
      width: '40px',
      render: (row) => (
        <span className={`
          font-bold
          ${row.rank === 1 ? 'text-yellow-600' : ''}
          ${row.rank === 2 ? 'text-gray-400' : ''}
          ${row.rank === 3 ? 'text-orange-600' : ''}
        `}>
          {row.rank}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Salesperson',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-blue-600 hover:text-blue-800">{row.name}</span>
      ),
    },
    {
      key: 'total_revenue',
      header: 'Revenue',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-green-700">{formatCurrency(row.total_revenue)}</span>
      ),
    },
    {
      key: 'substantial_jobs',
      header: 'Jobs >$300',
      sortable: true,
      align: 'right',
      render: (row) => row.substantial_jobs.toLocaleString(),
    },
    {
      key: 'total_jobs',
      header: 'All Jobs',
      sortable: true,
      align: 'right',
      render: (row) => row.total_jobs.toLocaleString(),
    },
    {
      key: 'warranty_jobs',
      header: 'Warranty',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="text-gray-500">{row.warranty_jobs.toLocaleString()}</span>
      ),
    },
    {
      key: 'avg_job_value',
      header: 'Avg Value',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.avg_job_value),
    },
    {
      key: 'avg_total_days',
      header: 'Cycle',
      sortable: true,
      align: 'right',
      render: (row) => row.avg_total_days !== null ? `${row.avg_total_days.toFixed(0)}d` : '-',
    },
  ];

  // Add rank to data
  const rankedData = (metrics || []).map((m, i) => ({ ...m, rank: i + 1 }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Salesperson Leaderboard</h3>
        <span className="text-sm text-gray-500">{rankedData.length} salespeople</span>
      </div>

      <DataTable
        columns={columns}
        data={rankedData}
        keyField="name"
        onRowClick={(row) => onSelectSalesperson(row.name)}
        loading={isLoading}
        pageSize={15}
        emptyMessage="No salesperson data available"
      />
    </div>
  );
}
