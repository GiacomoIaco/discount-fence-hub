import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  WeeklyInitiativeMetrics,
  CreateWeeklyMetricsInput,
  UpdateWeeklyMetricsInput,
} from '../lib/leadership';

// ============================================
// QUERY KEYS
// ============================================

export const weeklyMetricsKeys = {
  all: ['weekly-metrics'] as const,
  byInitiative: (initiativeId: string) => [...weeklyMetricsKeys.all, 'initiative', initiativeId] as const,
  byWeek: (weekEnding: string) => [...weeklyMetricsKeys.all, 'week', weekEnding] as const,
  byYear: (year: number) => [...weeklyMetricsKeys.all, 'year', year] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch weekly metrics for a specific initiative
 */
export function useWeeklyMetricsQuery(initiativeId: string | undefined) {
  return useQuery({
    queryKey: weeklyMetricsKeys.byInitiative(initiativeId || ''),
    queryFn: async () => {
      if (!initiativeId) return [];

      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .select('*')
        .eq('initiative_id', initiativeId)
        .order('week_ending', { ascending: false });

      if (error) throw error;
      return (data || []) as WeeklyInitiativeMetrics[];
    },
    enabled: !!initiativeId,
  });
}

/**
 * Fetch metrics for a specific week across all initiatives
 */
export function useWeekMetricsQuery(weekEnding: string | undefined) {
  return useQuery({
    queryKey: weeklyMetricsKeys.byWeek(weekEnding || ''),
    queryFn: async () => {
      if (!weekEnding) return [];

      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .select(`
          *,
          initiative:project_initiatives(
            id,
            title,
            area:project_areas(
              id,
              name,
              function:project_functions(
                id,
                name
              )
            )
          )
        `)
        .eq('week_ending', weekEnding)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!weekEnding,
  });
}

/**
 * Calculate YTD total for a specific metric
 */
export function useYTDTotalQuery(
  initiativeId: string | undefined,
  metricField: 'revenue_booked' | 'costs_impact' | 'customer_satisfaction',
  year: number
) {
  return useQuery({
    queryKey: [...weeklyMetricsKeys.byInitiative(initiativeId || ''), 'ytd', metricField, year],
    queryFn: async () => {
      if (!initiativeId) return 0;

      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .select(metricField)
        .eq('initiative_id', initiativeId)
        .eq('year', year);

      if (error) throw error;

      // Calculate total
      const total = (data || []).reduce((sum: number, row: any) => {
        const value = row[metricField];
        return sum + (value ? Number(value) : 0);
      }, 0);

      return total;
    },
    enabled: !!initiativeId,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create new weekly metrics
 */
export function useCreateWeeklyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWeeklyMetricsInput) => {
      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .insert({
          initiative_id: input.initiative_id,
          week_ending: input.week_ending,
          year: input.year,
          week_number: input.week_number,
          revenue_booked: input.revenue_booked,
          costs_impact: input.costs_impact,
          customer_satisfaction: input.customer_satisfaction,
          other_metrics: input.other_metrics || {},
          accomplishments: input.accomplishments,
          blockers: input.blockers,
        })
        .select()
        .single();

      if (error) throw error;
      return data as WeeklyInitiativeMetrics;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byInitiative(data.initiative_id) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byWeek(data.week_ending) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byYear(data.year) });
    },
  });
}

/**
 * Update existing weekly metrics
 */
export function useUpdateWeeklyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateWeeklyMetricsInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as WeeklyInitiativeMetrics;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byInitiative(data.initiative_id) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byWeek(data.week_ending) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byYear(data.year) });
    },
  });
}

/**
 * Upsert weekly metrics (create or update)
 */
export function useUpsertWeeklyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWeeklyMetricsInput) => {
      const { data, error } = await supabase
        .from('weekly_initiative_metrics')
        .upsert(
          {
            initiative_id: input.initiative_id,
            week_ending: input.week_ending,
            year: input.year,
            week_number: input.week_number,
            revenue_booked: input.revenue_booked,
            costs_impact: input.costs_impact,
            customer_satisfaction: input.customer_satisfaction,
            other_metrics: input.other_metrics || {},
            accomplishments: input.accomplishments,
            blockers: input.blockers,
          },
          {
            onConflict: 'initiative_id,week_ending',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data as WeeklyInitiativeMetrics;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byInitiative(data.initiative_id) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byWeek(data.week_ending) });
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.byYear(data.year) });
    },
  });
}

/**
 * Delete weekly metrics
 */
export function useDeleteWeeklyMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('weekly_initiative_metrics')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all weekly metrics queries
      queryClient.invalidateQueries({ queryKey: weeklyMetricsKeys.all });
    },
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekEnding(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  // Set to Sunday (end of week)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return sunday.toISOString().split('T')[0];
}

/**
 * Get ISO week number
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Format week ending date for display
 */
export function formatWeekEnding(weekEnding: string): string {
  const date = new Date(weekEnding);
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - 6);

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = startDate.toLocaleDateString('en-US', options);
  const end = date.toLocaleDateString('en-US', options);
  const year = date.getFullYear();

  return `Week of ${start} - ${end}, ${year}`;
}
