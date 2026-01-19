// Conversion Funnel Tab - Core metrics and funnel visualization (API Version)
// Shows: 3 rows of metrics (Pipeline, Speed, Cycle Time) + Monthly Trend (stacked)

import { useState, useMemo } from 'react';
import { Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, LabelList, Legend } from 'recharts';
import { TrendingUp, CheckCircle, DollarSign, Percent, Timer, Clock, FileText, Calendar, Wrench, ClipboardList } from 'lucide-react';
import {
  useApiResidentialFunnelMetrics,
  useApiResidentialEnhancedMonthlyTotals,
  useApiResidentialSpeedMetrics,
  useApiResidentialQuoteCountMetrics,
  useApiResidentialWarrantyMetrics,
  useApiResidentialRequestMetrics,
  useApiResidentialMonthlyCycleTrends,
  type ApiEnhancedMonthlyTotals,
  type ApiMonthlyCycleTrends,
} from '../../../../hooks/jobber/residential';
import type { ResidentialFilters } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface ConversionFunnelProps {
  filters: ResidentialFilters;
}

type ViewMode = 'count' | 'value';
type TrendMetric = 'same_day' | 'avg_deal' | 'multi_quote' | 'days_to_decision' | 'days_to_schedule' | 'days_to_close' | 'warranty';

const TREND_METRICS: { key: TrendMetric; label: string; color: string; unit: string }[] = [
  { key: 'same_day', label: '% Same Day', color: '#06B6D4', unit: '%' },
  { key: 'avg_deal', label: 'Avg Deal Size', color: '#10B981', unit: '$' },
  { key: 'multi_quote', label: '% Multi-Quote', color: '#8B5CF6', unit: '%' },
  { key: 'days_to_decision', label: 'Days to Decision', color: '#3B82F6', unit: 'days' },
  { key: 'days_to_schedule', label: 'Days to Schedule', color: '#EC4899', unit: 'days' },
  { key: 'days_to_close', label: 'Days to Close', color: '#EF4444', unit: 'days' },
  { key: 'warranty', label: 'Warranty Jobs', color: '#F59E0B', unit: '#' },
];

