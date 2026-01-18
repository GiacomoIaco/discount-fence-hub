// Individual Salesperson Detail Page
// Mobile-optimized view for a single salesperson with limited time filters

import { useState, useMemo } from 'react';
import { ArrowLeft, Calendar, Star, AlertTriangle, TrendingDown, Target, DollarSign, Clock, Award } from 'lucide-react';
import { useResidentialSalespersonMetrics, useResidentialSalespersonMonthly, useComparisonGroup } from '../../../hooks/jobber/residential';
import type { ResidentialFilters, ResidentialTimePreset } from '../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent, getResidentialDateRange } from '../../../types/residential';

interface SalespersonDetailPageProps {
  salesperson: string;
  onBack: () => void;
}

// Limited time presets for individual salesperson view
const TIME_OPTIONS: { value: ResidentialTimePreset; label: string }[] = [
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
];

export function SalespersonDetailPage({ salesperson, onBack }: SalespersonDetailPageProps) {
  const [timePreset, setTimePreset] = useState<ResidentialTimePreset>('last_quarter');

  // Build filters for this salesperson
  const filters: ResidentialFilters = useMemo(() => ({
    timePreset,
    dateRange: getResidentialDateRange(timePreset),
    salesperson: null, // We'll filter client-side
    revenueBucket: null,
    speedBucket: null,
    quoteCountBucket: null,
  }), [timePreset]);

  const { data: allMetrics, isLoading } = useResidentialSalespersonMetrics(filters);
  const { data: monthlyData } = useResidentialSalespersonMonthly(salesperson, 6, filters);
  const { data: comparisonGroup } = useComparisonGroup();

  // Find this salesperson's metrics
  const personMetrics = useMemo(() => {
    return allMetrics?.find((m) => m.salesperson === salesperson);
  }, [allMetrics, salesperson]);

  // Calculate comparison group stats for percentile
  const comparisonStats = useMemo(() => {
    if (!allMetrics || !comparisonGroup || comparisonGroup.length === 0) {
      return null;
    }

    const groupMetrics = allMetrics.filter((m) => comparisonGroup.includes(m.salesperson));
    if (groupMetrics.length === 0) return null;

    // Sort by win rate to find percentile
    const sortedByWinRate = [...groupMetrics].sort((a, b) => (b.win_rate || 0) - (a.win_rate || 0));
    const personIndex = sortedByWinRate.findIndex((m) => m.salesperson === salesperson);

    const isInGroup = comparisonGroup.includes(salesperson);
    const percentile = isInGroup && personIndex >= 0
      ? ((sortedByWinRate.length - personIndex) / sortedByWinRate.length) * 100
      : null;
    const isTop = personIndex === 0;

    return {
      isInGroup,
      percentile,
      isTop,
      groupSize: groupMetrics.length,
    };
  }, [allMetrics, comparisonGroup, salesperson]);

  // Get tier badge
  const getTierInfo = () => {
    if (!comparisonStats?.isInGroup || comparisonStats.percentile === null) {
      return null;
    }

    if (comparisonStats.isTop) {
      return {
        icon: Star,
        label: 'Top Performer',
        color: 'text-amber-700',
        bg: 'bg-amber-100 border-amber-300',
      };
    }

    if (comparisonStats.percentile <= 20) {
      return {
        icon: AlertTriangle,
        label: 'Bottom Performer',
        color: 'text-red-700',
        bg: 'bg-red-100 border-red-300',
      };
    }

    if (comparisonStats.percentile <= 50) {
      return {
        icon: TrendingDown,
        label: 'Below Average',
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
      };
    }

    // Above average but not top - no special badge
    return null;
  };

  const tierInfo = getTierInfo();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!personMetrics) {
    return (
      <div className="space-y-4 p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center py-8 text-gray-500">
          No data found for {salesperson} in this time period.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Mobile Friendly */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-blue-600 font-medium">
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Back to List</span>
        </button>

        {/* Time Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={timePreset}
            onChange={(e) => setTimePreset(e.target.value as ResidentialTimePreset)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Name & Tier Badge */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{salesperson}</h1>
          {tierInfo && (
            <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full border ${tierInfo.bg}`}>
              <tierInfo.icon className={`w-4 h-4 ${tierInfo.color}`} />
              <span className={`text-sm font-medium ${tierInfo.color}`}>{tierInfo.label}</span>
            </div>
          )}
          {!comparisonStats?.isInGroup && (
            <div className="text-sm text-gray-500 mt-2">(Not in comparison group)</div>
          )}
        </div>

        {/* Key Metrics - 2x2 Grid for Mobile */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Target}
            label="Win Rate"
            value={formatResidentialPercent(personMetrics.win_rate)}
            subtext={`${personMetrics.won_opps} of ${personMetrics.total_opps} won`}
            color="blue"
          />
          <MetricCard
            icon={DollarSign}
            label="Won Value"
            value={formatResidentialCurrency(personMetrics.won_value)}
            subtext={`${formatResidentialPercent(personMetrics.value_win_rate)} value rate`}
            color="green"
          />
          <MetricCard
            icon={Clock}
            label="Same Day %"
            value={formatResidentialPercent(personMetrics.pct_same_day)}
            subtext={`P75: ${personMetrics.p75_days_to_quote ?? '-'} days`}
            color="amber"
          />
          <MetricCard
            icon={Award}
            label="Avg Deal"
            value={formatResidentialCurrency(personMetrics.avg_opp_value)}
            subtext={`${personMetrics.total_opps} opportunities`}
            color="purple"
          />
        </div>

        {/* Additional Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance Details</h3>
          <div className="space-y-2 text-sm">
            <StatRow label="Requests Assigned" value={personMetrics.requests_assigned?.toString() ?? '-'} />
            <StatRow label="% Quoted" value={formatResidentialPercent(personMetrics.pct_quoted)} />
            <StatRow label="Multi-Quote %" value={formatResidentialPercent(personMetrics.pct_multi_quote)} />
            <StatRow label="Median Days to Decision" value={personMetrics.median_days_to_decision?.toString() ?? '-'} />
          </div>
        </div>

        {/* Monthly Trend */}
        {monthlyData && monthlyData.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend</h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-500">Month</th>
                    <th className="text-right py-2 font-medium text-gray-500">Opps</th>
                    <th className="text-right py-2 font-medium text-gray-500">Won</th>
                    <th className="text-right py-2 font-medium text-gray-500">Win %</th>
                    <th className="text-right py-2 font-medium text-gray-500">Won $</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {monthlyData.map((month) => (
                    <tr key={month.month}>
                      <td className="py-2 text-gray-900">{month.month_label}</td>
                      <td className="py-2 text-right text-gray-600">{month.total_opps}</td>
                      <td className="py-2 text-right text-green-600">{month.won_opps}</td>
                      <td className="py-2 text-right">
                        <WinRateBadge rate={month.win_rate} />
                      </td>
                      <td className="py-2 text-right text-green-600 font-medium">
                        {formatResidentialCurrency(month.won_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Improvement Tips - Only show for below average */}
        {tierInfo && (tierInfo.label === 'Below Average' || tierInfo.label === 'Bottom Performer') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Focus Areas</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              {personMetrics.pct_same_day !== null && personMetrics.pct_same_day < 50 && (
                <li>• Increase same-day quoting (currently {formatResidentialPercent(personMetrics.pct_same_day)})</li>
              )}
              {personMetrics.pct_multi_quote !== null && personMetrics.pct_multi_quote < 30 && (
                <li>• Offer more quote options to clients</li>
              )}
              {personMetrics.pct_quoted !== null && personMetrics.pct_quoted < 80 && (
                <li>• Follow up on unquoted requests ({formatResidentialPercent(100 - (personMetrics.pct_quoted ?? 0))} not quoted)</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  color: 'blue' | 'green' | 'amber' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{subtext}</div>
    </div>
  );
}

// Stat Row Component
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// Win Rate Badge
function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400">-</span>;

  const color = rate >= 40 ? 'text-green-600' : rate >= 30 ? 'text-blue-600' : rate >= 20 ? 'text-amber-600' : 'text-red-600';

  return <span className={`font-medium ${color}`}>{formatResidentialPercent(rate)}</span>;
}
