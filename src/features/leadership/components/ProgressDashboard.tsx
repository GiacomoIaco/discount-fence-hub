import { ArrowLeft, TrendingUp, Target, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import { useFunctionsQuery, useInitiativesQuery } from '../hooks/useLeadershipQuery';
import { useAnnualGoalsQuery } from '../hooks/useGoalsQuery';
import { useAuth } from '../../../contexts/AuthContext';

interface ProgressDashboardProps {
  onBack: () => void;
}

export default function ProgressDashboard({ onBack }: ProgressDashboardProps) {
  const { profile } = useAuth();
  const currentYear = new Date().getFullYear();

  const { data: functions } = useFunctionsQuery();
  const { data: allInitiatives } = useInitiativesQuery({});

  // Calculate overall statistics
  const totalInitiatives = allInitiatives?.length || 0;
  const activeInitiatives = allInitiatives?.filter(i => i.status === 'active').length || 0;
  const completedInitiatives = allInitiatives?.filter(i => i.status === 'completed').length || 0;
  const atRiskInitiatives = allInitiatives?.filter(i => i.color_status === 'red').length || 0;
  const highPriorityInitiatives = allInitiatives?.filter(i => i.priority === 'high').length || 0;

  const completionRate = totalInitiatives > 0
    ? Math.round((completedInitiatives / totalInitiatives) * 100)
    : 0;

  const averageProgress = allInitiatives && allInitiatives.length > 0
    ? Math.round(allInitiatives.reduce((sum, i) => sum + i.progress_percent, 0) / allInitiatives.length)
    : 0;

  // Group initiatives by function
  const initiativesByFunction = functions?.map(func => {
    const functionInitiatives = allInitiatives?.filter(i => {
      return i.area?.function_id === func.id;
    }) || [];

    const completed = functionInitiatives.filter(i => i.status === 'completed').length;
    const active = functionInitiatives.filter(i => i.status === 'active').length;
    const atRisk = functionInitiatives.filter(i => i.color_status === 'red').length;
    const avgProgress = functionInitiatives.length > 0
      ? Math.round(functionInitiatives.reduce((sum, i) => sum + i.progress_percent, 0) / functionInitiatives.length)
      : 0;

    return {
      function: func,
      total: functionInitiatives.length,
      completed,
      active,
      atRisk,
      avgProgress,
      completionRate: functionInitiatives.length > 0
        ? Math.round((completed / functionInitiatives.length) * 100)
        : 0,
    };
  }) || [];

  // Status distribution
  const statusCounts = {
    not_started: allInitiatives?.filter(i => i.status === 'not_started').length || 0,
    active: activeInitiatives,
    on_hold: allInitiatives?.filter(i => i.status === 'on_hold').length || 0,
    at_risk: allInitiatives?.filter(i => i.status === 'at_risk').length || 0,
    completed: completedInitiatives,
    cancelled: allInitiatives?.filter(i => i.status === 'cancelled').length || 0,
  };

  // Priority distribution
  const priorityCounts = {
    high: highPriorityInitiatives,
    medium: allInitiatives?.filter(i => i.priority === 'medium').length || 0,
    low: allInitiatives?.filter(i => i.priority === 'low').length || 0,
  };

  // Color status distribution
  const colorCounts = {
    green: allInitiatives?.filter(i => i.color_status === 'green').length || 0,
    yellow: allInitiatives?.filter(i => i.color_status === 'yellow').length || 0,
    red: atRiskInitiatives,
  };

  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Access denied. Admin only.</p>
          <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-700">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Progress Analytics</h1>
              <p className="text-sm text-gray-600">Executive summary of all initiatives and goals</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Total Initiatives</div>
                <div className="text-3xl font-bold text-gray-900">{totalInitiatives}</div>
                <div className="text-xs text-gray-500 mt-2">{activeInitiatives} active</div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Completion Rate</div>
                <div className="text-3xl font-bold text-green-600">{completionRate}%</div>
                <div className="text-xs text-gray-500 mt-2">{completedInitiatives} completed</div>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Average Progress</div>
                <div className="text-3xl font-bold text-blue-600">{averageProgress}%</div>
                <div className="text-xs text-gray-500 mt-2">Across all initiatives</div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">At Risk</div>
                <div className="text-3xl font-bold text-red-600">{atRiskInitiatives}</div>
                <div className="text-xs text-gray-500 mt-2">Needs attention</div>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress by Function */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Progress by Function
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {initiativesByFunction.map((item) => (
                <div key={item.function.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.function.name}</h3>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.total} initiatives • {item.active} active • {item.completed} completed
                        {item.atRisk > 0 && (
                          <span className="text-red-600 font-medium"> • {item.atRisk} at risk</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Completion Rate</div>
                      <div className="text-2xl font-bold text-gray-900">{item.completionRate}%</div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all"
                          style={{ width: `${item.avgProgress}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">{item.avgProgress}%</span>
                    </div>
                  </div>
                </div>
              ))}
              {initiativesByFunction.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No functions with initiatives yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="grid grid-cols-3 gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Status Distribution</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-700">Not Started</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.not_started}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Active</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">On Hold</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.on_hold}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">At Risk</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.at_risk}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Completed</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <span className="text-sm text-gray-700">Cancelled</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{statusCounts.cancelled}</span>
              </div>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Priority Distribution</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">High</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priorityCounts.high}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Medium</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priorityCounts.medium}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-gray-700">Low</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{priorityCounts.low}</span>
              </div>
            </div>
          </div>

          {/* Color Status Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Health Status</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">On Track</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{colorCounts.green}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Needs Attention</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{colorCounts.yellow}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">At Risk</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{colorCounts.red}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
