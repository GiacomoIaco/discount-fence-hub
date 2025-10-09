import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AnalyticsData {
  overview: {
    totalRequests: number;
    completedRequests: number;
    averageResponseTime: number; // in hours
    slaComplianceRate: number; // percentage
  };
  pricingAnalytics: {
    winRate: number; // percentage
    totalPricingRequests: number;
    wonRequests: number;
    lostRequests: number;
    averageQuoteValue: number;
    totalQuoteValue: number;
    totalValueWon: number; // total $ value of won requests
  };
  requestsByType: {
    type: string;
    count: number;
    percentage: number;
  }[];
  requestsByStage: {
    stage: string;
    count: number;
  }[];
  teamPerformance: {
    userId: string;
    userName: string;
    totalRequests: number;
    completedRequests: number;
    averageCompletionTime: number; // in hours
    slaCompliance: number; // percentage
  }[];
  // Enhanced request metrics by type
  requestMetricsByType: {
    type: string;
    created: number;
    closed: number;
    averageCloseTime: number; // in hours
    percentOver24h: number;
    percentOver48h: number;
  }[];
  // Request metrics by assignee
  requestMetricsByAssignee: {
    userId: string;
    userName: string;
    created: number;
    closed: number;
    averageCloseTime: number;
    percentOver24h: number;
    percentOver48h: number;
  }[];
  // Time-series data (last 12 weeks)
  timeSeries: {
    weekLabel: string;
    weekStart: string;
    requestsCreated: number;
    averageCloseTime: number;
    percentOver24h: number;
    requestsByType: { type: string; count: number }[];
  }[];
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get all requests
      const { data: requests, error: reqError } = await supabase
        .from('requests')
        .select('*');

      if (reqError) throw reqError;

      // Get user profiles for team performance
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name');

      if (profileError) throw profileError;

      // Calculate overview stats
      const totalRequests = requests?.length || 0;
      const completedRequests = requests?.filter(r => r.stage === 'completed').length || 0;

      const completedWithTimes = requests?.filter(r => r.stage === 'completed' && r.submitted_at && r.completed_at) || [];
      const avgResponseTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((acc, r) => {
            const start = new Date(r.submitted_at).getTime();
            const end = new Date(r.completed_at).getTime();
            return acc + (end - start) / (1000 * 60 * 60); // convert to hours
          }, 0) / completedWithTimes.length
        : 0;

      const completedOrArchived = requests?.filter(r => ['completed', 'archived'].includes(r.stage)) || [];
      const onTrackCount = completedOrArchived.filter(r => r.sla_status === 'on_track').length;
      const slaComplianceRate = completedOrArchived.length > 0
        ? (onTrackCount / completedOrArchived.length) * 100
        : 0;

      // Calculate pricing analytics
      const pricingRequests = requests?.filter(r => r.request_type === 'pricing') || [];
      const pricingWithStatus = pricingRequests.filter(r => r.quote_status && ['won', 'lost'].includes(r.quote_status));
      const wonRequests = pricingRequests.filter(r => r.quote_status === 'won');
      const lostRequests = pricingRequests.filter(r => r.quote_status === 'lost');

      const winRate = pricingWithStatus.length > 0
        ? (wonRequests.length / pricingWithStatus.length) * 100
        : 0;

      const quotedRequests = pricingRequests.filter(r => r.quoted_price);
      const avgQuoteValue = quotedRequests.length > 0
        ? quotedRequests.reduce((acc, r) => acc + (r.quoted_price || 0), 0) / quotedRequests.length
        : 0;

      const totalQuoteValue = wonRequests.reduce((acc, r) => acc + (r.quoted_price || 0), 0);
      const totalValueWon = totalQuoteValue; // Same as totalQuoteValue for clarity

      // Calculate requests by type
      const typeMap = new Map<string, number>();
      requests?.forEach(r => {
        typeMap.set(r.request_type, (typeMap.get(r.request_type) || 0) + 1);
      });

      // Calculate team performance map (needed for requestMetricsByAssignee)
      const userMap = new Map<string, any[]>();
      requests?.forEach(r => {
        if (r.assigned_to) {
          if (!userMap.has(r.assigned_to)) {
            userMap.set(r.assigned_to, []);
          }
          userMap.get(r.assigned_to)?.push(r);
        }
      });

      // Helper function to calculate close time in hours
      const getCloseTime = (request: any) => {
        if (!request.submitted_at || !request.completed_at) return null;
        const start = new Date(request.submitted_at).getTime();
        const end = new Date(request.completed_at).getTime();
        return (end - start) / (1000 * 60 * 60);
      };

      // Calculate enhanced request metrics by type
      const requestMetricsByType = Array.from(typeMap.entries()).map(([type, count]) => {
        const typeRequests = requests?.filter(r => r.request_type === type) || [];
        const closedRequests = typeRequests.filter(r => r.stage === 'completed');

        const closeTimes = closedRequests
          .map(getCloseTime)
          .filter((t): t is number => t !== null);

        const avgCloseTime = closeTimes.length > 0
          ? closeTimes.reduce((acc, t) => acc + t, 0) / closeTimes.length
          : 0;

        const over24h = closeTimes.filter(t => t > 24).length;
        const over48h = closeTimes.filter(t => t > 48).length;

        return {
          type,
          created: count,
          closed: closedRequests.length,
          averageCloseTime: avgCloseTime,
          percentOver24h: closeTimes.length > 0 ? (over24h / closeTimes.length) * 100 : 0,
          percentOver48h: closeTimes.length > 0 ? (over48h / closeTimes.length) * 100 : 0
        };
      });

      // Calculate request metrics by assignee
      const requestMetricsByAssignee = Array.from(userMap.entries()).map(([userId, userRequests]) => {
        const profile = profiles?.find(p => p.id === userId);
        const closedRequests = userRequests.filter(r => r.stage === 'completed');

        const closeTimes = closedRequests
          .map(getCloseTime)
          .filter((t): t is number => t !== null);

        const avgCloseTime = closeTimes.length > 0
          ? closeTimes.reduce((acc, t) => acc + t, 0) / closeTimes.length
          : 0;

        const over24h = closeTimes.filter(t => t > 24).length;
        const over48h = closeTimes.filter(t => t > 48).length;

        return {
          userId,
          userName: profile?.full_name || 'Unknown User',
          created: userRequests.length,
          closed: closedRequests.length,
          averageCloseTime: avgCloseTime,
          percentOver24h: closeTimes.length > 0 ? (over24h / closeTimes.length) * 100 : 0,
          percentOver48h: closeTimes.length > 0 ? (over48h / closeTimes.length) * 100 : 0
        };
      });

      // Calculate time-series data (last 12 weeks)
      const now = new Date();
      const timeSeries = [];

      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekRequests = requests?.filter(r => {
          const createdAt = new Date(r.submitted_at);
          return createdAt >= weekStart && createdAt < weekEnd;
        }) || [];

        const weekClosed = weekRequests.filter(r =>
          r.stage === 'completed' && r.completed_at
        );

        const weekCloseTimes = weekClosed
          .map(getCloseTime)
          .filter((t): t is number => t !== null);

        const avgCloseTime = weekCloseTimes.length > 0
          ? weekCloseTimes.reduce((acc, t) => acc + t, 0) / weekCloseTimes.length
          : 0;

        const over24h = weekCloseTimes.filter(t => t > 24).length;
        const percentOver24h = weekCloseTimes.length > 0
          ? (over24h / weekCloseTimes.length) * 100
          : 0;

        // Group by type for this week
        const typeCountMap = new Map<string, number>();
        weekRequests.forEach(r => {
          typeCountMap.set(r.request_type, (typeCountMap.get(r.request_type) || 0) + 1);
        });
        const requestsByType = Array.from(typeCountMap.entries()).map(([type, count]) => ({
          type,
          count
        }));

        timeSeries.push({
          weekLabel: `Week of ${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          weekStart: weekStart.toISOString(),
          requestsCreated: weekRequests.length,
          averageCloseTime: avgCloseTime,
          percentOver24h,
          requestsByType
        });
      }

      const requestsByType = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0
      }));

      // Calculate requests by stage
      const stageMap = new Map<string, number>();
      requests?.forEach(r => {
        stageMap.set(r.stage, (stageMap.get(r.stage) || 0) + 1);
      });
      const requestsByStage = Array.from(stageMap.entries()).map(([stage, count]) => ({
        stage,
        count
      }));

      // Calculate team performance
      const teamPerformance = Array.from(userMap.entries()).map(([userId, userRequests]) => {
        const profile = profiles?.find(p => p.id === userId);
        const completed = userRequests.filter(r => r.stage === 'completed');

        const completedWithTimes = completed.filter(r => r.submitted_at && r.completed_at);
        const avgTime = completedWithTimes.length > 0
          ? completedWithTimes.reduce((acc, r) => {
              const start = new Date(r.submitted_at).getTime();
              const end = new Date(r.completed_at).getTime();
              return acc + (end - start) / (1000 * 60 * 60);
            }, 0) / completedWithTimes.length
          : 0;

        const userCompletedOrArchived = userRequests.filter(r => ['completed', 'archived'].includes(r.stage));
        const userOnTrack = userCompletedOrArchived.filter(r => r.sla_status === 'on_track').length;
        const userSLA = userCompletedOrArchived.length > 0
          ? (userOnTrack / userCompletedOrArchived.length) * 100
          : 0;

        return {
          userId,
          userName: profile?.full_name || 'Unknown User',
          totalRequests: userRequests.length,
          completedRequests: completed.length,
          averageCompletionTime: avgTime,
          slaCompliance: userSLA
        };
      });

      setData({
        overview: {
          totalRequests,
          completedRequests,
          averageResponseTime: avgResponseTime,
          slaComplianceRate
        },
        pricingAnalytics: {
          winRate,
          totalPricingRequests: pricingRequests.length,
          wonRequests: wonRequests.length,
          lostRequests: lostRequests.length,
          averageQuoteValue: avgQuoteValue,
          totalQuoteValue,
          totalValueWon
        },
        requestsByType,
        requestsByStage,
        teamPerformance,
        requestMetricsByType,
        requestMetricsByAssignee,
        timeSeries
      });

      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return {
    data,
    loading,
    error,
    refresh: loadAnalytics
  };
}
