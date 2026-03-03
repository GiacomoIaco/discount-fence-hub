import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../../lib/supabase';

export type TimeWindow = '1d' | '3d' | '7d' | '30d';

interface CompletedTask {
  id: string;
  completed_at: string;
  completed_by: string | null;
  due_date: string | null;
  completer?: { full_name: string; avatar_url: string | null } | null;
}

export interface MemberStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  completed: number;
  onTimePercent: number;
}

export interface AnalyticsSummary {
  totalCompleted: number;
  avgPerDay: number;
  onTimePercent: number;
  currentlyOverdue: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

function windowDays(w: TimeWindow): number {
  switch (w) {
    case '1d': return 1;
    case '3d': return 3;
    case '7d': return 7;
    case '30d': return 30;
  }
}

export function useTodoAnalytics() {
  // Fetch all done items completed in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const { data: completedTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['todo-analytics-completed'],
    queryFn: async (): Promise<CompletedTask[]> => {
      const { data, error } = await supabase
        .from('todo_items')
        .select('id, completed_at, completed_by, due_date')
        .eq('status', 'done')
        .not('completed_at', 'is', null)
        .gte('completed_at', thirtyDaysAgo.toISOString());

      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch user profiles for completed_by users
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    (completedTasks || []).forEach(t => {
      if (t.completed_by) ids.add(t.completed_by);
    });
    return Array.from(ids);
  }, [completedTasks]);

  const { data: userProfiles } = useQuery({
    queryKey: ['todo-analytics-profiles', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      if (error) throw error;
      const map: Record<string, { full_name: string; avatar_url: string | null }> = {};
      (data || []).forEach(u => { map[u.id] = u; });
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 300_000,
  });

  // Fetch currently overdue count (not completed, past due)
  const { data: overdueCount } = useQuery({
    queryKey: ['todo-analytics-overdue'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('todo_items')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .lt('due_date', todayStr);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60_000,
  });

  // Build daily counts for the last 30 days
  const dailyCounts: DailyCount[] = useMemo(() => {
    const counts: DailyCount[] = [];
    const now = new Date();
    for (let d = 29; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(now.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const count = (completedTasks || []).filter(t =>
        t.completed_at && t.completed_at.split('T')[0] === dateStr
      ).length;
      counts.push({ date: dateStr, count });
    }
    return counts;
  }, [completedTasks]);

  function getStats(window: TimeWindow): { summary: AnalyticsSummary; members: MemberStats[] } {
    const days = windowDays(window);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    const filtered = (completedTasks || []).filter(t =>
      t.completed_at && new Date(t.completed_at) >= cutoff
    );

    const totalCompleted = filtered.length;
    const avgPerDay = days > 0 ? Math.round((totalCompleted / days) * 10) / 10 : 0;

    const withDueDate = filtered.filter(t => t.due_date);
    const onTime = withDueDate.filter(t => {
      if (!t.completed_at || !t.due_date) return false;
      return t.completed_at.split('T')[0] <= t.due_date;
    });
    const onTimePercent = withDueDate.length > 0
      ? Math.round((onTime.length / withDueDate.length) * 100)
      : 100;

    // Per-member aggregation
    const memberMap: Record<string, { completed: number; onTime: number; withDue: number }> = {};
    filtered.forEach(t => {
      const uid = t.completed_by || 'unknown';
      if (!memberMap[uid]) memberMap[uid] = { completed: 0, onTime: 0, withDue: 0 };
      memberMap[uid].completed++;
      if (t.due_date) {
        memberMap[uid].withDue++;
        if (t.completed_at && t.completed_at.split('T')[0] <= t.due_date) {
          memberMap[uid].onTime++;
        }
      }
    });

    const members: MemberStats[] = Object.entries(memberMap)
      .map(([userId, stats]) => {
        const profile = userProfiles?.[userId];
        return {
          userId,
          name: profile?.full_name || 'Unknown',
          avatarUrl: profile?.avatar_url || null,
          completed: stats.completed,
          onTimePercent: stats.withDue > 0
            ? Math.round((stats.onTime / stats.withDue) * 100)
            : 100,
        };
      })
      .sort((a, b) => b.completed - a.completed);

    return {
      summary: { totalCompleted, avgPerDay, onTimePercent, currentlyOverdue: overdueCount || 0 },
      members,
    };
  }

  return {
    getStats,
    dailyCounts,
    isLoading: tasksLoading,
  };
}
