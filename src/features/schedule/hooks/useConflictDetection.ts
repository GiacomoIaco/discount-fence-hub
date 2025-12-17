import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import {
  detectConflicts,
  hasBlockingConflicts,
  getConflictsSummary,
} from '../utils/conflictDetector';
import type {
  ScheduleConflict,
  ConflictCheckInput,
  ConflictCheckContext,
} from '../utils/conflictDetector';
import type { ScheduleEntry } from '../types/schedule.types';

// ============================================
// CONFLICT DETECTION HOOK
// ============================================

interface UseConflictDetectionOptions {
  // Entry being scheduled
  entryId?: string;
  crewId: string | null;
  salesRepId: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  estimatedFootage: number | null;
  entryType: string;
  jobId?: string | null;
  // Optional: pass crew max footage if already known
  crewMaxFootage?: number;
  // Enable/disable detection
  enabled?: boolean;
}

interface ConflictDetectionResult {
  conflicts: ScheduleConflict[];
  hasBlockingConflicts: boolean;
  summary: string;
  isLoading: boolean;
}

export function useConflictDetection(
  options: UseConflictDetectionOptions
): ConflictDetectionResult {
  const {
    entryId,
    crewId,
    salesRepId,
    scheduledDate,
    startTime,
    endTime,
    estimatedFootage,
    entryType,
    jobId,
    crewMaxFootage: providedMaxFootage,
    enabled = true,
  } = options;

  // Fetch existing entries on the same date
  const { data: existingEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['schedule_conflicts', scheduledDate],
    queryFn: async (): Promise<ScheduleEntry[]> => {
      if (!scheduledDate) return [];

      const { data, error } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('scheduled_date', scheduledDate)
        .not('status', 'eq', 'cancelled');

      if (error) {
        console.error('Error fetching entries for conflict check:', error);
        return [];
      }

      return (data || []) as ScheduleEntry[];
    },
    enabled: enabled && !!scheduledDate,
    staleTime: 10000, // Cache for 10 seconds
  });

  // Fetch crew capacity and max footage
  const { data: crewData, isLoading: crewLoading } = useQuery({
    queryKey: ['crew_for_conflicts', crewId],
    queryFn: async () => {
      if (!crewId) return null;

      const { data, error } = await supabase
        .from('crews')
        .select('id, max_daily_lf')
        .eq('id', crewId)
        .single();

      if (error) {
        console.error('Error fetching crew for conflict check:', error);
        return null;
      }

      return data;
    },
    enabled: enabled && !!crewId,
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch builder preferences if we have a job
  const { data: builderPrefs, isLoading: prefsLoading } = useQuery({
    queryKey: ['builder_prefs_for_conflicts', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      // Get job -> client -> community chain to check preferences
      const { data: job, error } = await supabase
        .from('jobs')
        .select(`
          id,
          client:clients(
            id,
            preferred_crew_id,
            community:communities(
              id,
              preferred_crew_id
            )
          )
        `)
        .eq('id', jobId)
        .single();

      if (error || !job) return null;

      const client = job.client as any;
      return {
        preferredCrewId: client?.preferred_crew_id || client?.community?.preferred_crew_id || null,
        // Future: could add avoid_crew_ids if we add that field
        avoidCrewIds: [] as string[],
      };
    },
    enabled: enabled && !!jobId,
    staleTime: 60000,
  });

  // Compute conflicts
  const conflicts = useMemo(() => {
    if (!scheduledDate || !enabled) return [];

    const input: ConflictCheckInput = {
      entryId,
      crewId,
      salesRepId,
      scheduledDate,
      startTime,
      endTime,
      estimatedFootage,
      entryType,
      jobId,
    };

    const context: ConflictCheckContext = {
      existingEntries,
      crewMaxFootage: providedMaxFootage || crewData?.max_daily_lf || 200,
      preferredCrewId: builderPrefs?.preferredCrewId,
      avoidCrewIds: builderPrefs?.avoidCrewIds || [],
    };

    return detectConflicts(input, context);
  }, [
    entryId,
    crewId,
    salesRepId,
    scheduledDate,
    startTime,
    endTime,
    estimatedFootage,
    entryType,
    jobId,
    existingEntries,
    providedMaxFootage,
    crewData,
    builderPrefs,
    enabled,
  ]);

  return {
    conflicts,
    hasBlockingConflicts: hasBlockingConflicts(conflicts),
    summary: getConflictsSummary(conflicts),
    isLoading: entriesLoading || crewLoading || prefsLoading,
  };
}

// ============================================
// BATCH CONFLICT CHECK (for calendar view)
// ============================================

/**
 * Check conflicts for multiple entries at once.
 * Useful for showing conflict indicators on the calendar.
 */
export function useEntriesWithConflicts(entries: ScheduleEntry[]) {
  // Group entries by date and crew/rep for efficient checking
  const entriesWithConflicts = useMemo(() => {
    const result: Map<string, ScheduleConflict[]> = new Map();

    // Group by date
    const byDate = new Map<string, ScheduleEntry[]>();
    entries.forEach((entry) => {
      const date = entry.scheduled_date;
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(entry);
    });

    // Check each entry against others on the same date
    entries.forEach((entry) => {
      const dateEntries = byDate.get(entry.scheduled_date) || [];

      const input: ConflictCheckInput = {
        entryId: entry.id,
        crewId: entry.crew_id,
        salesRepId: entry.sales_rep_id,
        scheduledDate: entry.scheduled_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
        estimatedFootage: entry.estimated_footage,
        entryType: entry.entry_type,
        jobId: entry.job_id,
      };

      const context: ConflictCheckContext = {
        existingEntries: dateEntries,
        // Note: We don't have crew max footage here, would need to pass it
        crewMaxFootage: 200, // Default
      };

      const conflicts = detectConflicts(input, context);
      if (conflicts.length > 0) {
        result.set(entry.id, conflicts);
      }
    });

    return result;
  }, [entries]);

  return entriesWithConflicts;
}
