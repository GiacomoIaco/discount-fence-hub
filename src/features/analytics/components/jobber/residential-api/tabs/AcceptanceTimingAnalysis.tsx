// Quote Acceptance Timing Analysis (API Version)
// Shows distribution of days from quote to acceptance for mature quotes

import { useMemo } from 'react';
import { Clock, BarChart3, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../../../lib/supabase';

// Fetch won opportunities from API table with days_to_decision
function useApiAcceptanceTimingData() {
  return useQuery({
    queryKey: ['api-residential-acceptance-timing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobber_api_opportunities')
        .select('days_to_decision, won_date, first_sent_date, won_value')
        .eq('is_won', true)
        .not('days_to_decision', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch acceptance timing data: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Bucket definitions for the histogram
const TIME_BUCKETS = [
  { label: 'Same day', min: 0, max: 0 },
  { label: '1-3 days', min: 1, max: 3 },
  { label: '4-7 days', min: 4, max: 7 },
  { label: '8-14 days', min: 8, max: 14 },
  { label: '15-30 days', min: 15, max: 30 },
  { label: '31-45 days', min: 31, max: 45 },
  { label: '46-60 days', min: 46, max: 60 },
  { label: '60+ days', min: 61, max: Infinity },
];

export function AcceptanceTimingAnalysis() {
  const { data: rawData, isLoading, error } = useApiAcceptanceTimingData();

  const analysis = useMemo(() => {
    if (!rawData || rawData.length === 0) return null;

    // Count opportunities in each bucket
    const bucketCounts = TIME_BUCKETS.map((bucket) => {
      const count = rawData.filter((d) => {
        const days = d.days_to_decision;
        return days >= bucket.min && days <= bucket.max;
      }).length;
      return { ...bucket, count };
    });

    // Calculate cumulative percentages
    const total = rawData.length;
    let cumulative = 0;
    const cumulativeData = bucketCounts.map((bucket) => {
      cumulative += bucket.count;
      return {
        ...bucket,
        cumPct: Math.round((cumulative / total) * 100),
        pct: Math.round((bucket.count / total) * 100),
      };
    });

    // Key statistics
    const sortedDays = rawData.map((d) => d.days_to_decision).sort((a, b) => a - b);
    const median = sortedDays[Math.floor(sortedDays.length / 2)];
    const p75 = sortedDays[Math.floor(sortedDays.length * 0.75)];
    const p90 = sortedDays[Math.floor(sortedDays.length * 0.9)];

    // Find the bucket where 85% of acceptances happen
    const threshold85 = cumulativeData.find((b) => b.cumPct >= 85);

    return {
      total,
      buckets: cumulativeData,
      median,
      p75,
      p90,
      threshold85Label: threshold85?.label || 'N/A',
      threshold85CumPct: threshold85?.cumPct || 0,
    };
  }, [rawData]);

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load acceptance timing data. Make sure the database table exists.
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
        No won opportunities found with decision timing data. Run Jobber API sync to see data.
      </div>
    );
  }

  const maxCount = Math.max(...analysis.buckets.map((b) => b.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
          <Clock className="w-5 h-5" />
          Quote Acceptance Timing Analysis
        </div>
        <p className="text-sm text-blue-700">
          Based on <strong>{analysis.total} won opportunities</strong> from API data.
          This shows how long it takes for clients to accept quotes after receiving them.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">Median Time</div>
          <div className="text-2xl font-bold text-gray-900">{analysis.median} days</div>
          <div className="text-xs text-gray-400">50% accept within this time</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">75th Percentile</div>
          <div className="text-2xl font-bold text-gray-900">{analysis.p75} days</div>
          <div className="text-xs text-gray-400">75% accept within this time</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase mb-1">90th Percentile</div>
          <div className="text-2xl font-bold text-amber-600">{analysis.p90} days</div>
          <div className="text-xs text-gray-400">90% accept within this time</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
          <div className="flex items-center gap-1 text-xs text-green-700 uppercase mb-1">
            <CheckCircle className="w-3 h-3" />
            Key Insight
          </div>
          <div className="text-lg font-bold text-green-800">
            {analysis.threshold85CumPct}% by {analysis.threshold85Label}
          </div>
          <div className="text-xs text-green-600">Most acceptances happen quickly</div>
        </div>
      </div>

      {/* Histogram */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Acceptance Time Distribution</h3>
        </div>

        <div className="space-y-2">
          {analysis.buckets.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-3">
              <div className="w-24 text-xs text-gray-600 text-right">{bucket.label}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="w-12 text-xs text-gray-600">{bucket.count}</div>
              <div className="w-12 text-xs text-gray-500">{bucket.pct}%</div>
              <div className="w-16 text-xs text-green-600 font-medium">
                {bucket.cumPct}% cum
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="text-sm text-amber-800">
          <strong>What this means:</strong>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>
              Win rates for quotes less than <strong>{analysis.p90} days old</strong> are not yet "mature" -
              they may still convert
            </li>
            <li>
              If comparing month-to-month, the most recent month's win rate will naturally appear lower
            </li>
            <li>
              For accurate comparisons, use "Last Quarter" to ensure quotes have had time to mature
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