export function ConversionFunnel({ filters }: ConversionFunnelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('count');
  const [selectedTrend, setSelectedTrend] = useState<TrendMetric>('same_day');
  const { data: metrics, isLoading } = useApiResidentialFunnelMetrics(filters);
  const { data: monthlyData } = useApiResidentialEnhancedMonthlyTotals(13, filters.revenueBucket || undefined);
  const { data: speedMetrics } = useApiResidentialSpeedMetrics(filters);
  const { data: quoteCountMetrics } = useApiResidentialQuoteCountMetrics(filters);
  const { data: warrantyMetrics } = useApiResidentialWarrantyMetrics(filters);
  const { data: requestMetrics } = useApiResidentialRequestMetrics(filters);
  const { data: cycleTrends } = useApiResidentialMonthlyCycleTrends(13);

  // Calculate LTM (Last Twelve Months) totals from monthly data
  const ltmTotals = useMemo(() => {
    if (!monthlyData || monthlyData.length === 0) return null;
    // Take last 12 months (skip current partial month if we have 13)
    const ltmData = monthlyData.slice(-12);
    const totalPipeline = ltmData.reduce((sum, m) => sum + (m.total_value || 0), 0);
    const totalWon = ltmData.reduce((sum, m) => sum + (m.won_value || 0), 0);
    const totalOpps = ltmData.reduce((sum, m) => sum + m.total_opps, 0);
    const wonOpps = ltmData.reduce((sum, m) => sum + m.won_opps, 0);
    return {
      pipeline: totalPipeline,
      won: totalWon,
      winRateCount: totalOpps > 0 ? (wonOpps / totalOpps) * 100 : null,
      winRateValue: totalPipeline > 0 ? (totalWon / totalPipeline) * 100 : null,
    };
  }, [monthlyData]);

  // Calculate derived metrics - Speed buckets
  const totalSpeedOpps = speedMetrics?.reduce((sum, s) => sum + s.total_opps, 0) || 0;

  const sameDayData = speedMetrics?.find((s) => s.speed_bucket === 'Same day');
  const sameDayPercent = totalSpeedOpps > 0 && sameDayData
    ? (sameDayData.total_opps / totalSpeedOpps) * 100
    : null;

  const multiQuoteOpps = quoteCountMetrics
    ?.filter((q) => q.quote_count_bucket !== '1 quote')
    ?.reduce((sum, q) => sum + q.total_opps, 0) || 0;
  const totalQuoteOpps = quoteCountMetrics?.reduce((sum, q) => sum + q.total_opps, 0) || 0;
  const multiQuotePercent = totalQuoteOpps > 0 ? (multiQuoteOpps / totalQuoteOpps) * 100 : null;

  // Avg Deal Size
  const avgDealSize = metrics && metrics.won_opportunities > 0
    ? metrics.won_value / metrics.won_opportunities
    : null;

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
        No data available. Click "Sync Now" to fetch data from the Jobber API.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: Count-Based Metrics (7 cards) */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
        <MetricCard
          icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
          label="Total Opps (#)"
          value={metrics.total_opportunities.toLocaleString()}
          bgColor="bg-blue-50"
          compact
        />
        <MetricCard
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="Won (#)"
          value={metrics.won_opportunities.toLocaleString()}
          bgColor="bg-green-50"
          compact
        />
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Percent className="w-4 h-4 text-blue-200" />
            <span className="text-xs font-medium text-blue-100">Win Rate %</span>
          </div>
          <div className="text-xl font-bold">{formatResidentialPercent(metrics.win_rate)}</div>
        </div>
        <MetricCard
          icon={<DollarSign className="w-4 h-4 text-teal-600" />}
          label="Avg Deal"
          value={avgDealSize ? formatResidentialCurrency(avgDealSize) : '-'}
          bgColor="bg-teal-50"
          compact
        />
        <MetricCard
          icon={<Timer className="w-4 h-4 text-orange-600" />}
          label="Avg Days to Quote"
          value={metrics.avg_days_to_quote?.toFixed(1) || '-'}
          subValue="assessment → sent"
          bgColor="bg-orange-50"
          compact
        />
        <MetricCard
          icon={<Clock className="w-4 h-4 text-green-600" />}
          label="% Same Day"
          value={sameDayPercent !== null ? `${sameDayPercent.toFixed(1)}%` : '-'}
          subValue={sameDayData ? `win: ${sameDayData.win_rate?.toFixed(0) || '-'}%` : ''}
          bgColor="bg-green-50"
          compact
        />
        <MetricCard
          icon={<FileText className="w-4 h-4 text-violet-600" />}
          label="% Multi-Quote"
          value={multiQuotePercent !== null ? `${multiQuotePercent.toFixed(1)}%` : '-'}
          subValue={`${multiQuoteOpps} of ${totalQuoteOpps}`}
          bgColor="bg-violet-50"
          compact
        />
      </div>

      {/* Row 2: Value & Cycle Time (7 cards) */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
        <MetricCard
          icon={<DollarSign className="w-4 h-4 text-slate-600" />}
          label="Total Opps ($)"
          value={formatResidentialCurrency(metrics.total_value)}
          bgColor="bg-slate-50"
          compact
        />
        <MetricCard
          icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          label="Won ($)"
          value={formatResidentialCurrency(metrics.won_value)}
          bgColor="bg-emerald-50"
          compact
        />
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Percent className="w-4 h-4 text-purple-200" />
            <span className="text-xs font-medium text-purple-100">Value Win %</span>
          </div>
          <div className="text-xl font-bold">{formatResidentialPercent(metrics.value_win_rate)}</div>
        </div>
        <MetricCard
          icon={<Timer className="w-4 h-4 text-blue-600" />}
          label="Day to Decision"
          value={metrics.avg_days_to_decision?.toFixed(1) || '-'}
          subValue="sent → converted"
          bgColor="bg-blue-50"
          compact
        />
        <MetricCard
          icon={<Calendar className="w-4 h-4 text-cyan-600" />}
          label="Day to Schedule"
          value={metrics.avg_days_to_schedule?.toFixed(1) || '-'}
          subValue="converted → sched"
          bgColor="bg-cyan-50"
          compact
        />
        <MetricCard
          icon={<Clock className="w-4 h-4 text-purple-600" />}
          label="Day to Close"
          value={metrics.avg_days_to_close?.toFixed(1) || '-'}
          subValue="sched → closed"
          bgColor="bg-purple-50"
          compact
        />
        <MetricCard
          icon={<Timer className="w-4 h-4 text-gray-600" />}
          label="Total Cycle"
          value={metrics.total_cycle_days?.toFixed(1) || '-'}
          subValue="assess → closed"
          bgColor="bg-gray-100"
          compact
        />
      </div>

      {/* Row 3: Requests & Jobs (5 cards) */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        <MetricCard
          icon={<ClipboardList className="w-4 h-4 text-indigo-600" />}
          label="Requests Received"
          value={(requestMetrics?.total_requests || 0).toLocaleString()}
          bgColor="bg-indigo-50"
          compact
        />
        <MetricCard
          icon={<Calendar className="w-4 h-4 text-indigo-600" />}
          label="Assessments Sched"
          value={(requestMetrics?.assessments_scheduled || 0).toLocaleString()}
          subValue="from request file"
          bgColor="bg-indigo-100"
          compact
        />
        <MetricCard
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="# Paid Jobs"
          value={(warrantyMetrics?.paid_count || 0).toLocaleString()}
          bgColor="bg-green-50"
          compact
        />
        <MetricCard
          icon={<Wrench className="w-4 h-4 text-amber-600" />}
          label="# Warranties"
          value={(warrantyMetrics?.warranty_count || 0).toLocaleString()}
          bgColor="bg-amber-50"
          compact
        />
        <MetricCard
          icon={<Percent className="w-4 h-4 text-rose-600" />}
          label="Warranty %"
          value={warrantyMetrics?.warranty_percent != null ? `${warrantyMetrics.warranty_percent.toFixed(1)}%` : '-'}
          subValue="of paid jobs"
          bgColor="bg-rose-50"
          compact
        />
      </div>

      {/* Monthly Charts - Win Rate + Pipeline with shared toggle */}
      {monthlyData && monthlyData.length > 0 && (
        <div className="space-y-4">
          {/* Shared Toggle */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('count')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  viewMode === 'count'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Count (#)
              </button>
              <button
                onClick={() => setViewMode('value')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                  viewMode === 'value'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Value ($)
              </button>
            </div>
          </div>

          {/* Monthly Win Rate Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Monthly Win Rate {viewMode === 'count' ? '(by #)' : '(by $)'}
            </h3>
            <MonthlyWinRateChart data={monthlyData} viewMode={viewMode} ltmTotals={ltmTotals} />
          </div>

          {/* Monthly Pipeline Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Pipeline Trend</h3>
            <MonthlyTrendRechartsChart data={monthlyData} viewMode={viewMode} ltmTotals={ltmTotals} />
          </div>
        </div>
      )}

      {/* Operational Trends Chart - Full Width, Recharts-based */}
      {cycleTrends && cycleTrends.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Operational Trends</h3>
            <div className="flex flex-wrap gap-1.5">
              {TREND_METRICS.map((metric) => (
                <button
                  key={metric.key}
                  onClick={() => setSelectedTrend(metric.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                    selectedTrend === metric.key
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedTrend === metric.key ? { backgroundColor: metric.color } : {}}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          <OperationalTrendRechartsChart
            data={cycleTrends}
            metric={selectedTrend}
            config={TREND_METRICS.find(m => m.key === selectedTrend)!}
          />
        </div>
      )}

      {/* Monthly Data Table */}
      {monthlyData && monthlyData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Opps</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Lost (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won Value</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlyData.map((month) => (
                  <tr key={month.month} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{month.month_label}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{month.total_opps.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-green-600">{month.won_opps.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-red-600">{month.lost_opps.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.win_rate)}`}>
                        {formatResidentialPercent(month.win_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-green-600">
                      {formatResidentialCurrency(month.won_value)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.value_win_rate)}`}>
                        {formatResidentialPercent(month.value_win_rate)}
                      </span>
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

// Monthly Win Rate Chart
function MonthlyWinRateChart({
  data,
  viewMode,
  ltmTotals,
}: {
  data: ApiEnhancedMonthlyTotals[];
  viewMode: ViewMode;
  ltmTotals: { pipeline: number; won: number; winRateCount: number | null; winRateValue: number | null } | null;
}) {
  const chartData = data.map((month) => ({
    label: month.month_label,
    winRate: viewMode === 'count' ? month.win_rate : month.value_win_rate,
  }));

  const avgWinRate = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + (d.winRate || 0), 0) / chartData.length
    : 0;

  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#374151' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value) => [`${(Number(value) || 0).toFixed(1)}%`, 'Win Rate']}
              contentStyle={{ fontSize: 14 }}
            />
            <Bar dataKey="winRate" name="Win Rate" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="winRate"
                position="top"
                formatter={(value: unknown) => `${(Number(value) || 0).toFixed(0)}%`}
                fill="#8B5CF6"
                fontSize={14}
                fontWeight={700}
                offset={8}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* LTM Win Rate Summary */}
      {ltmTotals && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">LTM Win Rate</div>
              <div className="text-2xl font-bold text-purple-600">
                {viewMode === 'count' ? formatResidentialPercent(ltmTotals.winRateCount) : formatResidentialPercent(ltmTotals.winRateValue)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Average</div>
              <div className="text-2xl font-bold text-gray-700">{(avgWinRate ?? 0).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Monthly Trend Chart with Recharts - Pipeline and Won values
function MonthlyTrendRechartsChart({
  data,
  viewMode,
  ltmTotals,
}: {
  data: ApiEnhancedMonthlyTotals[];
  viewMode: ViewMode;
  ltmTotals: { pipeline: number; won: number; winRateCount: number | null; winRateValue: number | null } | null;
}) {
  const chartData = data.map((month) => ({
    label: month.month_label,
    total: viewMode === 'count' ? month.total_opps : month.total_value,
    won: viewMode === 'count' ? month.won_opps : month.won_value,
  }));

  const formatBarLabel = (value: number) => {
    if (viewMode === 'value') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toString();
    }
    return value.toString();
  };

  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#374151' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number, name: string) => {
                return [viewMode === 'value' ? `$${value.toLocaleString()}` : value.toLocaleString(), name];
              }}
              contentStyle={{ fontSize: 14 }}
            />
            <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
            <Bar dataKey="total" name="Pipeline" fill="#94A3B8" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={(value: unknown) => formatBarLabel(Number(value))}
                fill="#64748B"
                fontSize={12}
                fontWeight={600}
                offset={8}
              />
            </Bar>
            <Bar dataKey="won" name="Won" fill="#10B981" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="won"
                position="top"
                formatter={(value: unknown) => formatBarLabel(Number(value))}
                fill="#059669"
                fontSize={12}
                fontWeight={600}
                offset={8}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* LTM Summary */}
      {ltmTotals && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500 mb-2 text-center">Last 12 Months Summary</div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">Pipeline</div>
              <div className="text-xl font-semibold text-gray-900">{formatResidentialCurrency(ltmTotals.pipeline)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Won</div>
              <div className="text-xl font-semibold text-green-600">{formatResidentialCurrency(ltmTotals.won)}</div>
            </div>
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
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  bgColor: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={`${bgColor} rounded-lg p-3`}>
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <span className="text-xs font-medium text-gray-600 truncate">{label}</span>
        </div>
        <div className="text-lg font-bold text-gray-900">{value}</div>
        {subValue && <div className="text-[10px] text-gray-500 mt-0.5 truncate">{subValue}</div>}
      </div>
    );
  }

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

function getWinRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-500';
  if (rate >= 40) return 'text-green-600';
  if (rate >= 30) return 'text-blue-600';
  if (rate >= 20) return 'text-amber-600';
  return 'text-red-600';
}

// Operational Trend Chart with Recharts
function OperationalTrendRechartsChart({
  data,
  metric,
  config,
}: {
  data: ApiMonthlyCycleTrends[];
  metric: TrendMetric;
  config: { label: string; color: string; unit: string };
}) {
  // Map metric key to data field - with null safety
  const getValue = (item: ApiMonthlyCycleTrends): number => {
    switch (metric) {
      case 'same_day': return item.same_day_percent ?? 0;
      case 'avg_deal': return item.avg_won_deal ?? 0;
      case 'multi_quote': return item.multi_quote_percent ?? 0;
      case 'days_to_decision': return item.avg_days_to_decision ?? 0;
      case 'days_to_schedule': return item.avg_days_to_schedule ?? 0;
      case 'days_to_close': return item.avg_days_to_close ?? 0;
      case 'warranty': return item.warranty_count ?? 0;
      default: return 0;
    }
  };

  const chartData = data.map((item) => ({
    label: item.month_label,
    value: getValue(item),
  }));

  const avgValue = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
    : 0;

  // Format value based on unit - with null safety
  const formatValue = (val: number | null | undefined): string => {
    const v = val ?? 0;
    if (config.unit === '$') {
      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
      return `$${v.toFixed(0)}`;
    }
    if (config.unit === '%') return `${v.toFixed(1)}%`;
    if (config.unit === 'days') return v.toFixed(1);
    return v.toLocaleString();
  };

  const formatBarLabel = (val: number | null | undefined): string => {
    const v = val ?? 0;
    if (config.unit === '$') {
      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
      return v.toString();
    }
    if (config.unit === '%') return `${v.toFixed(0)}%`;
    if (config.unit === 'days') return v.toFixed(1);
    return v.toFixed(0);
  };

  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 30, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 14, fill: '#374151' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(value: number) => [formatValue(value), config.label]}
              contentStyle={{ fontSize: 14 }}
            />
            <Bar dataKey="value" name={config.label} fill={config.color} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value: unknown) => formatBarLabel(Number(value))}
                fill="#374151"
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-sm text-gray-500">Average</div>
            <div className="text-xl font-semibold" style={{ color: config.color }}>{formatValue(avgValue)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Latest</div>
            <div className="text-xl font-semibold text-gray-900">{formatValue(chartData[chartData.length - 1]?.value || 0)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Trend</div>
            <div className="text-xl font-semibold">
              {chartData.length >= 2 ? (
                chartData[chartData.length - 1].value > chartData[chartData.length - 2].value ? (
                  <span className="text-amber-600">↑</span>
                ) : chartData[chartData.length - 1].value < chartData[chartData.length - 2].value ? (
                  <span className="text-green-600">↓</span>
                ) : (
                  <span className="text-gray-500">→</span>
                )
              ) : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
