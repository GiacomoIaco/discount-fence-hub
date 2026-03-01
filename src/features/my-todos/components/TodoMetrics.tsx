import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { TodoItem } from '../types';

const METRICS_COLLAPSED_KEY = 'todo-metrics-collapsed';

interface TodoMetricsProps {
  items: TodoItem[];
}

export default function TodoMetrics({ items }: TodoMetricsProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(METRICS_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(METRICS_COLLAPSED_KEY, String(next));
  };

  // Compute metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const todayStr = now.toISOString().split('T')[0];

    // Tasks completed this week
    const completedThisWeek = items.filter(i =>
      i.status === 'done' && i.completed_at && new Date(i.completed_at) >= startOfWeek
    );

    // On-time completion % (completed_at <= due_date)
    const withDueDate = completedThisWeek.filter(i => i.due_date);
    const onTime = withDueDate.filter(i => {
      if (!i.completed_at || !i.due_date) return false;
      return i.completed_at.split('T')[0] <= i.due_date;
    });
    const onTimePercent = withDueDate.length > 0
      ? Math.round((onTime.length / withDueDate.length) * 100)
      : 100;

    // Currently overdue
    const overdueCount = items.filter(i => {
      if (!i.due_date || i.status === 'done') return false;
      return i.due_date < todayStr;
    }).length;

    // In progress
    const inProgressCount = items.filter(i => i.status === 'in_progress').length;

    // Last 7 days completion chart
    const last7Days: { label: string; count: number; date: string }[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
      const count = items.filter(i =>
        i.status === 'done' && i.completed_at && i.completed_at.split('T')[0] === dateStr
      ).length;
      last7Days.push({ label: dayLabel, count, date: dateStr });
    }
    const maxCount = Math.max(...last7Days.map(d => d.count), 1);

    return {
      completedThisWeek: completedThisWeek.length,
      onTimePercent,
      overdueCount,
      inProgressCount,
      last7Days,
      maxCount,
    };
  }, [items]);

  return (
    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
        <TrendingUp className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-700">Productivity</span>
        {collapsed && (
          <span className="text-xs text-gray-500 ml-2">
            {metrics.completedThisWeek} done this week
          </span>
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Completed this week */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Done This Week</span>
              </div>
              <span className="text-2xl font-bold text-green-800">{metrics.completedThisWeek}</span>
            </div>

            {/* On-time % */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">On-Time</span>
              </div>
              <span className="text-2xl font-bold text-blue-800">{metrics.onTimePercent}%</span>
            </div>

            {/* Overdue */}
            <div className={`border rounded-lg p-3 ${
              metrics.overdueCount > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${metrics.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`} />
                <span className={`text-xs font-medium ${metrics.overdueCount > 0 ? 'text-red-700' : 'text-gray-600'}`}>Overdue</span>
              </div>
              <span className={`text-2xl font-bold ${metrics.overdueCount > 0 ? 'text-red-800' : 'text-gray-700'}`}>{metrics.overdueCount}</span>
            </div>

            {/* In Progress */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">In Progress</span>
              </div>
              <span className="text-2xl font-bold text-purple-800">{metrics.inProgressCount}</span>
            </div>
          </div>

          {/* 7-day bar chart */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Last 7 Days</h3>
            <div className="flex items-end gap-1 h-20">
              {metrics.last7Days.map(day => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-medium">
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max((day.count / metrics.maxCount) * 48, day.count > 0 ? 4 : 0)}px`,
                      backgroundColor: day.count > 0 ? '#3b82f6' : '#e5e7eb',
                      minHeight: '2px',
                    }}
                  />
                  <span className="text-[10px] text-gray-400">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
