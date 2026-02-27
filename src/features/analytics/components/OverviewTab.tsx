import { Activity, Camera, MessageSquare, TrendingUp, AlertCircle, CheckCircle, Clock, Target } from 'lucide-react';
import type { AnalyticsData } from '../hooks/useAnalytics';
import { usePermission } from '../../../contexts/PermissionContext';

interface OverviewTabProps {
  data: AnalyticsData;
}

export function OverviewTab({ data }: OverviewTabProps) {
  const { hasPermission } = usePermission();

  // Calculate recent activity (last 7 days snapshot)
  const recentWeek = data.timeSeries.slice(-1)[0];
  const previousWeek = data.timeSeries.slice(-2)[0];

  const requestTrend = recentWeek && previousWeek
    ? ((recentWeek.requestsCreated - previousWeek.requestsCreated) / (previousWeek.requestsCreated || 1)) * 100
    : 0;

  // Identify critical items (requests with low SLA compliance)
  const criticalRequests = data.requestMetricsByType.filter(
    r => r.percentUnder48h < 70 || r.percentUnder24h < 50
  );

  return (
    <div className="space-y-6">
      {/* High-Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Activity}
          label="Total Requests"
          value={data.overview.totalRequests.toString()}
          subtitle={`${data.overview.completedRequests} completed`}
          trend={requestTrend}
          color="blue"
        />
        <SummaryCard
          icon={Camera}
          label="Photos"
          value="--"
          subtitle="See Photos tab"
          color="purple"
        />
        <SummaryCard
          icon={MessageSquare}
          label="Messages"
          value={data.messageAnalytics.totalMessages.toString()}
          subtitle={`${data.messageAnalytics.messagesThisWeek} this week`}
          color="green"
        />
        <SummaryCard
          icon={TrendingUp}
          label="AI Coach"
          value="--"
          subtitle="Coming soon"
          color="orange"
        />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Requests Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Requests</h3>
          </div>
          <div className="space-y-3">
            <MetricRow
              icon={CheckCircle}
              label="Completion Rate"
              value={`${((data.overview.completedRequests / data.overview.totalRequests) * 100).toFixed(1)}%`}
              iconColor="text-green-600"
            />
            <MetricRow
              icon={Clock}
              label="Avg Response Time"
              value={`${data.overview.averageResponseTime.toFixed(1)}h`}
              iconColor="text-yellow-600"
            />
            <MetricRow
              icon={Target}
              label="SLA Compliance"
              value={`${data.overview.slaComplianceRate.toFixed(1)}%`}
              iconColor="text-purple-600"
            />
          </div>
          <button className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Detailed Analytics →
          </button>
        </div>

        {/* Pricing Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Pricing Requests</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600">Win Rate</div>
              <div className="text-2xl font-bold text-green-700">
                {data.pricingAnalytics.winRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Value Won</div>
              <div className="text-xl font-bold text-gray-900">
                ${data.pricingAnalytics.totalValueWon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Active Quotes</div>
              <div className="text-lg font-semibold text-gray-700">
                {data.pricingAnalytics.totalPricingRequests - data.pricingAnalytics.wonRequests - data.pricingAnalytics.lostRequests}
              </div>
            </div>
          </div>
          <button className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Pricing Details →
          </button>
        </div>

        {/* Photos Overview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Photos</h3>
          </div>
          <div className="space-y-3">
            <div className="text-center py-8 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Photo analytics available</p>
              <p className="text-sm">in Photos tab</p>
            </div>
          </div>
          <button className="mt-4 w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            View Photo Analytics →
          </button>
        </div>
      </div>

      {/* Recent Activity (Last 7 Days) */}
      {recentWeek && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity (Last 7 Days)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-600 mb-1">Requests Created</div>
              <div className="text-2xl font-bold text-blue-700">{recentWeek.requestsCreated}</div>
              {previousWeek && (
                <div className="text-xs text-blue-600 mt-1">
                  {requestTrend > 0 ? '+' : ''}{requestTrend.toFixed(1)}% from previous week
                </div>
              )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 mb-1">Avg Close Time</div>
              <div className="text-2xl font-bold text-green-700">{recentWeek.averageCloseTime.toFixed(1)}h</div>
              <div className="text-xs text-green-600 mt-1">
                {recentWeek.averageCloseTime < 24 ? 'Within SLA' : 'Above target'}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 mb-1">SLA Compliance</div>
              <div className="text-2xl font-bold text-green-700">{recentWeek.percentUnder24h.toFixed(1)}%</div>
              <div className="text-xs text-green-600 mt-1">
                Resolved within 24h
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-600 mb-1">Top Request Type</div>
              <div className="text-xl font-bold text-purple-700">
                {recentWeek.requestsByType.length > 0
                  ? recentWeek.requestsByType.sort((a, b) => b.count - a.count)[0].type
                  : 'N/A'}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {recentWeek.requestsByType.length > 0
                  ? `${recentWeek.requestsByType.sort((a, b) => b.count - a.count)[0].count} requests`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts & Attention Items */}
      {criticalRequests.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Items Needing Attention</h3>
          </div>
          <div className="space-y-2">
            {criticalRequests.map((req) => (
              <div key={req.type} className="flex items-center justify-between bg-white rounded p-3">
                <div>
                  <span className="font-medium text-gray-900">{req.type}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {req.percentUnder48h < 70
                      ? `Only ${req.percentUnder48h.toFixed(1)}% resolved within 48h`
                      : `Only ${req.percentUnder24h.toFixed(1)}% resolved within 24h`}
                  </span>
                </div>
                <span className="text-red-600 font-semibold">
                  {req.created - req.closed} open
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Performance Summary (for managers/admin) */}
      {hasPermission('view_analytics') && data.teamPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.teamPerformance
              .sort((a, b) => b.completedRequests - a.completedRequests)
              .slice(0, 3)
              .map((member, index) => (
                <div key={member.userId} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="font-medium text-gray-900">{member.userName}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-semibold text-gray-900">{member.completedRequests}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Time:</span>
                      <span className="font-semibold text-gray-900">{member.averageCompletionTime.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SLA:</span>
                      <span className={`font-semibold ${
                        member.slaCompliance >= 80 ? 'text-green-600' :
                        member.slaCompliance >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {member.slaCompliance.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  trend?: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function SummaryCard({ icon: Icon, label, value, subtitle, trend, color }: SummaryCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700'
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center justify-between mt-1">
        <div className="text-xs">{subtitle}</div>
        {trend !== undefined && trend !== 0 && (
          <div className={`text-xs font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Row Component
interface MetricRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}

function MetricRow({ icon: Icon, label, value, iconColor }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
