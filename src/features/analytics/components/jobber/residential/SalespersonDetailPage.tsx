// Individual Salesperson Detail Page
// Mobile-optimized view with 5 key metrics + individual tier badges

import { useState, useMemo } from 'react';
import { ArrowLeft, Calendar, Star, AlertTriangle, TrendingDown, Target, DollarSign, Clock, Layers, Timer, BarChart3, Users, Award } from 'lucide-react';
import { useResidentialSalespersonMetrics, useResidentialSalespersonMonthly, useComparisonGroup } from '../../../hooks/jobber/residential';
import type { ResidentialFilters, ResidentialTimePreset, SalespersonMetrics } from '../../../types/residential';
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

// Tier types for per-metric badges
type TierType = 'top' | 'bottom' | 'below_average' | null;

interface TierInfo {
  tier: TierType;
  percentile: number;
}

export function SalespersonDetailPage({ salesperson, onBack }: SalespersonDetailPageProps) {
  const [timePreset, setTimePreset] = useState<ResidentialTimePreset>('last_quarter');

  // Build filters for this salesperson
  const filters: ResidentialFilters = useMemo(() => ({
    timePreset,
    dateRange: getResidentialDateRange(timePreset),
    salesperson: null,
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

  // Calculate per-metric tier info
  const metricTiers = useMemo(() => {
    if (!allMetrics || !comparisonGroup || comparisonGroup.length === 0 || !personMetrics) {
      return null;
    }

    const groupMetrics = allMetrics.filter((m) => comparisonGroup.includes(m.salesperson));
    if (groupMetrics.length === 0) return null;

    const isInGroup = comparisonGroup.includes(salesperson);
    if (!isInGroup) return null;

    // Helper to calculate tier for a metric (higher is better by default)
    const calculateTier = (
      getValue: (m: SalespersonMetrics) => number | null,
      lowerIsBetter = false
    ): TierInfo => {
      const values = groupMetrics
        .map((m) => ({ name: m.salesperson, value: getValue(m) }))
        .filter((v) => v.value !== null) as { name: string; value: number }[];

      if (values.length === 0) return { tier: null, percentile: 0 };

      // Sort by value
      values.sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);

      const personIndex = values.findIndex((v) => v.name === salesperson);
      if (personIndex === -1) return { tier: null, percentile: 0 };

      const percentile = ((values.length - personIndex) / values.length) * 100;

      let tier: TierType = null;
      if (personIndex === 0) tier = 'top';
      else if (percentile <= 20) tier = 'bottom';
      else if (percentile <= 50) tier = 'below_average';

      return { tier, percentile };
    };

    return {
      winRate: calculateTier((m) => m.win_rate),
      valueWinRate: calculateTier((m) => m.value_win_rate),
      sameDayPct: calculateTier((m) => m.pct_same_day),
      multiQuotePct: calculateTier((m) => m.pct_multi_quote),
      medianDaysToDecision: calculateTier((m) => m.median_days_to_decision, true), // Lower is better
    };
  }, [allMetrics, comparisonGroup, personMetrics, salesperson]);

  const isInComparisonGroup = comparisonGroup?.includes(salesperson) ?? false;

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
    <div className="space-y-4 max-w-3xl mx-auto">
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

      <div className="px-4 space-y-5">
        {/* Name & Status */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{salesperson}</h1>
          {!isInComparisonGroup && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm">
              <Users className="w-4 h-4" />
              Not in comparison group
            </div>
          )}
        </div>

        {/* 5 Key Metrics with Tier Badges */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Key Performance Metrics</h2>

          {/* Win Rate - Primary KPI */}
          <KeyMetricCard
            icon={Target}
            label="Win Rate"
            value={formatResidentialPercent(personMetrics.win_rate)}
            subtext={`${personMetrics.won_opps} of ${personMetrics.total_opps} opportunities won`}
            tierInfo={metricTiers?.winRate}
            color="blue"
            large
          />

          {/* Value Win Rate */}
          <KeyMetricCard
            icon={DollarSign}
            label="Value Win Rate"
            value={formatResidentialPercent(personMetrics.value_win_rate)}
            subtext={`${formatResidentialCurrency(personMetrics.won_value)} of ${formatResidentialCurrency(personMetrics.total_value)} won`}
            tierInfo={metricTiers?.valueWinRate}
            color="green"
            large
          />

          {/* 3 Secondary Metrics in Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KeyMetricCard
              icon={Clock}
              label="Same Day %"
              value={formatResidentialPercent(personMetrics.pct_same_day)}
              subtext="Quoted same day as request"
              tierInfo={metricTiers?.sameDayPct}
              color="amber"
            />
            <KeyMetricCard
              icon={Layers}
              label="Multi-Quote %"
              value={formatResidentialPercent(personMetrics.pct_multi_quote)}
              subtext="Requests with 2+ options"
              tierInfo={metricTiers?.multiQuotePct}
              color="purple"
            />
            <KeyMetricCard
              icon={Timer}
              label="Median Days to Decision"
              value={personMetrics.median_days_to_decision?.toString() ?? '-'}
              subtext="Days until customer decides"
              tierInfo={metricTiers?.medianDaysToDecision}
              color="indigo"
            />
          </div>
        </div>

        {/* Additional Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            Additional Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <StatBox
              label="Requests Assigned"
              value={personMetrics.requests_assigned?.toString() ?? '-'}
              icon={Users}
            />
            <StatBox
              label="% Quoted"
              value={formatResidentialPercent(personMetrics.pct_quoted)}
              icon={Target}
            />
            <StatBox
              label="Avg Deal Size"
              value={formatResidentialCurrency(personMetrics.avg_opp_value)}
              icon={DollarSign}
            />
            <StatBox
              label="P75 Days to Quote"
              value={personMetrics.p75_days_to_quote?.toString() ?? '-'}
              icon={Clock}
            />
          </div>
        </div>

        {/* Monthly Trend */}
        {monthlyData && monthlyData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-gray-500" />
              Monthly Trend
            </h3>
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

        {/* Improvement Tips - Only for below average or bottom performers */}
        {isInComparisonGroup && metricTiers && hasImprovementAreas(metricTiers) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Focus Areas</h3>
            <ul className="text-sm text-blue-700 space-y-1.5">
              {metricTiers.winRate.tier === 'bottom' && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Win rate is in bottom 20% - focus on closing techniques
                </li>
              )}
              {metricTiers.sameDayPct.tier === 'bottom' && (
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Same-day quoting is low - try to quote on the day of assessment
                </li>
              )}
              {metricTiers.multiQuotePct.tier === 'bottom' && (
                <li className="flex items-start gap-2">
                  <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Offer more quote options to give customers choices
                </li>
              )}
              {(personMetrics.pct_quoted ?? 0) < 80 && (
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  Follow up on unquoted requests ({formatResidentialPercent(100 - (personMetrics.pct_quoted ?? 0))} not quoted)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to check if there are improvement areas
function hasImprovementAreas(tiers: {
  winRate: TierInfo;
  sameDayPct: TierInfo;
  multiQuotePct: TierInfo;
}): boolean {
  return (
    tiers.winRate.tier === 'bottom' ||
    tiers.sameDayPct.tier === 'bottom' ||
    tiers.multiQuotePct.tier === 'bottom'
  );
}

// Key Metric Card with Tier Badge
function KeyMetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  tierInfo,
  color,
  large = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  tierInfo?: TierInfo | null;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'indigo';
  large?: boolean;
}) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      value: 'text-blue-700',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      value: 'text-green-700',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      value: 'text-amber-700',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: 'text-purple-600',
      value: 'text-purple-700',
    },
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      icon: 'text-indigo-600',
      value: 'text-indigo-700',
    },
  };

  const c = colorClasses[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-4 h-4 ${c.icon}`} />
            <span className="text-sm font-medium text-gray-600">{label}</span>
          </div>
          <div className={`${large ? 'text-3xl' : 'text-2xl'} font-bold ${c.value}`}>
            {value}
          </div>
          <div className="text-xs text-gray-500 mt-1">{subtext}</div>
        </div>
        {tierInfo && tierInfo.tier && (
          <TierBadge tier={tierInfo.tier} />
        )}
      </div>
    </div>
  );
}

// Tier Badge Component - Always shows text label (not hidden on mobile)
function TierBadge({ tier }: { tier: TierType }) {
  if (!tier) return null;

  const configs = {
    top: {
      icon: Star,
      label: 'Top Performer',
      classes: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    bottom: {
      icon: AlertTriangle,
      label: 'Bottom 20%',
      classes: 'bg-red-100 text-red-800 border-red-300',
    },
    below_average: {
      icon: TrendingDown,
      label: 'Below Avg',
      classes: 'bg-orange-100 text-orange-700 border-orange-300',
    },
  };

  const config = configs[tier];
  const IconComponent = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border ${config.classes}`}>
      <IconComponent className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
}

// Stat Box for secondary metrics
function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

// Win Rate Badge for monthly table
function WinRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400">-</span>;

  const color = rate >= 40 ? 'text-green-600' : rate >= 30 ? 'text-blue-600' : rate >= 20 ? 'text-amber-600' : 'text-red-600';

  return <span className={`font-medium ${color}`}>{formatResidentialPercent(rate)}</span>;
}
