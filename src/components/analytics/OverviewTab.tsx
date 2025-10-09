import { Activity, Clock, CheckCircle, Target, DollarSign, BarChart, TrendingUp, Users } from 'lucide-react';
import type { AnalyticsData } from '../../hooks/useAnalytics';
import type { UserRole } from '../../types';

interface OverviewTabProps {
  data: AnalyticsData;
  userRole: UserRole;
}

export function OverviewTab({ data, userRole }: OverviewTabProps) {
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pricing: 'Pricing',
      material: 'Material',
      warranty: 'Warranty',
      new_builder: 'New Builder',
      support: 'Support'
    };
    return labels[type] || type;
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      pending: 'Pending',
      completed: 'Completed',
      archived: 'Archived'
    };
    return labels[stage] || stage;
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Requests"
          value={data.overview.totalRequests.toString()}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={data.overview.completedRequests.toString()}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Avg Response Time"
          value={`${data.overview.averageResponseTime.toFixed(1)}h`}
          color="yellow"
        />
        <StatCard
          icon={Target}
          label="SLA Compliance"
          value={`${data.overview.slaComplianceRate.toFixed(1)}%`}
          color="purple"
        />
      </div>

      {/* Pricing Analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-gray-900">Pricing Request Analytics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 mb-1">Win Rate</div>
            <div className="text-3xl font-bold text-green-700">
              {data.pricingAnalytics.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-green-600 mt-1">
              {data.pricingAnalytics.wonRequests} won / {data.pricingAnalytics.wonRequests + data.pricingAnalytics.lostRequests} total
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 mb-1">Avg Quote Value</div>
            <div className="text-3xl font-bold text-blue-700">
              ${data.pricingAnalytics.averageQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Based on {data.pricingAnalytics.totalPricingRequests} pricing requests
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="text-sm text-purple-600 mb-1">Total Won Value</div>
            <div className="text-3xl font-bold text-purple-700">
              ${data.pricingAnalytics.totalQuoteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-purple-600 mt-1">
              From {data.pricingAnalytics.wonRequests} won requests
            </div>
          </div>
        </div>
      </div>

      {/* Request Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requests by Type */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Requests by Type</h3>
          </div>
          <div className="space-y-3">
            {data.requestsByType.map((item) => (
              <div key={item.type}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{getTypeLabel(item.type)}</span>
                  <span className="font-medium text-gray-900">{item.count} ({item.percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Requests by Stage */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Requests by Stage</h3>
          </div>
          <div className="space-y-3">
            {data.requestsByStage.map((item) => (
              <div key={item.stage} className="flex items-center justify-between">
                <span className="text-gray-600">{getStageLabel(item.stage)}</span>
                <span className="font-semibold text-gray-900 text-lg">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team Performance */}
      {(userRole === 'admin' || userRole === 'sales-manager') && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Team Performance</h2>
          </div>

          {data.teamPerformance.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No team performance data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Team Member</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total Requests</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Completed</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Time (hrs)</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">SLA Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teamPerformance.map((member) => (
                    <tr key={member.userId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{member.userName}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{member.totalRequests}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{member.completedRequests}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{member.averageCompletionTime.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${
                          member.slaCompliance >= 80 ? 'text-green-600' :
                          member.slaCompliance >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {member.slaCompliance.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700'
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
