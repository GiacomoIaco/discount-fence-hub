import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { useTodoAnalytics, type TimeWindow } from '../hooks/useTodoAnalytics';
import { getAvatarColor } from '../utils/todoHelpers';
import { getInitials } from '../../../lib/stringUtils';

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: '1d', label: '1d' },
  { value: '3d', label: '3d' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

function windowDays(w: TimeWindow): number {
  switch (w) {
    case '1d': return 1;
    case '3d': return 3;
    case '7d': return 7;
    case '30d': return 30;
  }
}

export default function TodoTeamAnalytics() {
  const [window, setWindow] = useState<TimeWindow>('7d');
  const { getStats, dailyCounts, isLoading } = useTodoAnalytics();

  const { summary, members } = useMemo(() => getStats(window), [getStats, window]);

  // Highlight range for bar chart
  const highlightDays = windowDays(window);
  const chartData = useMemo(() => {
    return dailyCounts.map((d, idx) => ({
      ...d,
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      inWindow: idx >= dailyCounts.length - highlightDays,
    }));
  }, [dailyCounts, highlightDays]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Accomplishments</h1>
      <p className="text-sm text-gray-500 mb-6">Track completed tasks across the team</p>

      {/* Time window selector */}
      <div className="flex items-center gap-1 mb-6">
        {WINDOWS.map(w => (
          <button
            key={w.value}
            onClick={() => setWindow(w.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              window === w.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Total Completed</span>
          </div>
          <span className="text-3xl font-bold text-green-800">{summary.totalCompleted}</span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Avg / Day</span>
          </div>
          <span className="text-3xl font-bold text-blue-800">{summary.avgPerDay}</span>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-700">On-Time %</span>
          </div>
          <span className="text-3xl font-bold text-indigo-800">{summary.onTimePercent}%</span>
        </div>

        <div className={`border rounded-lg p-4 ${
          summary.currentlyOverdue > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`w-4 h-4 ${summary.currentlyOverdue > 0 ? 'text-red-600' : 'text-gray-500'}`} />
            <span className={`text-xs font-medium ${summary.currentlyOverdue > 0 ? 'text-red-700' : 'text-gray-600'}`}>Currently Overdue</span>
          </div>
          <span className={`text-3xl font-bold ${summary.currentlyOverdue > 0 ? 'text-red-800' : 'text-gray-700'}`}>
            {summary.currentlyOverdue}
          </span>
        </div>
      </div>

      {/* Completion trend chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">30-Day Completion Trend</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                interval={Math.floor(chartData.length / 6)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={24}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelFormatter={(label) => `${label}`}
                formatter={(value: number) => [`${value} tasks`, 'Completed']}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.inWindow ? '#3b82f6' : '#e5e7eb'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Team member table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Team Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No completed tasks in this period
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full ${getAvatarColor(member.userId)} text-white text-xs font-medium flex items-center justify-center flex-shrink-0`}
                >
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(member.name)
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate block">{member.name}</span>
                </div>

                {/* Completed count */}
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">{member.completed}</span>
                  <span className="text-xs text-gray-500 ml-1">done</span>
                </div>

                {/* On-time % */}
                <div className="w-16 text-right">
                  <span className={`text-sm font-medium ${
                    member.onTimePercent >= 80 ? 'text-green-600' :
                    member.onTimePercent >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {member.onTimePercent}%
                  </span>
                  <div className="text-[10px] text-gray-400">on-time</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
