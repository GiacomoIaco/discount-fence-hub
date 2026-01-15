// Cycle Time Analysis Tab - Time through each stage
// Shows: Days in each stage, bottleneck identification

import { Timer, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useResidentialOpportunities } from '../../../../hooks/jobber/residential';
import type { ResidentialFilters, ResidentialOpportunity } from '../../../../types/residential';
import { formatResidentialPercent } from '../../../../types/residential';

interface CycleTimeAnalysisProps {
  filters: ResidentialFilters;
}

interface CycleMetrics {
  avgDaysToQuote: number | null;
  avgDaysToDecision: number | null;
  avgTotalCycle: number | null;
  countWithAssessment: number;
  countWithDecision: number;
  totalCount: number;
}

export function CycleTimeAnalysis({ filters }: CycleTimeAnalysisProps) {
  const { data: opportunities, isLoading } = useResidentialOpportunities({ filters });

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

  // Calculate cycle time metrics
  const metrics = calculateCycleMetrics(opportunities || []);

  // Get distribution of days to quote
  const speedDistribution = getSpeedDistribution(opportunities || []);

  return (
    <div className="space-y-6">
      {/* Cycle Time Summary */}
      <div className="grid grid-cols-3 gap-4">
        <CycleCard
          icon={<Clock className="w-5 h-5 text-blue-600" />}
          label="Avg Days to Quote"
          value={metrics.avgDaysToQuote !== null ? `${metrics.avgDaysToQuote.toFixed(1)} days` : '-'}
          subValue={`${metrics.countWithAssessment.toLocaleString()} opps with assessment date`}
          bgColor="bg-blue-50"
        />
        <CycleCard
          icon={<Timer className="w-5 h-5 text-purple-600" />}
          label="Avg Days to Decision"
          value={metrics.avgDaysToDecision !== null ? `${metrics.avgDaysToDecision.toFixed(1)} days` : '-'}
          subValue={`${metrics.countWithDecision.toLocaleString()} decided opps`}
          bgColor="bg-purple-50"
        />
        <CycleCard
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          label="Avg Total Cycle"
          value={metrics.avgTotalCycle !== null ? `${metrics.avgTotalCycle.toFixed(1)} days` : '-'}
          subValue="Assessment → Decision"
          bgColor="bg-green-50"
        />
      </div>

      {/* Speed Distribution */}
      {speedDistribution.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Days to Quote Distribution</h3>
          </div>

          <div className="space-y-3">
            {speedDistribution.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-gray-700">{bucket.label}</div>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 ${bucket.color}`}
                    style={{ width: `${bucket.percentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-sm">
                    <span className="font-medium text-gray-900">{bucket.count.toLocaleString()}</span>
                    <span className="ml-2 text-gray-600">({bucket.percentage.toFixed(1)}%)</span>
                    <span className="ml-auto text-gray-600">Win: {formatResidentialPercent(bucket.winRate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottleneck Alert */}
      {metrics.avgDaysToQuote !== null && metrics.avgDaysToQuote > 3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">Quoting Bottleneck Detected</div>
              <div className="text-sm text-amber-700 mt-1">
                Average time to quote is <span className="font-bold">{metrics.avgDaysToQuote.toFixed(1)} days</span>.
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
              count={metrics.countWithAssessment}
              total={metrics.totalCount}
              color="bg-blue-100 border-blue-300"
            />
            <Arrow />
            <StageBox
              label="Quote Sent"
              count={metrics.totalCount}
              total={metrics.totalCount}
              color="bg-purple-100 border-purple-300"
            />
            <Arrow />
            <StageBox
              label="Decision Made"
              count={metrics.countWithDecision}
              total={metrics.totalCount}
              color="bg-green-100 border-green-300"
            />
          </div>

          {/* Time between stages */}
          <div className="flex justify-around mt-4 text-sm text-gray-600">
            <div className="text-center">
              <div className="font-medium">{metrics.avgDaysToQuote?.toFixed(1) || '-'} days</div>
              <div className="text-xs text-gray-500">Assessment → Quote</div>
            </div>
            <div className="text-center">
              <div className="font-medium">
                {metrics.avgDaysToDecision !== null && metrics.avgDaysToQuote !== null
                  ? (metrics.avgDaysToDecision).toFixed(1)
                  : '-'}{' '}
                days
              </div>
              <div className="text-xs text-gray-500">Quote → Decision</div>
            </div>
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
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className={`flex-1 p-4 rounded-lg border-2 ${color} text-center`}>
      <div className="font-semibold text-gray-900">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{count.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{percentage.toFixed(0)}% of total</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-gray-400 text-2xl">→</div>
  );
}

// Calculation Helpers

function calculateCycleMetrics(opportunities: ResidentialOpportunity[]): CycleMetrics {
  let totalDaysToQuote = 0;
  let countWithAssessment = 0;
  let totalDaysToDecision = 0;
  let countWithDecision = 0;

  for (const opp of opportunities) {
    // Days to quote (from assessment)
    if (opp.days_to_quote !== null && opp.days_to_quote >= 0) {
      totalDaysToQuote += opp.days_to_quote;
      countWithAssessment++;
    }

    // Days to decision (use precomputed field from DB)
    if ((opp.is_won || opp.is_lost) && opp.days_to_decision !== null && opp.days_to_decision >= 0) {
      totalDaysToDecision += opp.days_to_decision;
      countWithDecision++;
    }
  }

  const avgDaysToQuote = countWithAssessment > 0 ? totalDaysToQuote / countWithAssessment : null;
  const avgDaysToDecision =
    countWithDecision > 0 ? totalDaysToDecision / countWithDecision : null;
  const avgTotalCycle =
    avgDaysToQuote !== null && avgDaysToDecision !== null
      ? avgDaysToQuote + avgDaysToDecision
      : null;

  return {
    avgDaysToQuote,
    avgDaysToDecision,
    avgTotalCycle,
    countWithAssessment,
    countWithDecision,
    totalCount: opportunities.length,
  };
}

interface SpeedBucket {
  label: string;
  count: number;
  percentage: number;
  winRate: number | null;
  color: string;
}

function getSpeedDistribution(opportunities: ResidentialOpportunity[]): SpeedBucket[] {
  const buckets: Record<string, { count: number; won: number }> = {
    'Same day': { count: 0, won: 0 },
    '1-2 days': { count: 0, won: 0 },
    '3-4 days': { count: 0, won: 0 },
    '5-7 days': { count: 0, won: 0 },
    '8+ days': { count: 0, won: 0 },
  };

  let totalWithSpeed = 0;

  for (const opp of opportunities) {
    const bucket = opp.speed_to_quote_bucket;
    if (bucket && buckets[bucket]) {
      buckets[bucket].count++;
      if (opp.is_won) buckets[bucket].won++;
      totalWithSpeed++;
    }
  }

  if (totalWithSpeed === 0) return [];

  const colors: Record<string, string> = {
    'Same day': 'bg-green-400',
    '1-2 days': 'bg-blue-400',
    '3-4 days': 'bg-amber-400',
    '5-7 days': 'bg-orange-400',
    '8+ days': 'bg-red-400',
  };

  return Object.entries(buckets).map(([label, data]) => ({
    label,
    count: data.count,
    percentage: (data.count / totalWithSpeed) * 100,
    winRate: data.count > 0 ? (data.won / data.count) * 100 : null,
    color: colors[label] || 'bg-gray-400',
  }));
}
