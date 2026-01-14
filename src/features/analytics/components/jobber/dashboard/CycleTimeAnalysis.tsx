// Cycle time analysis component

import { useCycleTimeMetrics, useCycleTimeDistribution } from '../../../hooks/jobber/useCycleTimeMetrics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { JobberFilters } from '../../../types/jobber';

interface CycleTimeAnalysisProps {
  filters: JobberFilters;
}

export function CycleTimeAnalysis({ filters }: CycleTimeAnalysisProps) {
  const { data: metrics, isLoading: metricsLoading } = useCycleTimeMetrics(filters);
  const { data: distribution, isLoading: distLoading } = useCycleTimeDistribution(filters);

  const isLoading = metricsLoading || distLoading;

  // Color for distribution bars based on bucket
  const getBarColor = (bucket: string) => {
    if (bucket.includes('0-7')) return '#10B981';
    if (bucket.includes('8-14')) return '#3B82F6';
    if (bucket.includes('15-30')) return '#F59E0B';
    if (bucket.includes('31-60')) return '#F97316';
    return '#EF4444';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Time Analysis</h3>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Cycle Time Analysis</h3>

      {/* Stage Metrics Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 px-3 text-left text-sm font-semibold text-gray-700">Stage</th>
              <th className="py-2 px-3 text-right text-sm font-semibold text-gray-700">Average</th>
              <th className="py-2 px-3 text-right text-sm font-semibold text-gray-700">Median</th>
              <th className="py-2 px-3 text-right text-sm font-semibold text-gray-700">Target</th>
              <th className="py-2 px-3 text-right text-sm font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {(metrics || []).map((m) => {
              const isOnTarget = m.average <= m.target;
              return (
                <tr key={m.stage} className="border-b border-gray-100">
                  <td className="py-2 px-3 font-medium">{m.stage}</td>
                  <td className="py-2 px-3 text-right">{m.average.toFixed(1)} days</td>
                  <td className="py-2 px-3 text-right">{m.median.toFixed(0)} days</td>
                  <td className="py-2 px-3 text-right text-gray-500">≤{m.target} days</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isOnTarget ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {isOnTarget ? 'On Target' : 'Above Target'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Distribution Chart */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Cycle Time Distribution</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} />
              <YAxis type="category" dataKey="bucket" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
                {(distribution || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.bucket)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution Legend */}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          {(distribution || []).map((d) => (
            <div key={d.bucket} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: getBarColor(d.bucket) }} />
              <span>{d.bucket}: {d.percentage.toFixed(0)}% ({d.count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
