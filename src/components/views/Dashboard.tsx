import { Link } from 'react-router-dom';
import { TrendingUp, DollarSign, Percent, Clock, ChevronRight, BarChart3 } from 'lucide-react';
import { useResidentialFunnelMetrics, useResidentialEnhancedMonthlyTotals } from '../../features/analytics/hooks/jobber/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../features/analytics/types/residential';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';

interface DashboardProps {
  userRole: UserRole;
}

export default function Dashboard({ userRole }: DashboardProps) {
  // Fetch residential metrics (all time for overview)
  const { data: funnelMetrics, isLoading: loadingFunnel } = useResidentialFunnelMetrics();
  const { data: monthlyData, isLoading: loadingMonthly } = useResidentialEnhancedMonthlyTotals(6);

  // Calculate LTM (Last Twelve Months) from monthly data
  const ltmStats = monthlyData && monthlyData.length > 0
    ? {
        pipeline: monthlyData.reduce((sum, m) => sum + (m.total_value || 0), 0),
        won: monthlyData.reduce((sum, m) => sum + (m.won_value || 0), 0),
        opps: monthlyData.reduce((sum, m) => sum + m.total_opps, 0),
        wonOpps: monthlyData.reduce((sum, m) => sum + m.won_opps, 0),
      }
    : null;

  const isLoading = loadingFunnel || loadingMonthly;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your overview.</p>
      </div>

      {/* Residential Analytics Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Residential Pipeline</h2>
            <span className="text-sm text-gray-500">(Last 6 Months)</span>
          </div>
          <Link
            to="/analytics/jobber"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View Full Analytics
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Pipeline */}
              <div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                  <DollarSign className="w-4 h-4 text-blue-500" />
                  Pipeline Value
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatResidentialCurrency(ltmStats?.pipeline || funnelMetrics?.total_value || 0)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {(ltmStats?.opps || funnelMetrics?.total_opportunities || 0).toLocaleString()} opportunities
                </div>
              </div>

              {/* Won Value */}
              <div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Won Value
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {formatResidentialCurrency(ltmStats?.won || funnelMetrics?.won_value || 0)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {(ltmStats?.wonOpps || funnelMetrics?.won_opportunities || 0).toLocaleString()} deals won
                </div>
              </div>

              {/* Win Rate */}
              <div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                  <Percent className="w-4 h-4 text-purple-500" />
                  Win Rate
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatResidentialPercent(funnelMetrics?.win_rate || null)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Value: {formatResidentialPercent(funnelMetrics?.value_win_rate || null)}
                </div>
              </div>

              {/* Speed to Quote */}
              <div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                  <Clock className="w-4 h-4 text-orange-500" />
                  P75 Days to Quote
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {funnelMetrics?.p75_days_to_quote?.toFixed(1) || '-'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  75th percentile
                </div>
              </div>
            </div>

            {/* Monthly Trend Mini-Chart */}
            {monthlyData && monthlyData.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="text-sm text-gray-600 mb-3">Monthly Trend</div>
                <div className="flex items-end gap-2 h-16">
                  {monthlyData.map((month, idx) => {
                    const maxWon = Math.max(...monthlyData.map(m => m.won_value || 0), 1);
                    const height = ((month.won_value || 0) / maxWon) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-green-500 rounded-t transition-all"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${month.month_label}: ${formatResidentialCurrency(month.won_value)}`}
                        />
                        <span className="text-[10px] text-gray-400 mt-1">{month.month_label.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role-based content placeholder */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 p-8 rounded-xl text-center">
        <p className="text-gray-500">
          Role-specific widgets will appear here for: <span className="font-semibold capitalize">{userRole}</span>
        </p>
      </div>
    </div>
  );
}
