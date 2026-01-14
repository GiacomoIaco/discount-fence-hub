// Executive Summary Cards for Jobber Dashboard

import { DollarSign, Briefcase, TrendingUp, Clock, BarChart, Percent, Zap, RefreshCw } from 'lucide-react';
import { MetricCard } from '../shared/MetricCard';
import { useJobberJobs, useOpenJobs } from '../../../hooks/jobber/useJobberJobs';
import { useQuoteConversionMetrics } from '../../../hooks/jobber/useJobberQuotes';
import { useSpeedToInvoice } from '../../../hooks/jobber/useCycleTimeMetrics';
import type { JobberFilters } from '../../../types/jobber';

interface ExecutiveSummaryCardsProps {
  filters: JobberFilters;
}

export function ExecutiveSummaryCards({ filters }: ExecutiveSummaryCardsProps) {
  const { data: jobs, isLoading: jobsLoading } = useJobberJobs({ filters });
  const { data: openJobs, isLoading: openLoading } = useOpenJobs(filters);
  const { data: quoteMetrics, isLoading: quoteLoading } = useQuoteConversionMetrics(filters);
  const { data: speedToInvoice, isLoading: invoiceLoading } = useSpeedToInvoice(filters);

  // Calculate metrics from jobs data
  const totalRevenue = (jobs || []).reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);
  const billableJobs = (jobs || []).filter(j => j.is_substantial).length;
  const avgJobValue = billableJobs > 0 ? totalRevenue / billableJobs : 0;

  // Cycle time
  const closedJobs = (jobs || []).filter(j => j.total_cycle_days !== null && j.total_cycle_days >= 0);
  const avgCycleDays = closedJobs.length > 0
    ? closedJobs.reduce((sum, j) => sum + (j.total_cycle_days || 0), 0) / closedJobs.length
    : 0;

  // Open pipeline
  const openPipelineValue = (openJobs || []).reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);
  const openPipelineCount = (openJobs || []).length;

  // QBO Sync rate (jobs with both material and labor on QBO)
  const qboSynced = (jobs || []).filter(j =>
    j.on_qbo === 'Material + Crew Pay' || j.on_qbo === 'Yes'
  ).length;
  const qboSyncRate = (jobs || []).length > 0 ? (qboSynced / (jobs || []).length) * 100 : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const isLoading = jobsLoading || openLoading || quoteLoading || invoiceLoading;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Row 1 */}
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(totalRevenue)}
        subtitle="All jobs"
        icon={DollarSign}
        color="green"
        loading={isLoading}
      />
      <MetricCard
        title="Billable Jobs"
        value={billableJobs.toLocaleString()}
        subtitle="Jobs > $300"
        icon={Briefcase}
        color="blue"
        loading={isLoading}
      />
      <MetricCard
        title="Avg Job Value"
        value={formatCurrency(avgJobValue)}
        subtitle="Rev / Billable"
        icon={TrendingUp}
        color="purple"
        loading={isLoading}
      />
      <MetricCard
        title="Avg Cycle"
        value={`${avgCycleDays.toFixed(1)} days`}
        subtitle="Create → Close"
        icon={Clock}
        color="orange"
        loading={isLoading}
      />

      {/* Row 2 */}
      <MetricCard
        title="Open Pipeline"
        value={formatCurrency(openPipelineValue)}
        subtitle={`${openPipelineCount} jobs`}
        icon={BarChart}
        color="blue"
        loading={isLoading}
      />
      <MetricCard
        title="Quote Conv %"
        value={`${(quoteMetrics?.conversionRate || 0).toFixed(1)}%`}
        subtitle="Converted"
        icon={Percent}
        color="green"
        loading={isLoading}
      />
      <MetricCard
        title="Speed to Invoice"
        value={`${(speedToInvoice?.average || 0).toFixed(1)} days`}
        subtitle="Close → Invoice"
        icon={Zap}
        color="purple"
        loading={isLoading}
      />
      <MetricCard
        title="QBO Synced"
        value={`${qboSyncRate.toFixed(0)}%`}
        subtitle="Mat + Labor"
        icon={RefreshCw}
        color={qboSyncRate > 50 ? 'green' : 'orange'}
        loading={isLoading}
      />
    </div>
  );
}
