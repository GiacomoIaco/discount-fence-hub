// Client (Builder) analysis component

import { useClientMetrics } from '../../../hooks/jobber/useClientMetrics';
import { DataTable, type Column } from '../shared/DataTable';
import type { JobberFilters, ClientMetrics } from '../../../types/jobber';

interface ClientAnalysisProps {
  filters: JobberFilters;
  onSelectClient: (clientName: string) => void;
}

export function ClientAnalysis({ filters, onSelectClient }: ClientAnalysisProps) {
  const { data: clients, isLoading } = useClientMetrics(filters, 20);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const columns: Column<ClientMetrics & { rank: number }>[] = [
    {
      key: 'rank',
      header: '#',
      width: '40px',
      render: (row) => <span className="text-gray-400">{row.rank}</span>,
    },
    {
      key: 'client_name',
      header: 'Builder',
      render: (row) => (
        <span className="font-medium text-blue-600 hover:text-blue-800">{row.client_name}</span>
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
      key: 'total_jobs',
      header: 'Jobs',
      sortable: true,
      align: 'right',
      render: (row) => row.total_jobs.toLocaleString(),
    },
    {
      key: 'avg_job_value',
      header: 'Avg Value',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.avg_job_value),
    },
    {
      key: 'warranty_jobs',
      header: 'Warranty',
      sortable: true,
      align: 'right',
      render: (row) => {
        const rate = row.total_jobs > 0 ? (row.warranty_jobs / row.total_jobs) * 100 : 0;
        return (
          <span className={rate > 25 ? 'text-red-600' : rate > 15 ? 'text-yellow-600' : 'text-gray-500'}>
            {row.warranty_jobs} ({rate.toFixed(0)}%)
          </span>
        );
      },
    },
    {
      key: 'avg_cycle_days',
      header: 'Cycle',
      sortable: true,
      align: 'right',
      render: (row) => row.avg_cycle_days !== null ? `${row.avg_cycle_days.toFixed(0)}d` : '-',
    },
  ];

  // Add rank to data
  const rankedData = (clients || []).map((c, i) => ({ ...c, rank: i + 1 }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 20 Builders</h3>
        <span className="text-sm text-gray-500">Click row to drill down</span>
      </div>

      <DataTable
        columns={columns}
        data={rankedData}
        keyField="client_name"
        onRowClick={(row) => onSelectClient(row.client_name)}
        loading={isLoading}
        showPagination={false}
        emptyMessage="No client data available"
      />
    </div>
  );
}
