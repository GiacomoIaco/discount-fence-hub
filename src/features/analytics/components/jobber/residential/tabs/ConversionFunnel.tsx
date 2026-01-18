// Conversion Funnel Tab - Core metrics and funnel visualization
// Shows: 3 rows of metrics (Pipeline, Speed, Cycle Time) + Monthly Trend

import { useState, useMemo } from 'react';
import { TrendingUp, CheckCircle, DollarSign, Percent, Timer, Clock, FileText, Calendar, Wrench, ClipboardList } from 'lucide-react';
import {
  useResidentialFunnelMetrics,
  useResidentialEnhancedMonthlyTotals,
  useResidentialSpeedMetrics,
  useResidentialQuoteCountMetrics,
  useResidentialWarrantyMetrics,
  useResidentialRequestMetrics,
  useResidentialMonthlyCycleTrends,
} from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, MonthlyTotals, MonthlyCycleTrends } from '../../../../types/residential';
import { formatResidentialCurrency, formatResidentialPercent } from '../../../../types/residential';

interface ConversionFunnelProps {
  filters: ResidentialFilters;
}

type ViewMode = 'count' | 'value';
type TrendMetric = 'days_to_quote' | 'avg_deal' | 'same_day' | 'multi_quote' | 'days_to_decision' | 'days_to_schedule' | 'days_to_close' | 'warranty';

const TREND_METRICS: { key: TrendMetric; label: string; color: string; unit: string }[] = [
  { key: 'days_to_quote', label: 'Days to Quote', color: '#F97316', unit: 'days' },
  { key: 'avg_deal', label: 'Avg Deal Size', color: '#10B981', unit: '$' },
  { key: 'same_day', label: '% Same Day', color: '#06B6D4', unit: '%' },
  { key: 'multi_quote', label: '% Multi-Quote', color: '#8B5CF6', unit: '%' },
  { key: 'days_to_decision', label: 'Days to Decision', color: '#3B82F6', unit: 'days' },
  { key: 'days_to_schedule', label: 'Days to Schedule', color: '#EC4899', unit: 'days' },
  { key: 'days_to_close', label: 'Days to Close', color: '#EF4444', unit: 'days' },
  { key: 'warranty', label: 'Warranty Jobs', color: '#F59E0B', unit: '#' },
];

