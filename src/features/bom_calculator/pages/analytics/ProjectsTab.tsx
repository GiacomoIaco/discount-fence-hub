import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FolderOpen,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  Award
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '../../../../lib/supabase';

type TimeFrame = 'week' | 'month' | 'quarter' | 'all';

interface ProjectAnalytics {
  id: string;
  project_name: string;
  project_code: string;
  customer_name: string;
  status: string;
  bu_code: string;
  created_by_name: string;
  created_week: string;
  created_month: string;
  line_count: number;
  total_footage: number;
  total_material_cost: number;
  total_labor_cost: number;
}

interface EstimatorStats {
  user_id: string;
  user_name: string;
  total_projects: number;
  draft_count: number;
  ready_count: number;
  completed_count: number;
  projects_this_week: number;
  projects_this_month: number;
  total_footage: number;
  avg_footage_per_project: number;
}

interface MonthlyTrend {
  month: string;
  project_count: number;
  total_footage: number;
  avg_total_per_ft: number;
}

interface FenceTypePerformance {
  fence_type: string;
  project_count: number;
  total_footage: number;
  avg_material_per_ft: number;
  avg_labor_per_ft: number;
  avg_total_per_ft: number;
}

export default function ProjectsTab() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('month');

  // Fetch project analytics
  const { data: projects = [] } = useQuery({
    queryKey: ['project-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_project_analytics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching project analytics:', error);
        return [];
      }
      return data as ProjectAnalytics[];
    },
  });

  // Fetch estimator leaderboard
  const { data: estimators = [] } = useQuery({
    queryKey: ['estimator-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_estimator_leaderboard')
        .select('*');

      if (error) {
        console.error('Error fetching estimator leaderboard:', error);
        return [];
      }
      return data as EstimatorStats[];
    },
  });

  // Fetch monthly trends
  const { data: monthlyTrends = [] } = useQuery({
    queryKey: ['monthly-trends'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_monthly_trends')
        .select('*')
        .order('month', { ascending: true });

      if (error) {
        console.error('Error fetching monthly trends:', error);
        return [];
      }
      return data as MonthlyTrend[];
    },
  });

  // Fetch fence type performance
  const { data: fenceTypes = [] } = useQuery({
    queryKey: ['fence-type-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_fence_type_performance')
        .select('*');

      if (error) {
        console.error('Error fetching fence type performance:', error);
        return [];
      }
      return data as FenceTypePerformance[];
    },
  });

  // Calculate status counts
  const statusCounts = {
    draft: projects.filter(p => p.status === 'draft').length,
    ready: projects.filter(p => p.status === 'ready').length,
    sent_to_yard: projects.filter(p => p.status === 'sent_to_yard').length,
    staged: projects.filter(p => p.status === 'staged').length,
    loaded: projects.filter(p => p.status === 'loaded').length,
    complete: projects.filter(p => p.status === 'complete').length,
  };

  const totalProjects = projects.length;
  const totalFootage = projects.reduce((sum, p) => sum + (p.total_footage || 0), 0);
  const avgFootagePerProject = totalProjects > 0 ? totalFootage / totalProjects : 0;

  // Pipeline data for chart
  const pipelineData = [
    { status: 'Draft', count: statusCounts.draft, color: '#94a3b8' },
    { status: 'Ready', count: statusCounts.ready, color: '#3b82f6' },
    { status: 'Sent', count: statusCounts.sent_to_yard, color: '#f59e0b' },
    { status: 'Staged', count: statusCounts.staged, color: '#8b5cf6' },
    { status: 'Loaded', count: statusCounts.loaded, color: '#22c55e' },
    { status: 'Complete', count: statusCounts.complete, color: '#10b981' },
  ];

  // Get estimator stat by timeframe
  const getEstimatorStat = (estimator: EstimatorStats) => {
    switch (timeFrame) {
      case 'week': return estimator.projects_this_week;
      case 'month': return estimator.projects_this_month;
      default: return estimator.total_projects;
    }
  };

  // Fence type colors
  const fenceTypeColors: Record<string, string> = {
    'Wood 6ft': '#22c55e',
    'Wood 8ft': '#16a34a',
    'Good Neighbor 6ft': '#3b82f6',
    'Good Neighbor 8ft': '#2563eb',
    'Horizontal': '#8b5cf6',
    'Iron': '#64748b',
    'Custom': '#a855f7',
  };

  // Format month for display
  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Projects Analytics</h2>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter', 'all'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                timeFrame === tf
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tf === 'week' ? 'Week' : tf === 'month' ? 'Month' : tf === 'quarter' ? 'Quarter' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Projects</span>
            <FolderOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalProjects}</div>
          <div className="text-xs text-gray-500 mt-1">{statusCounts.complete} completed</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Total Footage</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalFootage.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Linear feet</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Avg Project Size</span>
            <FolderOpen className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{Math.round(avgFootagePerProject)}</div>
          <div className="text-xs text-gray-500 mt-1">Feet per project</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">In Pipeline</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {statusCounts.draft + statusCounts.ready + statusCounts.sent_to_yard}
          </div>
          <div className="text-xs text-gray-500 mt-1">Active projects</div>
        </div>
      </div>

      {/* Pipeline Visual */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Project Pipeline
        </h3>
        <div className="flex items-center justify-between gap-2">
          {pipelineData.map((stage, index) => (
            <div key={stage.status} className="flex-1 flex flex-col items-center">
              <div
                className="w-full h-16 rounded-lg flex items-center justify-center relative"
                style={{ backgroundColor: stage.color + '20' }}
              >
                <span className="text-2xl font-bold" style={{ color: stage.color }}>
                  {stage.count}
                </span>
                {index < pipelineData.length - 1 && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-gray-300">
                    &rarr;
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-gray-600 mt-2">{stage.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Trends Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Monthly Project Volume
          </h3>
          {monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={formatMonth}
                  formatter={(value: number, name: string) => [
                    name === 'project_count' ? value : value.toLocaleString(),
                    name === 'project_count' ? 'Projects' : 'Footage'
                  ]}
                />
                <Bar dataKey="project_count" fill="#3b82f6" name="Projects" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No trend data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Cost Per Foot by Fence Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-purple-500" />
            Cost/ft by Fence Type
          </h3>
          {fenceTypes.length > 0 ? (
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {fenceTypes.map(ft => (
                <div key={ft.fence_type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: fenceTypeColors[ft.fence_type] || '#94a3b8' }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{ft.fence_type}</div>
                      <div className="text-xs text-gray-500">
                        {ft.project_count} projects | {ft.total_footage.toLocaleString()} ft
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">${ft.avg_total_per_ft?.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      M: ${ft.avg_material_per_ft?.toFixed(2)} | L: ${ft.avg_labor_per_ft?.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">
              <p className="text-sm">No fence type data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Estimator Leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" />
            Estimator Leaderboard
          </h3>
          <span className="text-xs text-gray-500">
            {timeFrame === 'week' ? 'This Week' : timeFrame === 'month' ? 'This Month' : timeFrame === 'quarter' ? 'This Quarter' : 'All Time'}
          </span>
        </div>
        {estimators.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {estimators
              .filter(e => getEstimatorStat(e) > 0)
              .sort((a, b) => getEstimatorStat(b) - getEstimatorStat(a))
              .slice(0, 10)
              .map((estimator, index) => (
              <div
                key={estimator.user_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
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
                    <div className="font-medium text-gray-900">{estimator.user_name}</div>
                    <div className="text-xs text-gray-500">
                      {estimator.total_footage.toLocaleString()} ft total
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">{getEstimatorStat(estimator)}</div>
                  <div className="text-xs text-gray-500">projects</div>
                </div>
              </div>
            ))}
            {estimators.filter(e => getEstimatorStat(e) > 0).length === 0 && (
              <div className="col-span-2 text-center py-8 text-gray-500">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No activity for this period</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No estimator data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
