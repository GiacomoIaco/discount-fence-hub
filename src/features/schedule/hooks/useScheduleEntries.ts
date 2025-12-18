import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ScheduleEntry,
  CreateScheduleEntryInput,
  UpdateScheduleEntryInput,
  ScheduleEntriesFilter,
} from '../types/schedule.types';
import { format, addDays, parseISO } from 'date-fns';

// ============================================
// QUERY KEYS
// ============================================

export const scheduleKeys = {
  all: ['schedule'] as const,
  entries: () => [...scheduleKeys.all, 'entries'] as const,
  entriesByRange: (startDate: string, endDate: string) =>
    [...scheduleKeys.entries(), startDate, endDate] as const,
  entry: (id: string) => [...scheduleKeys.entries(), id] as const,
  capacity: () => [...scheduleKeys.all, 'capacity'] as const,
  capacityByRange: (startDate: string, endDate: string) =>
    [...scheduleKeys.capacity(), startDate, endDate] as const,
};

// ============================================
// FETCH SCHEDULE ENTRIES
// ============================================

export function useScheduleEntries(filter: ScheduleEntriesFilter) {
  const startDateStr = format(filter.startDate, 'yyyy-MM-dd');
  const endDateStr = format(filter.endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: scheduleKeys.entriesByRange(startDateStr, endDateStr),
    queryFn: async (): Promise<ScheduleEntry[]> => {
      let query = supabase
        .from('schedule_entries')
        .select(`
          *,
          job:jobs(
            id,
            job_number,
            name,
            project_id,
            invoice_group_id,
            client:clients(name),
            project:projects(id, project_number)
          ),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code)
        `)
        .gte('scheduled_date', startDateStr)
        .lte('scheduled_date', endDateStr)
        .not('status', 'eq', 'cancelled')
        .order('scheduled_date', { ascending: true })
        .order('start_time', { ascending: true });

      // Apply optional filters
      if (filter.crewIds && filter.crewIds.length > 0) {
        query = query.in('crew_id', filter.crewIds);
      }
      if (filter.repIds && filter.repIds.length > 0) {
        query = query.in('sales_rep_id', filter.repIds);
      }
      if (filter.entryTypes && filter.entryTypes.length > 0) {
        query = query.in('entry_type', filter.entryTypes);
      }
      if (filter.statuses && filter.statuses.length > 0) {
        query = query.in('status', filter.statuses);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching schedule entries:', error);
        throw error;
      }

      // Get project job counts for multi-job detection
      const projectIds = [...new Set(
        (data || [])
          .filter((e: any) => e.job?.project_id)
          .map((e: any) => e.job.project_id)
      )];

      let projectJobCounts: Record<string, number> = {};
      if (projectIds.length > 0) {
        const { data: jobCounts } = await supabase
          .from('jobs')
          .select('project_id')
          .in('project_id', projectIds);

        if (jobCounts) {
          jobCounts.forEach((j: any) => {
            projectJobCounts[j.project_id] = (projectJobCounts[j.project_id] || 0) + 1;
          });
        }
      }

      // Transform the nested job and project data
      return (data || []).map((entry: any) => ({
        ...entry,
        job: entry.job
          ? {
              ...entry.job,
              client_name: entry.job.client?.name,
              project_number: entry.job.project?.project_number,
              project_job_count: entry.job.project_id
                ? projectJobCounts[entry.job.project_id] || 1
                : 1,
            }
          : undefined,
        service_request: entry.service_request
          ? {
              ...entry.service_request,
              client_name: entry.service_request.contact_name,
            }
          : undefined,
      }));
    },
  });
}

// ============================================
// FETCH SINGLE ENTRY
// ============================================

