// Executive Summary Cards for Jobber Dashboard

import { DollarSign, Briefcase, Clock, BarChart, Percent, RefreshCw } from 'lucide-react';
import { MetricCard } from '../shared/MetricCard';
import { useJobberJobs, useOpenJobs } from '../../../hooks/jobber/useJobberJobs';
import { useQuoteConversionMetrics } from '../../../hooks/jobber/useJobberQuotes';
import type { JobberFilters } from '../../../types/jobber';

interface ExecutiveSummaryCardsProps {
  filters: JobberFilters;
}

export function ExecutiveSummaryCards({ filters }: ExecutiveSummaryCardsProps) {
  const { data: jobs, isLoading: jobsLoading } = useJobberJobs({ filters });
  const { data: openJobs, isLoading: openLoading } = useOpenJobs(filters);
  const { data: quoteMetrics, isLoading: quoteLoading } = useQuoteConversionMetrics(filters);

  // Calculate metrics from jobs data
  const totalRevenue = (jobs || []).reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);

  // Cycle time
  const closedJobs = (jobs || []).filter(j => j.total_cycle_days !== null && j.total_cycle_days >= 0);
  const avgCycleDays = closedJobs.length > 0
    ? closedJobs.reduce((sum, j) => sum + (j.total_cycle_days || 0), 0) / closedJobs.length
    : 0;

  // Open pipeline
  const openPipelineValue = (openJobs || []).reduce((sum, j) => sum + Number(j.total_revenue || 0), 0);
  const openPipelineCount = (openJobs || []).length;

  // QBO Sync rate (jobs with both material and labor on QBO)
  // Check for both "Material + Crew Pay" and "Material and Crew Pay" variations
  const qboSynced = (jobs || []).filter(j =>
    j.on_qbo?.includes('Material') && j.on_qbo?.includes('Crew')
  ).length;
  const qboSyncRate = (jobs || []).length > 0 ? (qboSynced / (jobs || []).length) * 100 : 0;

  // Job breakdown by size
  const totalJobs = (jobs || []).length;
  const substantialJobs = (jobs || []).filter(j => Number(j.total_revenue || 0) > 500).length;
  const smallJobs = (jobs || []).filter(j => {
    const rev = Number(j.total_revenue || 0);
    return rev > 0 && rev <= 500;
  }).length;
  const warrantyJobs = (jobs || []).filter(j => Number(j.total_revenue || 0) === 0).length;
  const warrantyOfSubstantialPct = substantialJobs > 0 ? (warrantyJobs / substantialJobs) * 100 : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const isLoading = jobsLoading || openLoading || quoteLoading;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Row 1 - Revenue and Jobs */}
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(totalRevenue)}
        subtitle={`${totalJobs.toLocaleString()} total jobs`}
        icon={DollarSign}
        color="green"
        loading={isLoading}
      />
      <MetricCard
        title="Jobs >$500"
        value={substantialJobs.toLocaleString()}
        subtitle={`Avg: ${formatCurrency(substantialJobs > 0 ? totalRevenue / substantialJobs : 0)}`}
        icon={Briefcase}
        color="blue"
        loading={isLoading}
      />
      <MetricCard
        title="Small ($1-500)"
        value={smallJobs.toLocaleString()}
        subtitle="Lower value jobs"
        icon={Briefcase}
        color="gray"
        loading={isLoading}
      />
      <MetricCard
        title="Warranty ($0)"
        value={warrantyJobs.toLocaleString()}
        subtitle={`${warrantyOfSubstantialPct.toFixed(1)}% of >$500`}
        icon={Briefcase}
        color={warrantyOfSubstantialPct > 20 ? 'red' : 'orange'}
        loading={isLoading}
      />

      {/* Row 2 - Performance */}
      <MetricCard
        title="Avg Cycle"
        value={`${avgCycleDays.toFixed(1)} days`}
        subtitle="Create → Close"
        icon={Clock}
        color="orange"
        loading={isLoading}
      />
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
