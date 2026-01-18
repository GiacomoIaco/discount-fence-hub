/**
 * Hook for fetching personal/single salesperson metrics
 * Simplified version for mobile analytics view
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

interface PersonalMetrics {
  totalRevenue: number;
  jobsCompleted: number;
  quotesSent: number;
  winRate: number;
  avgJobValue: number;
  totalQuotesValue: number;
  avgDaysToQuote: number;
  jobsThisMonth: number;
  revenueThisMonth: number;
  monthlyTrend: { month: string; revenue: number; jobs: number }[];
}

/**
 * Get personal metrics for a specific salesperson
 * If no salesperson provided, returns aggregated metrics
 */
export function usePersonalMetrics(salesperson?: string) {
  return useQuery({
    queryKey: ['personal-metrics', salesperson],
    queryFn: async (): Promise<PersonalMetrics> => {
      // Get current month boundaries
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Build base query for jobs
      let jobsQuery = supabase
        .from('jobber_builder_jobs')
        .select('total_revenue, effective_salesperson, created_at');

      if (salesperson) {
        jobsQuery = jobsQuery.eq('effective_salesperson', salesperson);
      }

      const { data: jobsData, error: jobsError } = await jobsQuery;

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError);
        throw jobsError;
      }

      const jobs = jobsData || [];

      // Calculate metrics
      const totalRevenue = jobs.reduce((sum, j) => sum + (Number(j.total_revenue) || 0), 0);
      const jobsCompleted = jobs.length;
      const avgJobValue = jobsCompleted > 0 ? totalRevenue / jobsCompleted : 0;

      // Jobs this month
      const monthJobs = jobs.filter(j =>
        j.created_at && new Date(j.created_at) >= startOfMonth
      );
      const jobsThisMonth = monthJobs.length;
      const revenueThisMonth = monthJobs.reduce((sum, j) => sum + (Number(j.total_revenue) || 0), 0);

      // Get quotes data
      let quotesQuery = supabase
        .from('jobber_quotes')
        .select('total_amount, status, effective_salesperson, created_at, days_to_quote');

      if (salesperson) {
        quotesQuery = quotesQuery.eq('effective_salesperson', salesperson);
      }

      const { data: quotesData } = await quotesQuery;
      const quotes = quotesData || [];

      const quotesSent = quotes.length;
      const totalQuotesValue = quotes.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);

      // Calculate win rate (quotes that became jobs)
      const approvedQuotes = quotes.filter(q =>
        q.status?.toLowerCase().includes('approved') ||
        q.status?.toLowerCase().includes('won')
      ).length;
      const winRate = quotesSent > 0 ? approvedQuotes / quotesSent : 0;

      // Calculate average days to quote
      const quotesWithDays = quotes.filter(q => q.days_to_quote != null && q.days_to_quote >= 0);
      const avgDaysToQuote = quotesWithDays.length > 0
        ? quotesWithDays.reduce((sum, q) => sum + (q.days_to_quote || 0), 0) / quotesWithDays.length
        : 0;

      // Calculate monthly trend (last 6 months)
      const monthlyMap = new Map<string, { revenue: number; jobs: number }>();

      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, { revenue: 0, jobs: 0 });
      }

      for (const job of jobs) {
        if (!job.created_at) continue;
        const d = new Date(job.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap.has(key)) {
          const existing = monthlyMap.get(key)!;
          existing.revenue += Number(job.total_revenue) || 0;
          existing.jobs += 1;
        }
      }

      const monthlyTrend = Array.from(monthlyMap.entries())
        .map(([month, data]) => {
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1);
          return {
            month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            revenue: data.revenue,
            jobs: data.jobs,
          };
        });

      return {
        totalRevenue,
        jobsCompleted,
        quotesSent,
        winRate,
        avgJobValue,
        totalQuotesValue,
        avgDaysToQuote,
        jobsThisMonth,
        revenueThisMonth,
        monthlyTrend,
      };
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

export default usePersonalMetrics;
