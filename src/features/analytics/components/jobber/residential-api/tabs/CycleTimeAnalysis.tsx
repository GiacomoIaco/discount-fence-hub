// Cycle Time Analysis Tab - Time through each stage (API Version)
// Shows: Days in each stage, bottleneck identification

import { Timer, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useApiResidentialCycleBreakdown, useApiResidentialFunnelMetrics } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters } from '../../../../types/residential';

interface CycleTimeAnalysisProps {
  filters: ResidentialFilters;
}

export function CycleTimeAnalysis({ filters }: CycleTimeAnalysisProps) {
  const { data: cycleData, isLoading: cycleLoading } = useApiResidentialCycleBreakdown(filters);
  const { data: funnelData, isLoading: funnelLoading } = useApiResidentialFunnelMetrics(filters);

  const isLoading = cycleLoading || funnelLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (!funnelData && !cycleData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
        No cycle time data available. Run Jobber API sync to see metrics.
      </div>
    );
  }

  // Extract metrics from funnel data or cycle breakdown
  const avgDaysToQuote = funnelData?.avg_days_to_quote ?? null;
  const avgDaysToDecision = funnelData?.avg_days_to_decision ?? null;
  const avgDaysToSchedule = funnelData?.avg_days_to_schedule ?? null;
  const avgDaysToClose = funnelData?.avg_days_to_close ?? null;
  const totalCycle = funnelData?.total_cycle_days ?? null;

  // Get percentile data from cycle breakdown
  const quoteStage = cycleData?.find(c => c.stage === 'quote');
  const decisionStage = cycleData?.find(c => c.stage === 'decision');

  return (
    <div className="space-y-6">
      {/* Cycle Time Summary */}
      <div className="grid grid-cols-3 gap-4">
        <CycleCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Avg Days to Quote"
          value={avgDaysToQuote !== null ? `${avgDaysToQuote.toFixed(1)} days` : '-'}
          subValue={quoteStage ? `p75: ${quoteStage.p75_days?.toFixed(1) || '-'} days` : 'assessment → sent'}
          bgColor="bg-blue-50"
        />
        <CycleCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="Avg Days to Decision"
          value={avgDaysToDecision !== null ? `${avgDaysToDecision.toFixed(1)} days` : '-'}
          subValue={decisionStage ? `p75: ${decisionStage.p75_days?.toFixed(1) || '-'} days` : 'sent → converted'}
          bgColor="bg-purple-50"
        />
        <CycleCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Avg Total Cycle"
          value={totalCycle !== null ? `${totalCycle.toFixed(1)} days` : '-'}
          subValue="Assessment → Closed"
          bgColor="bg-green-50"
        />
      </div>

      {/* Additional Cycle Stages */}
      <div className="grid grid-cols-2 gap-4">
        <CycleCard
          icon={<Clock className="w-5 h-5 text-cyan-600" />}
          label="Avg Days to Schedule"
          value={avgDaysToSchedule !== null ? `${avgDaysToSchedule.toFixed(1)} days` : '-'}
          subValue="converted → scheduled"
          bgColor="bg-cyan-50"
        />
        <CycleCard
          icon={<Timer className="w-5 h-5 text-orange-600" />}
          label="Avg Days to Close"
          value={avgDaysToClose !== null ? `${avgDaysToClose.toFixed(1)} days` : '-'}
          subValue="scheduled → closed"
          bgColor="bg-orange-50"
        />
      </div>

      {/* Cycle Breakdown Table */}
      {cycleData && cycleData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cycle Time Breakdown</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Stage</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Sample Size</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Average</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Median</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">P25</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">P75</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Min</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cycleData
                  .sort((a, b) => a.stage_order - b.stage_order)
                  .map((stage) => (
                    <tr key={stage.stage} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900 capitalize">{stage.stage.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{stage.sample_size?.toLocaleString() ?? '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-blue-600">{stage.avg_days?.toFixed(1) ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{stage.median_days?.toFixed(1) ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{stage.p25_days?.toFixed(1) ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-500">{stage.p75_days?.toFixed(1) ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-400">{stage.min_days?.toFixed(0) ?? '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-400">{stage.max_days?.toFixed(0) ?? '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottleneck Alert */}
      {avgDaysToQuote !== null && avgDaysToQuote > 3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">Quoting Bottleneck Detected</div>
              <div className="text-sm text-amber-700 mt-1">
                Average time to quote is <span className="font-bold">{avgDaysToQuote.toFixed(1)} days</span>.
                {' '}Target same-day or next-day quotes to improve win rates by up to 15%.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Stage Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Stages</h3>

        <div className="relative">
          {/* Stage Flow Visualization */}
          <div className="flex items-center justify-between gap-2">
            <StageBox
              label="Assessment"
              avgDays={avgDaysToQuote}
              color="bg-blue-100 border-blue-300"
            />
            <Arrow />
            <StageBox
              label="Quote Sent"
              avgDays={avgDaysToDecision}
              color="bg-purple-100 border-purple-300"
            />
            <Arrow />
            <StageBox
              label="Converted"
              avgDays={avgDaysToSchedule}
              color="bg-cyan-100 border-cyan-300"
            />
            <Arrow />
            <StageBox
              label="Scheduled"
              avgDays={avgDaysToClose}
              color="bg-orange-100 border-orange-300"
            />
            <Arrow />
            <StageBox
              label="Closed"
              avgDays={null}
              color="bg-green-100 border-green-300"
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Cycle Time Best Practices</h4>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Target same-day quotes when possible - highest win rate</li>
          <li>Follow up on pending quotes after 3 days</li>
          <li>Identify quotes stuck longer than 30 days for cleanup</li>
          <li>Track reasons for slow quoting to identify process improvements</li>
        </ul>
      </div>
    </div>
  );
}

// Helper Components

function CycleCard({
  icon,
  label,
  value,
  subValue,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subValue}</div>
    </div>
  );
}

function StageBox({
  label,
  avgDays,
  color,
}: {
  label: string;
  avgDays: number | null;
  color: string;
}) {
  return (
    <div className={`flex-1 p-4 rounded-lg border-2 ${color} text-center`}>
      <div className="font-semibold text-gray-900">{label}</div>
      {avgDays !== null && (
        <div className="text-sm text-gray-600 mt-1">{avgDays.toFixed(1)} days</div>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-gray-400 text-2xl">→</div>
  );
}
