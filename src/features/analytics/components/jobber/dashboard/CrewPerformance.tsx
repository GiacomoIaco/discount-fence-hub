// Crew performance component

import { useMemo } from 'react';
import { useJobberJobs } from '../../../hooks/jobber/useJobberJobs';
import { DataTable, type Column } from '../shared/DataTable';
import type { JobberFilters, CrewMetrics } from '../../../types/jobber';

interface CrewPerformanceProps {
  filters: JobberFilters;
}

export function CrewPerformance({ filters }: CrewPerformanceProps) {
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const crewData = useMemo((): CrewMetrics[] => {
    if (!jobs) return [];

    const crewMap = new Map<string, { jobs: number; totalPay: number }>();

    for (const job of jobs) {
      // Process each crew slot
      const crews = [
        { name: job.crew_1, pay: Number(job.crew_1_pay) || 0 },
        { name: job.crew_2, pay: Number(job.crew_2_pay) || 0 },
        { name: job.crew_3, pay: Number(job.crew_3_pay) || 0 },
      ];

      for (const crew of crews) {
        if (!crew.name) continue;

        const existing = crewMap.get(crew.name) || { jobs: 0, totalPay: 0 };
        existing.jobs++;
        existing.totalPay += crew.pay;
        crewMap.set(crew.name, existing);
      }
    }

    return Array.from(crewMap.entries())
      .map(([crew_name, data]) => ({
        crew_name,
        jobs: data.jobs,
        total_pay: data.totalPay,
        avg_pay: data.jobs > 0 ? data.totalPay / data.jobs : 0,
      }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 15);
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

  const totalCrewPay = crewData.reduce((sum, c) => sum + c.total_pay, 0);
  const avgPayPerJob = crewData.length > 0
    ? crewData.reduce((sum, c) => sum + c.avg_pay, 0) / crewData.length
    : 0;

  const columns: Column<CrewMetrics & { rank: number }>[] = [
    {
      key: 'rank',
      header: '#',
      width: '40px',
      render: (row) => <span className="text-gray-400">{row.rank}</span>,
    },
    {
      key: 'crew_name',
      header: 'Crew',
      render: (row) => <span className="font-medium">{row.crew_name}</span>,
    },
    {
      key: 'jobs',
      header: 'Jobs',
      sortable: true,
      align: 'right',
      render: (row) => row.jobs.toLocaleString(),
    },
    {
      key: 'avg_pay',
      header: 'Avg Pay',
      sortable: true,
      align: 'right',
      render: (row) => formatCurrency(row.avg_pay),
    },
    {
      key: 'total_pay',
      header: 'Total Pay',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-green-700">{formatCurrency(row.total_pay)}</span>
      ),
    },
  ];

  // Add rank to data
  const rankedData = crewData.map((c, i) => ({ ...c, rank: i + 1 }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Crew Performance</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div>
          <div className="text-sm text-gray-500">Total Crew Pay</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalCrewPay)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Avg Pay per Job</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(avgPayPerJob)}</div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rankedData}
        keyField="crew_name"
        loading={isLoading}
        showPagination={false}
        compact
        emptyMessage="No crew data available"
      />
    </div>
  );
}
