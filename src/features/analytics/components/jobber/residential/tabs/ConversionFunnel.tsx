// Conversion Funnel Tab - Core metrics and funnel visualization
// Shows: Opportunities, Won/Lost/Pending, Win%, Won$, Value Win%, Avg Days

import { TrendingUp, CheckCircle, XCircle, Clock, DollarSign, Percent, Timer } from 'lucide-react';
import { useResidentialFunnelMetrics, useResidentialEnhancedMonthlyTotals } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface ConversionFunnelProps {
  filters: ResidentialFilters;
}

export function ConversionFunnel({ filters }: ConversionFunnelProps) {
  const { data: metrics, isLoading } = useResidentialFunnelMetrics(filters);
  const { data: monthlyData } = useResidentialEnhancedMonthlyTotals(12, filters.revenueBucket || undefined);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No data available. Upload Residential CSV files to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Opportunities */}
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          label="Total Opportunities"
          value={metrics.total_opportunities.toLocaleString()}
          bgColor="bg-blue-50"
        />

        {/* Won */}
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Won"
          value={metrics.won_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(metrics.win_rate)}
          bgColor="bg-green-50"
        />

        {/* Lost */}
        <MetricCard
          icon={<XCircle className="w-5 h-5 text-red-600" />}
          label="Lost"
          value={metrics.lost_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(
            metrics.total_opportunities > 0
              ? (metrics.lost_opportunities / metrics.total_opportunities) * 100
              : null
          )}
          bgColor="bg-red-50"
        />

        {/* Pending */}
        <MetricCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Pending"
          value={metrics.pending_opportunities.toLocaleString()}
          subValue={formatResidentialPercent(
            metrics.total_opportunities > 0
              ? (metrics.pending_opportunities / metrics.total_opportunities) * 100
              : null
          )}
          bgColor="bg-amber-50"
        />

        {/* Won Value */}
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          label="Won Value"
          value={formatResidentialCurrency(metrics.won_value)}
          bgColor="bg-emerald-50"
        />

        {/* Value Win Rate */}
        <MetricCard
          icon={<Percent className="w-5 h-5 text-purple-600" />}
          label="Value Win Rate"
          value={formatResidentialPercent(metrics.value_win_rate)}
          subValue={`of ${formatResidentialCurrency(metrics.total_value)} total`}
          bgColor="bg-purple-50"
        />

        {/* Avg Days to Quote */}
        <MetricCard
          icon={<Timer className="w-5 h-5 text-indigo-600" />}
          label="Avg Days to Quote"
          value={metrics.avg_days_to_quote?.toFixed(1) || '-'}
          subValue="from assessment"
          bgColor="bg-indigo-50"
        />

        {/* Closed Win Rate */}
        <MetricCard
          icon={<CheckCircle className="w-5 h-5 text-teal-600" />}
          label="Closed Win Rate"
          value={formatResidentialPercent(metrics.closed_win_rate)}
          subValue="won / (won + lost)"
          bgColor="bg-teal-50"
        />
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="flex items-end justify-center gap-8 h-64">
          <FunnelBar
            label="Quoted"
            value={metrics.total_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-blue-500"
          />
          <FunnelBar
            label="Won"
            value={metrics.won_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-green-500"
          />
          <FunnelBar
            label="Lost"
            value={metrics.lost_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-red-400"
          />
          <FunnelBar
            label="Pending"
            value={metrics.pending_opportunities}
            maxValue={metrics.total_opportunities}
            color="bg-amber-400"
          />
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {monthlyData && monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Win Rate Trend</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Opps</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate ($)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyData.map((month) => (
                  <tr key={month.month} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{month.month_label}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{month.total_opps}</td>
                    <td className="py-2 px-3 text-right text-green-600">{month.won_opps}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.win_rate)}`}>
                        {formatResidentialPercent(month.win_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.value_win_rate)}`}>
                        {formatResidentialPercent(month.value_win_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">
                      {formatResidentialCurrency(month.won_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components

function MetricCard({
  icon,
  label,
  value,
  subValue,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </div>
  );
}

function FunnelBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const height = Math.max(percentage * 2, 20); // Min 20px height

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm font-medium text-gray-600 mb-2">{value.toLocaleString()}</div>
      <div
        className={`w-24 ${color} rounded-t-lg transition-all duration-500`}
        style={{ height: `${height}px` }}
      />
      <div className="text-sm text-gray-700 mt-2">{label}</div>
      <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
    </div>
  );
}

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 40) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 20) return 'text-amber-600';
  return 'text-red-600';
}