export function ConversionFunnel({ filters }: ConversionFunnelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('count');
  const [selectedTrend, setSelectedTrend] = useState<TrendMetric>('days_to_quote');
  const { data: metrics, isLoading } = useResidentialFunnelMetrics(filters);
  const { data: monthlyData } = useResidentialEnhancedMonthlyTotals(13, filters.revenueBucket || undefined);
  const { data: speedMetrics } = useResidentialSpeedMetrics(filters);
  const { data: quoteCountMetrics } = useResidentialQuoteCountMetrics(filters);
  const { data: warrantyMetrics } = useResidentialWarrantyMetrics(filters);
  const { data: requestMetrics } = useResidentialRequestMetrics(filters);
  const { data: cycleTrends } = useResidentialMonthlyCycleTrends(13);

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

  // Avg Deal Size (excluding warranties - approximated as won_value > 0)
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
        No data available. Upload Residential CSV files to get started.
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
          label="P75 Days to Quote"
          value={metrics.p75_days_to_quote?.toFixed(1) || '-'}
          subValue="75th percentile"
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

      {/* Two Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Histogram with Toggle */}
        {monthlyData && monthlyData.length > 0 && (
          <div className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full" />
                <h3 className="text-sm font-semibold text-stone-800">Monthly Trend</h3>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-stone-100 rounded-lg">
                <button
                  onClick={() => setViewMode('count')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                    viewMode === 'count'
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  #
                </button>
                <button
                  onClick={() => setViewMode('value')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${
                    viewMode === 'value'
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  $
                </button>
              </div>
            </div>

            {/* Histogram Chart */}
            <div className="p-4">
              <MonthlyHistogram data={monthlyData} viewMode={viewMode} ltmTotals={ltmTotals} />
            </div>
          </div>
        )}

        {/* Operational Trends Section */}
        {cycleTrends && cycleTrends.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header with Metric Selector */}
            <div className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full" />
                <h3 className="text-sm font-semibold text-gray-800">Operational Trends</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TREND_METRICS.map((metric) => (
                  <button
                    key={metric.key}
                    onClick={() => setSelectedTrend(metric.key)}
                    className={`px-2 py-1 text-[10px] font-medium rounded-full transition-all duration-200 ${
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

            {/* Trend Chart */}
            <div className="p-4">
              <OperationalTrendChart
                data={cycleTrends}
                metric={selectedTrend}
                config={TREND_METRICS.find(m => m.key === selectedTrend)!}
              />
            </div>
          </div>
        )}
      </div>

      {/* Monthly Data Table - Always show all columns */}
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
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Win Rate (#)</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Opp Value</th>
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
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${getWinRateColor(month.win_rate)}`}>
                        {formatResidentialPercent(month.win_rate)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {formatResidentialCurrency(month.total_value)}
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

// Monthly Histogram Component - Hybrid Editorial + Modern Design
function MonthlyHistogram({
  data,
  viewMode,
  ltmTotals
}: {
  data: MonthlyTotals[];
  viewMode: ViewMode;
  ltmTotals: { pipeline: number; won: number; winRateCount: number | null; winRateValue: number | null } | null;
}) {
  // Prepare chart data based on view mode
  const chartData = data.map((month) => ({
    label: month.month_label,
    shortLabel: month.month_label.slice(0, 3),
    total: viewMode === 'count' ? month.total_opps : month.total_value,
    won: viewMode === 'count' ? month.won_opps : month.won_value,
    winRate: viewMode === 'count' ? month.win_rate : month.value_win_rate,
  }));

  // Calculate max for scaling
  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);

  // Calculate average win rate
  const validRates = chartData.filter((d) => d.winRate !== null);
  const avgWinRate =
    validRates.length > 0
      ? validRates.reduce((sum, d) => sum + (d.winRate || 0), 0) / validRates.length
      : 0;

  // Reduced bar height for side-by-side layout
  const barAreaHeight = 140;

  return (
    <div className="relative">
      {/* Chart Area - no grid lines to save space */}
      <div className="relative">
        {/* Bars Container - tighter gaps */}
        <div className="flex items-end gap-1" style={{ height: barAreaHeight }}>
          {chartData.map((item, idx) => {
            const isHighPerformer = (item.winRate || 0) >= avgWinRate;

            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end group min-w-0 h-full">
                {/* Win Rate Label - always above bars */}
                <div className="text-[9px] font-bold mb-0.5" style={{ color: isHighPerformer ? '#0D9488' : '#9CA3AF' }}>
                  {item.winRate !== null ? `${item.winRate.toFixed(0)}%` : ''}
                </div>

                {/* Bar Stack */}
                <div className="relative w-full max-w-[20px]" style={{ height: barAreaHeight - 16 }}>
                  {/* Total bar (background) */}
                  <div
                    className="absolute bottom-0 w-full bg-stone-200/80 rounded-t-sm"
                    style={{ height: Math.max((item.total / maxTotal) * (barAreaHeight - 16), 2) }}
                  />
                  {/* Won bar (foreground) */}
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-gradient-to-t from-[#E07A5F] to-[#F2A490]"
                    style={{ height: Math.max((item.won / maxTotal) * (barAreaHeight - 16), 0) }}
                  />

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                                  opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <div className="bg-white border border-stone-200 rounded shadow-lg px-2 py-1.5 min-w-[100px] text-[10px]">
                      <div className="font-semibold text-stone-600 mb-1">{item.label}</div>
                      <div className="flex justify-between"><span>Pipeline:</span><span className="font-medium">{viewMode === 'count' ? item.total : formatResidentialCurrency(item.total)}</span></div>
                      <div className="flex justify-between text-[#E07A5F]"><span>Won:</span><span className="font-medium">{viewMode === 'count' ? item.won : formatResidentialCurrency(item.won)}</span></div>
                      <div className="flex justify-between font-bold"><span>Win %:</span><span>{formatResidentialPercent(item.winRate)}</span></div>
                    </div>
                  </div>
                </div>

                {/* Month Label */}
                <span className="mt-1 text-[8px] font-medium text-stone-500">{item.shortLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Legend */}
      <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-center gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-stone-300 rounded-sm" />
          <span className="text-stone-500">Pipeline</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[#E07A5F] rounded-sm" />
          <span className="text-stone-500">Won</span>
        </div>
        {ltmTotals && (
          <>
            <span className="text-stone-300">|</span>
            <span className="text-stone-500">LTM: {formatResidentialCurrency(ltmTotals.won)} ({viewMode === 'count' ? formatResidentialPercent(ltmTotals.winRateCount) : formatResidentialPercent(ltmTotals.winRateValue)})</span>
          </>
        )}
      </div>
    </div>
  );
}

// Operational Trend Chart Component
function OperationalTrendChart({
  data,
  metric,
  config,
}: {
  data: MonthlyCycleTrends[];
  metric: TrendMetric;
  config: { label: string; color: string; unit: string };
}) {
  // Map metric key to data field
  const getValue = (item: MonthlyCycleTrends): number => {
    switch (metric) {
      case 'days_to_quote': return item.avg_days_to_quote;
      case 'avg_deal': return item.avg_won_deal;
      case 'same_day': return item.same_day_percent;
      case 'multi_quote': return item.multi_quote_percent;
      case 'days_to_decision': return item.avg_days_to_decision;
      case 'days_to_schedule': return item.avg_days_to_schedule;
      case 'days_to_close': return item.avg_days_to_close;
      case 'warranty': return item.warranty_count;
      default: return 0;
    }
  };

  const chartData = data.map((item) => ({
    label: item.month_label,
    shortLabel: item.month_label.slice(0, 3),
    value: getValue(item),
  }));

  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const avgValue = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;
  const barAreaHeight = 140; // Reduced for side-by-side

  // Format value based on unit
  const formatValue = (val: number): string => {
    if (config.unit === '$') return formatResidentialCurrency(val);
    if (config.unit === '%') return `${val.toFixed(1)}%`;
    if (config.unit === 'days') return val.toFixed(1);
    return val.toLocaleString();
  };

  const formatShortValue = (val: number): string => {
    if (config.unit === '$') return `${(val / 1000).toFixed(0)}k`;
    if (config.unit === '%') return `${val.toFixed(0)}%`;
    if (config.unit === 'days') return val.toFixed(1);
    return val.toFixed(0);
  };

  return (
    <div className="relative">
      {/* Bars - tighter gaps */}
      <div className="flex items-end gap-1" style={{ height: barAreaHeight }}>
        {chartData.map((item, idx) => {
          const heightPx = Math.max((item.value / maxValue) * (barAreaHeight - 16), 2);
          const isAboveAvg = item.value >= avgValue;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end group min-w-0">
              {/* Value above bar */}
              <div className="text-[8px] font-bold mb-0.5" style={{ color: config.color }}>
                {formatShortValue(item.value)}
              </div>

              {/* Bar */}
              <div
                className="w-full max-w-[16px] rounded-t"
                style={{
                  height: heightPx,
                  backgroundColor: isAboveAvg ? config.color : config.color + '60',
                }}
              />

              {/* Month label */}
              <span className="mt-1 text-[8px] font-medium text-gray-400">
                {item.shortLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Compact Summary */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-center gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: config.color }} />
          <span className="text-gray-500">{config.label}</span>
        </div>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Avg: {formatValue(avgValue)}</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">Latest: <span className="font-bold" style={{ color: config.color }}>{formatValue(chartData[chartData.length - 1]?.value || 0)}</span></span>
      </div>
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
