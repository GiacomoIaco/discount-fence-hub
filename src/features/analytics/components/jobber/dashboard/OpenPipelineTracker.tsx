// Open pipeline tracker component

import { useMemo } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { useOpenJobs } from '../../../hooks/jobber/useJobberJobs';
import type { JobberFilters } from '../../../types/jobber';

interface OpenPipelineTrackerProps {
  filters: JobberFilters;
}

export function OpenPipelineTracker({ filters }: OpenPipelineTrackerProps) {
  const { data: openJobs, isLoading } = useOpenJobs(filters);

  const pipelineData = useMemo(() => {
    if (!openJobs) return null;

    const totalValue = openJobs.reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);
    const totalCount = openJobs.length;

    // Age buckets
    const now = new Date();
    const ageBuckets = {
      '0-7 days': { count: 0, value: 0 },
      '8-14 days': { count: 0, value: 0 },
      '15-30 days': { count: 0, value: 0 },
      '31+ days': { count: 0, value: 0 },
    };

    for (const job of openJobs) {
      if (!job.created_date) continue;
      const created = new Date(job.created_date);
      const age = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const value = Number(job.total_revenue) || 0;

      if (age <= 7) {
        ageBuckets['0-7 days'].count++;
        ageBuckets['0-7 days'].value += value;
      } else if (age <= 14) {
        ageBuckets['8-14 days'].count++;
        ageBuckets['8-14 days'].value += value;
      } else if (age <= 30) {
        ageBuckets['15-30 days'].count++;
        ageBuckets['15-30 days'].value += value;
      } else {
        ageBuckets['31+ days'].count++;
        ageBuckets['31+ days'].value += value;
      }
    }

    // By salesperson
    const spMap = new Map<string, { count: number; value: number }>();
    for (const job of openJobs) {
      const sp = job.effective_salesperson || '(Unassigned)';
      const existing = spMap.get(sp) || { count: 0, value: 0 };
      existing.count++;
      existing.value += Number(job.total_revenue) || 0;
      spMap.set(sp, existing);
    }
    const bySalesperson = Array.from(spMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // By location
    const locMap = new Map<string, { count: number; value: number }>();
    for (const job of openJobs) {
      const loc = job.franchise_location || 'Unknown';
      const existing = locMap.get(loc) || { count: 0, value: 0 };
      existing.count++;
      existing.value += Number(job.total_revenue) || 0;
      locMap.set(loc, existing);
    }
    const byLocation = Array.from(locMap.entries())
      .filter(([loc]) => loc !== 'Unknown')
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);

    return { totalValue, totalCount, ageBuckets, bySalesperson, byLocation };
  }, [openJobs]);

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Pipeline</h3>
        <div className="h-48 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!pipelineData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Open Pipeline</h3>
        <p className="text-gray-500">No open jobs</p>
      </div>
    );
  }

  const bucketColors: Record<string, string> = {
    '0-7 days': 'bg-green-100 border-green-300 text-green-700',
    '8-14 days': 'bg-blue-100 border-blue-300 text-blue-700',
    '15-30 days': 'bg-yellow-100 border-yellow-300 text-yellow-700',
    '31+ days': 'bg-red-100 border-red-300 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Open Pipeline</h3>
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-500">{pipelineData.totalCount} open jobs</span>
        </div>
      </div>

      {/* Total Summary */}
      <div className="p-4 bg-blue-50 rounded-lg mb-4">
        <div className="text-sm text-blue-600">Total Open Pipeline</div>
        <div className="text-3xl font-bold text-blue-700">{formatCurrency(pipelineData.totalValue)}</div>
      </div>

      {/* Age Buckets */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
          <Clock className="w-4 h-4" />
          Age Breakdown
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(pipelineData.ageBuckets).map(([bucket, data]) => (
            <div
              key={bucket}
              className={`p-2 rounded border ${bucketColors[bucket]}`}
            >
              <div className="text-sm font-medium">{bucket}</div>
              <div className="text-lg font-bold">{formatCurrency(data.value)}</div>
              <div className="text-xs opacity-75">{data.count} jobs</div>
            </div>
          ))}
        </div>
      </div>

      {/* By Salesperson */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">By Salesperson</h4>
          <div className="space-y-1">
            {pipelineData.bySalesperson.map((sp) => (
              <div key={sp.name} className="flex justify-between text-sm">
                <span className="truncate">{sp.name}</span>
                <span className="font-medium">{formatCurrency(sp.value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">By Location</h4>
          <div className="space-y-1">
            {pipelineData.byLocation.map((loc) => (
              <div key={loc.name} className="flex justify-between text-sm">
                <span className="truncate">{loc.name}</span>
                <span className="font-medium">{formatCurrency(loc.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