export function useScheduleEntry(id: string | undefined) {
  return useQuery({
    queryKey: scheduleKeys.entry(id || ''),
    queryFn: async (): Promise<ScheduleEntry | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('schedule_entries')
        .select(`
          *,
          job:jobs(id, job_number, client:clients(name)),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching schedule entry:', error);
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
}

// ============================================
// CREATE SCHEDULE ENTRY
// ============================================

export function useCreateScheduleEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateScheduleEntryInput): Promise<ScheduleEntry> => {
      const { data: user } = await supabase.auth.getUser();
      const { total_days = 1, ...baseInput } = input;

      // Single day entry (original behavior)
      if (total_days <= 1) {
        const { data, error } = await supabase
          .from('schedule_entries')
          .insert({
            ...baseInput,
            is_multi_day: false,
            total_days: 1,
            multi_day_sequence: null,
            parent_entry_id: null,
            created_by: user?.user?.id,
          })
          .select(`
            *,
            job:jobs(id, job_number, client:clients(name)),
            service_request:service_requests(id, request_number, contact_name),
            crew:crews(id, name, code)
          `)
          .single();

        if (error) {
          console.error('Error creating schedule entry:', error);
          throw error;
        }

        return data;
      }

      // Multi-day entry: create parent (day 1) first
      const startDate = parseISO(baseInput.scheduled_date);
      const footagePerDay = baseInput.estimated_footage
        ? Math.ceil(baseInput.estimated_footage / total_days)
        : null;
      const hoursPerDay = baseInput.estimated_hours
        ? Math.round((baseInput.estimated_hours / total_days) * 10) / 10
        : null;

      // Create first day (parent)
      const { data: parentEntry, error: parentError } = await supabase
        .from('schedule_entries')
        .insert({
          ...baseInput,
          is_multi_day: true,
          total_days,
          multi_day_sequence: 1,
          parent_entry_id: null,
          estimated_footage: footagePerDay,
          estimated_hours: hoursPerDay,
          created_by: user?.user?.id,
        })
        .select(`
          *,
          job:jobs(id, job_number, client:clients(name)),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code)
        `)
        .single();

      if (parentError) {
        console.error('Error creating parent schedule entry:', parentError);
        throw parentError;
      }

      // Create subsequent days (children)
      const childEntries = [];
      for (let day = 2; day <= total_days; day++) {
        const childDate = addDays(startDate, day - 1);
        childEntries.push({
          ...baseInput,
          scheduled_date: format(childDate, 'yyyy-MM-dd'),
          is_multi_day: true,
          total_days,
          multi_day_sequence: day,
          parent_entry_id: parentEntry.id,
          estimated_footage: footagePerDay,
          estimated_hours: hoursPerDay,
          created_by: user?.user?.id,
        });
      }

      if (childEntries.length > 0) {
        const { error: childError } = await supabase
          .from('schedule_entries')
          .insert(childEntries);

        if (childError) {
          console.error('Error creating child schedule entries:', childError);
          // Note: Parent entry was already created, so we have partial data
          throw childError;
        }
      }

      return parentEntry;
    },
    onSuccess: () => {
      // Invalidate all schedule queries to refresh data
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
}

// ============================================
// UPDATE SCHEDULE ENTRY
// ============================================

export function useUpdateScheduleEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateScheduleEntryInput): Promise<ScheduleEntry> => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('schedule_entries')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          job:jobs(id, job_number, client:clients(name)),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code)
        `)
        .single();

      if (error) {
        console.error('Error updating schedule entry:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entry(data.id) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
}

// ============================================
// DELETE SCHEDULE ENTRY
// ============================================

export function useDeleteScheduleEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting schedule entry:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
}

// ============================================
// QUICK UPDATE (for drag-drop)
// ============================================

export function useQuickUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      scheduled_date: string;
      start_time?: string | null;
      end_time?: string | null;
      crew_id?: string | null;
      sales_rep_id?: string | null;
    }): Promise<void> => {
      const { id, ...updates } = params;

      const { error } = await supabase
        .from('schedule_entries')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Error quick updating entry:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
}

// ============================================
// MOVE MULTI-DAY ENTRIES (for drag-drop)
// ============================================

export function useMoveMultiDayEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      entryId: string;
      newDate: string;
      newCrewId?: string | null;
      newSalesRepId?: string | null;
    }): Promise<void> => {
      const { entryId, newDate, newCrewId, newSalesRepId } = params;

      // First, get the entry to check if it's part of a multi-day job
      const { data: entry, error: fetchError } = await supabase
        .from('schedule_entries')
        .select('id, scheduled_date, is_multi_day, multi_day_sequence, parent_entry_id, total_days, crew_id, sales_rep_id')
        .eq('id', entryId)
        .single();

      if (fetchError || !entry) {
        console.error('Error fetching entry for multi-day move:', fetchError);
        throw fetchError || new Error('Entry not found');
      }

      // If not multi-day, just update this entry
      if (!entry.is_multi_day) {
        const { error } = await supabase
          .from('schedule_entries')
          .update({
            scheduled_date: newDate,
            ...(newCrewId !== undefined && { crew_id: newCrewId }),
            ...(newSalesRepId !== undefined && { sales_rep_id: newSalesRepId }),
          })
          .eq('id', entryId);

        if (error) throw error;
        return;
      }

      // For multi-day entries, calculate the day offset and move all related entries
      const oldDate = parseISO(entry.scheduled_date);
      const targetDate = parseISO(newDate);
      const dayOffset = Math.round((targetDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));

      // Find all related entries (parent + children)
      const parentId = entry.parent_entry_id || entry.id;

      const { data: relatedEntries, error: relatedError } = await supabase
        .from('schedule_entries')
        .select('id, scheduled_date')
        .or(`id.eq.${parentId},parent_entry_id.eq.${parentId}`);

      if (relatedError) {
        console.error('Error fetching related entries:', relatedError);
        throw relatedError;
      }

      // Update all related entries with the same offset
      for (const relEntry of relatedEntries || []) {
        const relOldDate = parseISO(relEntry.scheduled_date);
        const relNewDate = addDays(relOldDate, dayOffset);

        const { error: updateError } = await supabase
          .from('schedule_entries')
          .update({
            scheduled_date: format(relNewDate, 'yyyy-MM-dd'),
            ...(newCrewId !== undefined && { crew_id: newCrewId }),
            ...(newSalesRepId !== undefined && { sales_rep_id: newSalesRepId }),
          })
          .eq('id', relEntry.id);

        if (updateError) {
          console.error('Error updating related entry:', updateError);
          // Continue with others even if one fails
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.entries() });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.capacity() });
    },
  });
}
