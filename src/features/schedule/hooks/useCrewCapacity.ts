import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { CrewDailyCapacity } from '../types/schedule.types';
import { format } from 'date-fns';
import { scheduleKeys } from './useScheduleEntries';

// ============================================
// FETCH CREW CAPACITY FOR DATE RANGE
// ============================================

export function useCrewCapacity(startDate: Date, endDate: Date, crewIds?: string[]) {
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: [...scheduleKeys.capacityByRange(startDateStr, endDateStr), crewIds],
    queryFn: async (): Promise<CrewDailyCapacity[]> => {
      let query = supabase
        .from('crew_daily_capacity')
        .select(`
          *,
          crew:crews(id, name, code)
        `)
        .gte('capacity_date', startDateStr)
        .lte('capacity_date', endDateStr)
        .order('capacity_date', { ascending: true });

      if (crewIds && crewIds.length > 0) {
        query = query.in('crew_id', crewIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching crew capacity:', error);
        throw error;
      }

      return data || [];
    },
  });
}

// ============================================
// FETCH SINGLE DAY CAPACITY FOR ALL CREWS
// ============================================

export function useCrewCapacityForDate(date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: [...scheduleKeys.capacity(), 'day', dateStr],
    queryFn: async (): Promise<CrewDailyCapacity[]> => {
      const { data, error } = await supabase
        .from('crew_daily_capacity')
        .select(`
          *,
          crew:crews(id, name, code)
        `)
        .eq('capacity_date', dateStr);

      if (error) {
        console.error('Error fetching daily capacity:', error);
        throw error;
      }

      return data || [];
    },
  });
}

// ============================================
// GET CAPACITY SUMMARY BY CREW
// ============================================

interface CrewCapacitySummary {
  crewId: string;
  crewName: string;
  totalScheduledFootage: number;
  totalAvailableFootage: number;
  averageUtilization: number;
  overCapacityDays: number;
}

export function useCrewCapacitySummary(startDate: Date, endDate: Date) {
  const { data: capacityData, ...rest } = useCrewCapacity(startDate, endDate);

  const summary: CrewCapacitySummary[] = [];

  if (capacityData) {
    // Group by crew
    const byCrew = capacityData.reduce((acc, item) => {
      if (!acc[item.crew_id]) {
        acc[item.crew_id] = [];
      }
      acc[item.crew_id].push(item);
      return acc;
    }, {} as Record<string, CrewDailyCapacity[]>);

    // Calculate summaries
    Object.entries(byCrew).forEach(([crewId, items]) => {
      const totalScheduled = items.reduce((sum, i) => sum + i.scheduled_footage, 0);
      const totalAvailable = items.reduce((sum, i) => sum + i.available_footage, 0);
      const avgUtilization = items.length > 0
        ? items.reduce((sum, i) => sum + i.utilization_percent, 0) / items.length
        : 0;
      const overCapacity = items.filter(i => i.is_over_capacity).length;

      summary.push({
        crewId,
        crewName: items[0]?.crew?.name || 'Unknown',
        totalScheduledFootage: totalScheduled,
        totalAvailableFootage: totalAvailable,
        averageUtilization: Math.round(avgUtilization),
        overCapacityDays: overCapacity,
      });
    });
  }

  return {
    ...rest,
    data: summary,
  };
}
