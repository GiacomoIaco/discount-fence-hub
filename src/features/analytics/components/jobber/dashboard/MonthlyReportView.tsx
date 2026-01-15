// Monthly Report View - AI observations with manager comments

import { useState, useMemo } from 'react';
import { FileText, Sparkles, MessageSquare, TrendingUp, AlertTriangle, CheckCircle, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { useJobberJobs } from '../../../hooks/jobber';
import type { JobberFilters, MonthlyReportObservation, MonthlyReportComment, DateFieldType } from '../../../types/jobber';

interface MonthlyReportViewProps {
  filters: JobberFilters;
}

// Generate AI observations from the data
function generateObservations(data: {
  totalRevenue: number;
  totalJobs: number;
  standardJobs: number;
  smallJobs: number;
  warrantyJobs: number;
  avgCycleDays: number | null;
  warrantyRate: number;
  topSalesperson: { name: string; revenue: number } | null;
  bottomSalesperson: { name: string; revenue: number } | null;
  topClient: { name: string; revenue: number } | null;
  revenueVsPriorMonth: number | null;
  jobsVsPriorMonth: number | null;
}): MonthlyReportObservation[] {
  const observations: MonthlyReportObservation[] = [];

  // Revenue observation
  if (data.revenueVsPriorMonth !== null) {
    const isPositive = data.revenueVsPriorMonth > 0;
    observations.push({
      id: 'rev-1',
      category: 'revenue',
      title: isPositive ? 'Revenue Growth' : 'Revenue Decline',
      observation: `Total revenue ${isPositive ? 'increased' : 'decreased'} by ${Math.abs(data.revenueVsPriorMonth).toFixed(1)}% compared to prior month. Current month: $${data.totalRevenue.toLocaleString()}.`,
      impact: isPositive ? 'positive' : 'negative',
      metric_value: `${isPositive ? '+' : ''}${data.revenueVsPriorMonth.toFixed(1)}%`,
      priority: Math.abs(data.revenueVsPriorMonth) > 20 ? 'high' : 'medium',
    });
  }

  // Warranty rate observation
  if (data.warrantyRate > 15) {
    observations.push({
      id: 'warr-1',
      category: 'warranty',
      title: 'Elevated Warranty Rate',
      observation: `Warranty rate of ${data.warrantyRate.toFixed(1)}% is above the 15% target. ${data.warrantyJobs} warranty jobs out of ${data.totalJobs} total jobs. Consider investigating root causes.`,
      impact: 'negative',
      metric_value: `${data.warrantyRate.toFixed(1)}%`,
      comparison_value: '15% target',
      priority: data.warrantyRate > 25 ? 'high' : 'medium',
    });
  } else if (data.warrantyRate < 10) {
    observations.push({
      id: 'warr-2',
      category: 'warranty',
      title: 'Strong Quality Performance',
      observation: `Warranty rate of ${data.warrantyRate.toFixed(1)}% is well below the 15% target. Great job on quality control!`,
      impact: 'positive',
      metric_value: `${data.warrantyRate.toFixed(1)}%`,
      priority: 'low',
    });
  }

  // Cycle time observation
  if (data.avgCycleDays !== null) {
    if (data.avgCycleDays > 30) {
      observations.push({
        id: 'cycle-1',
        category: 'cycle_time',
        title: 'Extended Cycle Times',
        observation: `Average cycle time of ${data.avgCycleDays.toFixed(0)} days exceeds the 30-day target. Review scheduling efficiency and potential bottlenecks.`,
        impact: 'negative',
        metric_value: `${data.avgCycleDays.toFixed(0)} days`,
        comparison_value: '30-day target',
        priority: data.avgCycleDays > 45 ? 'high' : 'medium',
      });
    } else if (data.avgCycleDays < 20) {
      observations.push({
        id: 'cycle-2',
        category: 'cycle_time',
        title: 'Efficient Operations',
        observation: `Average cycle time of ${data.avgCycleDays.toFixed(0)} days is well under target. The team is executing efficiently.`,
        impact: 'positive',
        metric_value: `${data.avgCycleDays.toFixed(0)} days`,
        priority: 'low',
      });
    }
  }

  // Top salesperson
  if (data.topSalesperson) {
    observations.push({
      id: 'sp-1',
      category: 'salesperson',
      title: 'Top Performer',
      observation: `${data.topSalesperson.name} led the team with $${data.topSalesperson.revenue.toLocaleString()} in revenue this month.`,
      impact: 'positive',
      metric_value: `$${(data.topSalesperson.revenue / 1000).toFixed(0)}K`,
      priority: 'medium',
    });
  }

  // Opportunity: small jobs
  if (data.smallJobs > data.standardJobs * 0.5) {
    observations.push({
      id: 'opp-1',
      category: 'opportunity',
      title: 'High Volume of Small Jobs',
      observation: `${data.smallJobs} small jobs ($1-500) this month. Consider strategies to convert more small inquiries into larger projects or bundle small jobs for efficiency.`,
      impact: 'neutral',
      metric_value: `${data.smallJobs} jobs`,
      priority: 'medium',
    });
  }

  return observations;
}

export function MonthlyReportView({ filters }: MonthlyReportViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // null until we determine best default
  const [comments, setComments] = useState<MonthlyReportComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [expandedObservations, setExpandedObservations] = useState<Set<string>>(new Set());

  // Memoize the broad filters to prevent query key from changing on every render
  const broadFilters = useMemo((): JobberFilters => {
    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
    fifteenMonthsAgo.setDate(1); // Start of month

    return {
      ...filters,
      timePreset: 'custom',
      dateRange: { start: fifteenMonthsAgo, end: new Date() },
      dateField: 'created_date' as DateFieldType, // Always use created_date for broad fetch, then filter by closed_date client-side
    };
  }, [filters.salesperson, filters.location, filters.jobSizes]);

  const { data: allJobs, isLoading: jobsLoading } = useJobberJobs({ filters: broadFilters });

  // Detect available months with closed jobs and auto-select the most recent one
  const availableMonths = useMemo(() => {
    if (!allJobs) return [];

    const monthSet = new Set<string>();
    for (const job of allJobs) {
      if (job.closed_date) {
        const date = new Date(job.closed_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthSet.add(monthKey);
      }
    }

    // Sort descending (most recent first)
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [allJobs]);

  // Set default month to most recent with data, or current month if no data
  useMemo(() => {
    if (selectedMonth === null && !jobsLoading) {
      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]); // Most recent month with data
      } else {
        const now = new Date();
        setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }, [availableMonths, jobsLoading, selectedMonth]);

  // Fetch all jobs and filter client-side by closed_date for monthly reports
  // This is more accurate for business performance (when jobs were completed)
  const effectiveMonth = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthStart = new Date(effectiveMonth + '-01');

  // Check if this is the current month (partial month reporting)
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = effectiveMonth === currentMonthKey;

  // For current month, use today's date; for past months, use end of month
  const monthEnd = isCurrentMonth
    ? now  // Today's date for partial month
    : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);  // End of month for complete months

  // Filter jobs by closed_date for the selected month
  const currentJobs = useMemo(() => {
    if (!allJobs) return [];
    return allJobs.filter(job => {
      if (!job.closed_date) return false;
      const closedDate = new Date(job.closed_date);
      return closedDate >= monthStart && closedDate <= monthEnd;
    });
  }, [allJobs, effectiveMonth]);

  // Prior month jobs for comparison
  const priorMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const priorMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0);

  const priorJobs = useMemo(() => {
    if (!allJobs) return [];
    return allJobs.filter(job => {
      if (!job.closed_date) return false;
      const closedDate = new Date(job.closed_date);
      return closedDate >= priorMonthStart && closedDate <= priorMonthEnd;
    });
  }, [allJobs, effectiveMonth]);

  const { reportData, observations } = useMemo(() => {
    if (!currentJobs) return { reportData: null, observations: [] };

    // Calculate current month stats
    let totalRevenue = 0;
    let standardJobs = 0;
    let smallJobs = 0;
    let warrantyJobs = 0;
    let cycleDays: number[] = [];
    const salespersonRevenue = new Map<string, number>();
    const clientRevenue = new Map<string, number>();

    for (const job of currentJobs) {
      const revenue = Number(job.total_revenue) || 0;
      totalRevenue += revenue;

      if (revenue > 500) standardJobs++;
      else if (revenue > 0) smallJobs++;
      else warrantyJobs++;

      if (job.total_cycle_days !== null && job.total_cycle_days >= 0) {
        cycleDays.push(job.total_cycle_days);
      }

      const sp = job.effective_salesperson || '(Unassigned)';
      if (sp !== '(Unassigned)') {
        salespersonRevenue.set(sp, (salespersonRevenue.get(sp) || 0) + revenue);
      }

      const client = job.client_name || 'Unknown';
      if (client !== 'Unknown') {
        clientRevenue.set(client, (clientRevenue.get(client) || 0) + revenue);
      }
    }

    const totalJobs = currentJobs.length;
    const warrantyRate = totalJobs > 0 ? (warrantyJobs / totalJobs) * 100 : 0;
    const avgCycleDays = cycleDays.length > 0
      ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length
      : null;

    // Calculate prior month for comparison
    let priorRevenue = 0;
    let priorJobsCount = 0;
    if (priorJobs) {
      priorRevenue = priorJobs.reduce((sum, j) => sum + (Number(j.total_revenue) || 0), 0);
      priorJobsCount = priorJobs.length;
    }

    const revenueVsPriorMonth = priorRevenue > 0
      ? ((totalRevenue - priorRevenue) / priorRevenue) * 100
      : null;
    const jobsVsPriorMonth = priorJobsCount > 0
      ? ((totalJobs - priorJobsCount) / priorJobsCount) * 100
      : null;

    // Top/bottom salesperson
    const spSorted = Array.from(salespersonRevenue.entries()).sort((a, b) => b[1] - a[1]);
    const topSalesperson = spSorted.length > 0 ? { name: spSorted[0][0], revenue: spSorted[0][1] } : null;
    const bottomSalesperson = spSorted.length > 1 ? { name: spSorted[spSorted.length - 1][0], revenue: spSorted[spSorted.length - 1][1] } : null;

    // Top client
    const clientSorted = Array.from(clientRevenue.entries()).sort((a, b) => b[1] - a[1]);
    const topClient = clientSorted.length > 0 ? { name: clientSorted[0][0], revenue: clientSorted[0][1] } : null;

    const reportData = {
      totalRevenue,
      totalJobs,
      standardJobs,
      smallJobs,
      warrantyJobs,
      avgCycleDays,
      warrantyRate,
      topSalesperson,
      bottomSalesperson,
      topClient,
      revenueVsPriorMonth,
      jobsVsPriorMonth,
    };

    const observations = generateObservations(reportData);

    return { reportData, observations };
  }, [currentJobs, priorJobs]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: MonthlyReportComment = {
      id: Date.now().toString(),
      observation_id: null,
      author: 'Manager', // Would come from auth context
      content: newComment.trim(),
      created_at: new Date().toISOString(),
    };

    setComments([...comments, comment]);
    setNewComment('');
  };

  const toggleObservation = (id: string) => {
    const next = new Set(expandedObservations);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedObservations(next);
  };

  const getImpactIcon = (impact: 'positive' | 'negative' | 'neutral') => {
    switch (impact) {
      case 'positive': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'negative': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default: return <TrendingUp className="w-5 h-5 text-gray-500" />;
    }
  };

  const getMonthOptions = () => {
    // Use available months from data, plus current month if not in list
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Build set of all months to show (available months + current month)
    const monthsToShow = new Set(availableMonths);
    monthsToShow.add(currentMonthKey);

    // Also add last 12 months for browsing
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthsToShow.add(key);
    }

    // Sort descending and create options
    const sortedMonths = Array.from(monthsToShow).sort((a, b) => b.localeCompare(a));

    return sortedMonths.map(value => {
      const [year, month] = value.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const hasData = availableMonths.includes(value);
      return { value, label, hasData };
    });
  };

  const isLoading = jobsLoading || selectedMonth === null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Report</h3>
        <div className="h-96 bg-gray-100 animate-pulse rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Monthly Report</h2>
            {isCurrentMonth && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                Through {monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={effectiveMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}{!opt.hasData ? ' (no data)' : ''}{opt.value === currentMonthKey ? ' (partial)' : ''}
                </option>
              ))}
            </select>

            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Send className="w-4 h-4" />
              Send Report
            </button>
          </div>
        </div>

        {/* Empty state when no closed jobs for selected month */}
        {currentJobs.length === 0 && (
          <div className="py-8 text-center">
            <div className="text-gray-500 mb-2">No closed jobs for this month</div>
            {availableMonths.length > 0 && (
              <div className="text-sm text-gray-400">
                Try selecting a month with data: {availableMonths.slice(0, 3).map(m => {
                  const [year, month] = m.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }).join(', ')}
                {availableMonths.length > 3 && '...'}
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {reportData && currentJobs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Revenue</div>
              <div className="text-2xl font-bold text-green-700">{formatCurrency(reportData.totalRevenue)}</div>
              {reportData.revenueVsPriorMonth !== null && (
                <div className={`text-xs ${reportData.revenueVsPriorMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {reportData.revenueVsPriorMonth >= 0 ? '+' : ''}{reportData.revenueVsPriorMonth.toFixed(1)}% vs prior
                </div>
              )}
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Total Jobs</div>
              <div className="text-2xl font-bold text-blue-700">{reportData.totalJobs}</div>
              {reportData.jobsVsPriorMonth !== null && (
                <div className={`text-xs ${reportData.jobsVsPriorMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {reportData.jobsVsPriorMonth >= 0 ? '+' : ''}{reportData.jobsVsPriorMonth.toFixed(1)}% vs prior
                </div>
              )}
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">Standard (&gt;$500)</div>
              <div className="text-2xl font-bold text-purple-700">{reportData.standardJobs}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 font-medium">Small ($1-500)</div>
              <div className="text-2xl font-bold text-gray-700">{reportData.smallJobs}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600 font-medium">Warranty Rate</div>
              <div className="text-2xl font-bold text-orange-700">{reportData.warrantyRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{reportData.warrantyJobs} jobs</div>
            </div>
            <div className="p-4 bg-cyan-50 rounded-lg">
              <div className="text-sm text-cyan-600 font-medium">Avg Cycle</div>
              <div className="text-2xl font-bold text-cyan-700">
                {reportData.avgCycleDays !== null ? `${reportData.avgCycleDays.toFixed(0)}d` : '-'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Observations - only show when there are jobs */}
      {currentJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Observations</h3>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
              {observations.length} insights
            </span>
          </div>

          <div className="space-y-3">
            {observations.map(obs => (
              <div
                key={obs.id}
                className={`border rounded-lg overflow-hidden ${
                  obs.priority === 'high' ? 'border-red-200 bg-red-50/50' :
                  obs.priority === 'medium' ? 'border-yellow-200 bg-yellow-50/50' :
                  'border-gray-200'
                }`}
              >
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleObservation(obs.id)}
                >
                  {getImpactIcon(obs.impact)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{obs.title}</span>
                      {obs.metric_value && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          obs.impact === 'positive' ? 'bg-green-100 text-green-700' :
                          obs.impact === 'negative' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {obs.metric_value}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                        {obs.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  {expandedObservations.has(obs.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {expandedObservations.has(obs.id) && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100">
                    <p className="text-gray-700 text-sm">{obs.observation}</p>
                    {obs.comparison_value && (
                      <p className="text-xs text-gray-500 mt-1">Target: {obs.comparison_value}</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {observations.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No significant observations for this month
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manager Comments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Manager Comments</h3>
        </div>

        {/* Existing comments */}
        <div className="space-y-3 mb-4">
          {comments.map(comment => (
            <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">{comment.author}</span>
                <span className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-700 text-sm">{comment.content}</p>
            </div>
          ))}

          {comments.length === 0 && (
            <p className="text-sm text-gray-500 italic">No comments yet</p>
          )}
        </div>

        {/* Add comment */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
