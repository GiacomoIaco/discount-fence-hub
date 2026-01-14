// Day of week patterns component

import { useDayOfWeekPatterns } from '../../../hooks/jobber/useCycleTimeMetrics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { JobberFilters } from '../../../types/jobber';

interface DayOfWeekPatternsProps {
  filters: JobberFilters;
}

export function DayOfWeekPatterns({ filters }: DayOfWeekPatternsProps) {
  const { data: patterns, isLoading } = useDayOfWeekPatterns(filters);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Day of Week Patterns</h3>
        <div className="h-64 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  // Reorder to start with Monday
  const orderedPatterns = patterns ? [
    ...patterns.filter(p => p.day_index >= 1).sort((a, b) => a.day_index - b.day_index),
    ...patterns.filter(p => p.day_index === 0),
  ] : [];

  // Shorten day names for chart
  const chartData = orderedPatterns.map(p => ({
    ...p,
    dayShort: p.day.slice(0, 3),
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Day of Week Patterns</h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayShort" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="created"
              name="Jobs Created"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="scheduled"
              name="Jobs Scheduled"
              fill="#10B981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="font-medium text-blue-700">Peak Creation Day</div>
            <div className="text-blue-900">
              {chartData.length > 0
                ? chartData.reduce((max, p) => p.created > max.created ? p : max, chartData[0]).day
                : '-'
              }
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="font-medium text-green-700">Peak Schedule Day</div>
            <div className="text-green-900">
              {chartData.length > 0
                ? chartData.reduce((max, p) => p.scheduled > max.scheduled ? p : max, chartData[0]).day
                : '-'
              }
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Insight: Most jobs are created Mon-Thu, while scheduling is more spread across the week.
        </p>
      </div>
    </div>
  );
}
