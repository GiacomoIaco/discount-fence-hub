import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  Package,
  Truck,
  CheckCircle,
  Calendar,
  Award
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '../../../lib/supabase';

type TimeFrame = 'today' | 'week' | 'month' | 'all';

interface WorkerStats {
  worker_id: string;
  worker_name: string;
  staged_today: number;
  staged_this_week: number;
  staged_this_month: number;
  staged_all_time: number;
  loaded_all_time: number;
  completed_all_time: number;
}

interface DailyVolume {
  work_date: string;
  yard_code: string;
  yard_name: string;
  projects_staged: number;
  unique_workers: number;
}

interface TimeMetrics {
  yard_code: string;
  avg_staged_to_loaded: number;
  avg_staged_to_complete: number;
  project_count: number;
}

interface StaleProject {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string;
  yard_code: string;
  status: string;
  staged_at: string;
  business_days_staged: number;
}

interface SummaryStats {
  yard_code: string;
  yard_name: string;
  staged_today: number;
  staged_this_week: number;
  loaded_today: number;
  completed_today: number;
  currently_in_yard: number;
}

export default function YardAnalyticsPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week');

  // Fetch worker leaderboard
  const { data: workerStats = [] } = useQuery({
    queryKey: ['yard-worker-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_yard_worker_leaderboard')
        .select('*')
        .order('staged_this_week', { ascending: false });

      if (error) {
        console.error('Error fetching worker leaderboard:', error);
        return [];
      }
      return data as WorkerStats[];
    },
  });

  // Fetch daily staging volume (last 14 days)
  const { data: dailyVolume = [] } = useQuery({
    queryKey: ['yard-daily-volume'],
    queryFn: async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data, error } = await supabase
        .from('v_daily_staging_volume')
        .select('*')
        .gte('work_date', fourteenDaysAgo.toISOString().split('T')[0])
        .order('work_date', { ascending: true });

      if (error) {
        console.error('Error fetching daily volume:', error);
        return [];
      }
      return data as DailyVolume[];
    },
  });

  // Fetch time metrics
  const { data: timeMetrics = [] } = useQuery({
    queryKey: ['yard-time-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_yard_time_metrics')
        .select('*');

      if (error) {
        console.error('Error fetching time metrics:', error);
        return [];
      }

      // Aggregate by yard
      const byYard = new Map<string, { total: number; count: number; totalComplete: number; countComplete: number }>();

      (data || []).forEach((row: any) => {
        const yard = row.yard_code;
        const current = byYard.get(yard) || { total: 0, count: 0, totalComplete: 0, countComplete: 0 };

        if (row.hours_staged_to_loaded !== null) {
          current.total += row.hours_staged_to_loaded;
          current.count++;
        }
        if (row.hours_staged_to_complete !== null) {
          current.totalComplete += row.hours_staged_to_complete;
          current.countComplete++;
        }

        byYard.set(yard, current);
      });

      return Array.from(byYard.entries()).map(([yard, stats]) => ({
        yard_code: yard,
        avg_staged_to_loaded: stats.count > 0 ? Math.round(stats.total / stats.count * 10) / 10 : 0,
        avg_staged_to_complete: stats.countComplete > 0 ? Math.round(stats.totalComplete / stats.countComplete * 10) / 10 : 0,
        project_count: stats.count,
      })) as TimeMetrics[];
    },
  });

  // Fetch stale projects
  const { data: staleProjects = [] } = useQuery({
    queryKey: ['yard-stale-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_stale_yard_projects')
        .select('*')
        .order('business_days_staged', { ascending: false });

      if (error) {
        console.error('Error fetching stale projects:', error);
        return [];
      }
      return data as StaleProject[];
    },
  });

  // Fetch summary stats
  const { data: summaryStats = [] } = useQuery({
    queryKey: ['yard-summary-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_yard_summary_stats')
        .select('*');

      if (error) {
        console.error('Error fetching summary stats:', error);
        return [];
      }
      return data as SummaryStats[];
    },
  });

  // Calculate totals
  const totals = summaryStats.reduce(
    (acc, stat) => ({
      stagedToday: acc.stagedToday + (stat.staged_today || 0),
      stagedThisWeek: acc.stagedThisWeek + (stat.staged_this_week || 0),
      loadedToday: acc.loadedToday + (stat.loaded_today || 0),
      completedToday: acc.completedToday + (stat.completed_today || 0),
      inYard: acc.inYard + (stat.currently_in_yard || 0),
    }),
    { stagedToday: 0, stagedThisWeek: 0, loadedToday: 0, completedToday: 0, inYard: 0 }
  );

  // Calculate overall avg time
  const avgTimeToLoad = timeMetrics.length > 0
    ? (timeMetrics.reduce((sum, m) => sum + m.avg_staged_to_loaded * m.project_count, 0) /
       timeMetrics.reduce((sum, m) => sum + m.project_count, 0)).toFixed(1)
    : '—';

  // Prepare chart data (aggregate by date across all yards)
  const chartData = dailyVolume.reduce((acc: any[], row) => {
    const existing = acc.find(d => d.date === row.work_date);
    if (existing) {
      existing[row.yard_code] = row.projects_staged;
      existing.total += row.projects_staged;
    } else {
      acc.push({
        date: row.work_date,
        [row.yard_code]: row.projects_staged,
        total: row.projects_staged,
      });
    }
    return acc;
  }, []);

  // Format date for chart
  const formatChartDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get worker stat by timeframe
  const getWorkerStat = (worker: WorkerStats) => {
    switch (timeFrame) {
      case 'today': return worker.staged_today;
      case 'week': return worker.staged_this_week;
      case 'month': return worker.staged_this_month;
      case 'all': return worker.staged_all_time;
    }
  };

  // Get unique yard codes for chart
  const yardCodes = [...new Set(dailyVolume.map(d => d.yard_code))];
  const yardColors: Record<string, string> = {
    'ATX-HB': '#3b82f6',
    'ATX-RES': '#60a5fa',
    'SA-HB': '#22c55e',
    'SA-RES': '#86efac',
    'HOU-HB': '#f59e0b',
    'HOU-RES': '#fcd34d',
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Yard Analytics</h1>
              <p className="text-xs text-gray-500">Operations performance and metrics</p>
            </div>
          </div>
          {/* Time frame selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['today', 'week', 'month', 'all'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  timeFrame === tf
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tf === 'today' ? 'Today' : tf === 'week' ? 'Week' : tf === 'month' ? 'Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          {/* Staged Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Staged Today</span>
              <Package className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totals.stagedToday}</div>
            <div className="text-xs text-gray-500 mt-1">Week: {totals.stagedThisWeek}</div>
          </div>

          {/* Avg Time to Load */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Avg Time to Load</span>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{avgTimeToLoad} hrs</div>
            <div className="text-xs text-gray-500 mt-1">From staged</div>
          </div>

          {/* Loaded Today */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Loaded Today</span>
              <Truck className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totals.loadedToday}</div>
            <div className="text-xs text-gray-500 mt-1">Ready for crew</div>
          </div>

          {/* Currently in Yard */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">In Yard</span>
              <CheckCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totals.inYard}</div>
            <div className="text-xs text-gray-500 mt-1">Staged + Loaded</div>
          </div>

          {/* Stale Projects */}
          <div className={`rounded-xl border p-4 ${
            staleProjects.length > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">Stale (3+ days)</span>
              <AlertTriangle className={`w-4 h-4 ${staleProjects.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            </div>
            <div className={`text-2xl font-bold ${staleProjects.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {staleProjects.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Need attention</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Staging Volume Chart */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Staging Volume (Last 14 Days)
              </h3>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    tick={{ fontSize: 11 }}
                    interval={1}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    labelFormatter={formatChartDate}
                  />
                  <Legend />
                  {yardCodes.map(yard => (
                    <Bar
                      key={yard}
                      dataKey={yard}
                      stackId="a"
                      fill={yardColors[yard] || '#94a3b8'}
                      name={yard}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No staging data available yet</p>
                </div>
              </div>
            )}
          </div>

          {/* Time Metrics by Yard */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              Avg Time by Yard
            </h3>
            {timeMetrics.length > 0 ? (
              <div className="space-y-3">
                {timeMetrics.map(metric => (
                  <div key={metric.yard_code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{metric.yard_code}</div>
                      <div className="text-xs text-gray-500">{metric.project_count} projects</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-purple-600">{metric.avg_staged_to_loaded} hrs</div>
                      <div className="text-xs text-gray-500">to load</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500">
                <p className="text-sm">No time data available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Worker Leaderboard */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                Worker Leaderboard
              </h3>
              <span className="text-xs text-gray-500">
                {timeFrame === 'today' ? 'Today' : timeFrame === 'week' ? 'This Week' : timeFrame === 'month' ? 'This Month' : 'All Time'}
              </span>
            </div>
            {workerStats.length > 0 ? (
              <div className="space-y-2">
                {workerStats
                  .filter(w => getWorkerStat(w) > 0)
                  .slice(0, 10)
                  .map((worker, index) => (
                  <div
                    key={worker.worker_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' :
                        index === 2 ? 'bg-orange-600' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{worker.worker_name}</div>
                        <div className="text-xs text-gray-500">
                          {worker.loaded_all_time} loaded • {worker.completed_all_time} complete
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600">{getWorkerStat(worker)}</div>
                      <div className="text-xs text-gray-500">staged</div>
                    </div>
                  </div>
                ))}
                {workerStats.filter(w => getWorkerStat(w) > 0).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm">No activity for this period</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No worker data available yet</p>
              </div>
            )}
          </div>

          {/* Stale Projects */}
          <div className={`rounded-xl border p-4 ${
            staleProjects.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${staleProjects.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
              Stale Projects (3+ Business Days in Yard)
            </h3>
            {staleProjects.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {staleProjects.map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-700">{project.project_code}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          project.status === 'staged' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{project.project_name}</div>
                      <div className="text-xs text-gray-500">{project.customer_name} • {project.yard_code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-600">{project.business_days_staged}</div>
                      <div className="text-xs text-gray-500">days</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-2" />
                <p className="text-green-700 font-medium">All Clear!</p>
                <p className="text-sm text-gray-500 mt-1">No projects have been in the yard for more than 3 business days</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
