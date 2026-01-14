// QBO Sync status component

import { useMemo } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useJobberJobs } from '../../../hooks/jobber/useJobberJobs';
import type { JobberFilters, QBOSyncMetrics } from '../../../types/jobber';

interface QBOSyncStatusProps {
  filters: JobberFilters;
}

export function QBOSyncStatus({ filters }: QBOSyncStatusProps) {
  const { data: jobs, isLoading } = useJobberJobs({ filters });

  const syncData = useMemo((): QBOSyncMetrics[] => {
    if (!jobs) return [];

    const statusMap = new Map<string, { jobs: number; revenue: number }>();

    for (const job of jobs) {
      const status = job.on_qbo || 'Not Started';
      const revenue = Number(job.total_revenue) || 0;

      const existing = statusMap.get(status) || { jobs: 0, revenue: 0 };
      existing.jobs++;
      existing.revenue += revenue;
      statusMap.set(status, existing);
    }

    return Array.from(statusMap.entries())
      .map(([status, data]) => ({ status, ...data }))
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

  const getStatusIcon = (status: string) => {
    if (status.includes('Material') && status.includes('Crew')) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (status.includes('Only')) {
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
    if (status === 'Unable to Complete') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <RefreshCw className="w-5 h-5 text-gray-400" />;
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Material') && status.includes('Crew')) {
      return 'bg-green-50 border-green-200';
    }
    if (status.includes('Only')) {
      return 'bg-yellow-50 border-yellow-200';
    }
    if (status === 'Unable to Complete') {
      return 'bg-red-50 border-red-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  // Calculate overall sync rate
  const totalJobs = syncData.reduce((sum, s) => sum + s.jobs, 0);
  const fullySynced = syncData.find(s => s.status.includes('Material') && s.status.includes('Crew'));
  const syncRate = totalJobs > 0 && fullySynced ? (fullySynced.jobs / totalJobs) * 100 : 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">QBO Sync Status</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 animate-pulse rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">QBO Sync Status</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          syncRate >= 60 ? 'bg-green-100 text-green-700' :
          syncRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {syncRate.toFixed(0)}% Fully Synced
        </div>
      </div>

      <div className="space-y-2">
        {syncData.map((status) => (
          <div
            key={status.status}
            className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(status.status)}`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(status.status)}
              <div>
                <div className="font-medium text-gray-900">{status.status}</div>
                <div className="text-sm text-gray-500">{status.jobs.toLocaleString()} jobs</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">{formatCurrency(status.revenue)}</div>
              <div className="text-sm text-gray-500">
                {totalJobs > 0 ? ((status.jobs / totalJobs) * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Material + Crew Pay = Fully synced
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-500" />
            Only partial sync
          </div>
          <div className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-gray-400" />
            Not started yet
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            Unable to complete
          </div>
        </div>
      </div>
    </div>
  );
}
