import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
  Target,
  Wrench,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { useFsmAnalytics } from '../hooks/useFsmAnalytics';

// ============================================
// HELPER COMPONENTS
// ============================================

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

function StatCard({ title, value, subtitle, icon, trend, trendValue, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold">{value}</span>
        {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FsmAnalyticsTab() {
  const {
    marketingFunnel,
    quoteTimeliness,
    changeOrdersByRep,
    warrantyByCrew,
    reworkByCrew,
    penalizationSummary,
    isLoading,
    error,
  } = useFsmAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalLeads = marketingFunnel.reduce((sum, r) => sum + r.total_leads, 0);
  const totalWon = marketingFunnel.reduce((sum, r) => sum + r.won, 0);
  const overallWinRate = totalLeads > 0 ? (totalWon / totalLeads) * 100 : 0;

  const avgSameDayPct = quoteTimeliness.length > 0
    ? quoteTimeliness.reduce((sum, r) => sum + (r.same_day_pct || 0), 0) / quoteTimeliness.length
    : 0;

  const avgChangeOrderRate = changeOrdersByRep.length > 0
    ? changeOrdersByRep.reduce((sum, r) => sum + (r.change_order_rate_pct || 0), 0) / changeOrdersByRep.length
    : 0;

  const avgWarrantyRate = warrantyByCrew.length > 0
    ? warrantyByCrew.reduce((sum, r) => sum + (r.warranty_pct || 0), 0) / warrantyByCrew.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Overall Win Rate"
          value={formatPercent(overallWinRate)}
          subtitle={`${totalWon} won / ${totalLeads} leads`}
          icon={<Target className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Same-Day Quote %"
          value={formatPercent(avgSameDayPct)}
          subtitle="Avg across all reps"
          icon={<Clock className="w-5 h-5" />}
          color={avgSameDayPct >= 80 ? 'green' : avgSameDayPct >= 50 ? 'orange' : 'red'}
        />
        <StatCard
          title="Change Order Rate"
          value={formatPercent(avgChangeOrderRate)}
          subtitle="Avg by rep (lower is better)"
          icon={<AlertTriangle className="w-5 h-5" />}
          color={avgChangeOrderRate <= 10 ? 'green' : avgChangeOrderRate <= 20 ? 'orange' : 'red'}
        />
        <StatCard
          title="Warranty Rate"
          value={formatPercent(avgWarrantyRate)}
          subtitle="Avg callbacks per crew"
          icon={<Shield className="w-5 h-5" />}
          color={avgWarrantyRate <= 2 ? 'green' : avgWarrantyRate <= 5 ? 'orange' : 'red'}
        />
      </div>

      {/* Marketing Funnel */}
      <CollapsibleSection
        title="Marketing Funnel by Source"
        icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
      >
        {marketingFunnel.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet. Leads will appear here once service requests are created.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Source</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Leads</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Projects</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Won</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Lead→Project</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Project→Won</th>
                </tr>
              </thead>
              <tbody>
                {marketingFunnel.map((row) => (
                  <tr key={row.source} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.source || 'Unknown'}</td>
                    <td className="text-right py-2 px-3">{row.total_leads}</td>
                    <td className="text-right py-2 px-3">{row.converted_to_project}</td>
                    <td className="text-right py-2 px-3 text-green-600 font-medium">{row.won}</td>
                    <td className="text-right py-2 px-3">{formatPercent(row.lead_to_project_pct)}</td>
                    <td className="text-right py-2 px-3">{formatPercent(row.project_to_won_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Rep Performance - Quote Timeliness */}
      <CollapsibleSection
        title="Rep Performance: Quote Timeliness"
        icon={<Users className="w-5 h-5 text-purple-600" />}
      >
        {quoteTimeliness.length === 0 ? (
          <p className="text-gray-500 text-sm">No assessment data yet. This will show quote turnaround times once assessments are completed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Rep</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Assessments</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Avg Time</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Same-Day %</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">&gt;48hrs %</th>
                </tr>
              </thead>
              <tbody>
                {quoteTimeliness.map((row) => (
                  <tr key={row.rep_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.rep_name}</td>
                    <td className="text-right py-2 px-3">{row.total_assessments}</td>
                    <td className="text-right py-2 px-3">{formatHours(row.avg_hours_to_quote)}</td>
                    <td className={`text-right py-2 px-3 font-medium ${
                      (row.same_day_pct || 0) >= 80 ? 'text-green-600' :
                      (row.same_day_pct || 0) >= 50 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formatPercent(row.same_day_pct)}
                    </td>
                    <td className={`text-right py-2 px-3 ${
                      (row.over_48hrs_pct || 0) <= 5 ? 'text-green-600' :
                      (row.over_48hrs_pct || 0) <= 15 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formatPercent(row.over_48hrs_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Rep Performance - Change Orders */}
      <CollapsibleSection
        title="Rep Performance: Change Order Analysis"
        icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
      >
        <p className="text-xs text-gray-500 mb-3">
          High change order rates may indicate underquoting to win deals or missing items during assessment.
        </p>
        {changeOrdersByRep.length === 0 ? (
          <p className="text-gray-500 text-sm">No quote data in the last 90 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Rep</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Projects</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Original $</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">COs</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">CO $</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">CO Rate</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">CO Value %</th>
                </tr>
              </thead>
              <tbody>
                {changeOrdersByRep.map((row) => (
                  <tr key={row.rep_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.rep_name}</td>
                    <td className="text-right py-2 px-3">{row.total_projects}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(row.original_value)}</td>
                    <td className="text-right py-2 px-3">{row.change_orders}</td>
                    <td className="text-right py-2 px-3">{formatCurrency(row.change_order_value)}</td>
                    <td className={`text-right py-2 px-3 font-medium ${
                      (row.change_order_rate_pct || 0) <= 10 ? 'text-green-600' :
                      (row.change_order_rate_pct || 0) <= 20 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formatPercent(row.change_order_rate_pct)}
                    </td>
                    <td className={`text-right py-2 px-3 ${
                      (row.change_order_value_pct || 0) <= 5 ? 'text-green-600' :
                      (row.change_order_value_pct || 0) <= 10 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formatPercent(row.change_order_value_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Crew Performance - Warranty */}
      <CollapsibleSection
        title="Crew Performance: Warranty Callbacks"
        icon={<Shield className="w-5 h-5 text-blue-600" />}
        defaultOpen={false}
      >
        {warrantyByCrew.length === 0 ? (
          <p className="text-gray-500 text-sm">No completed jobs with warranty data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Crew</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Jobs Done</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Callbacks</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Callback %</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Warranty Cost</th>
                </tr>
              </thead>
              <tbody>
                {warrantyByCrew.map((row) => (
                  <tr key={row.crew_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.crew_name}</td>
                    <td className="text-right py-2 px-3">{row.total_jobs_completed}</td>
                    <td className="text-right py-2 px-3">{row.warranty_callbacks}</td>
                    <td className={`text-right py-2 px-3 font-medium ${
                      (row.warranty_pct || 0) <= 2 ? 'text-green-600' :
                      (row.warranty_pct || 0) <= 5 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formatPercent(row.warranty_pct)}
                    </td>
                    <td className="text-right py-2 px-3 text-red-600">{formatCurrency(row.warranty_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Crew Performance - Rework */}
      <CollapsibleSection
        title="Crew Performance: Rework Issues"
        icon={<Wrench className="w-5 h-5 text-red-600" />}
        defaultOpen={false}
      >
        {reworkByCrew.length === 0 ? (
          <p className="text-gray-500 text-sm">No rework issues recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Crew</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Rework Issues</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {reworkByCrew.map((row) => (
                  <tr key={row.crew_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{row.crew_name}</td>
                    <td className="text-right py-2 px-3">{row.rework_issues}</td>
                    <td className="text-right py-2 px-3 text-red-600 font-medium">{formatCurrency(row.total_rework_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* Penalization Summary */}
      <CollapsibleSection
        title="Penalization Summary"
        icon={<DollarSign className="w-5 h-5 text-red-600" />}
        defaultOpen={false}
      >
        {penalizationSummary.length === 0 ? (
          <p className="text-gray-500 text-sm">No penalizations recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Target</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Issues</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Amount</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Month</th>
                </tr>
              </thead>
              <tbody>
                {penalizationSummary.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        row.penalization_type === 'backcharge_crew' ? 'bg-red-100 text-red-700' :
                        row.penalization_type === 'commission_reduction' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {row.penalization_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3">{row.crew_name || row.rep_name || '-'}</td>
                    <td className="text-right py-2 px-3">{row.issue_count}</td>
                    <td className="text-right py-2 px-3 text-red-600 font-medium">
                      {row.total_amount > 0 ? formatCurrency(row.total_amount) :
                       row.avg_percent_reduction ? `${row.avg_percent_reduction.toFixed(1)}%` : '-'}
                    </td>
                    <td className="text-right py-2 px-3 text-gray-500">
                      {row.month ? new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
