import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type {
  ScheduleEntry,
  CreateScheduleEntryInput,
  UpdateScheduleEntryInput,
  ScheduleEntriesFilter,
} from '../types/schedule.types';
import { format } from 'date-fns';

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
            material_status,
            project_id,
            invoice_group_id,
            client:clients(name),
            project:projects(id, project_number)
          ),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code),
          sales_rep:sales_reps(id, name)
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
          job:jobs(id, job_number, client:clients(name), material_status),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code),
          sales_rep:sales_reps(id, name)
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

      const { data, error } = await supabase
        .from('schedule_entries')
        .insert({
          ...input,
          created_by: user?.user?.id,
        })
        .select(`
          *,
          job:jobs(id, job_number, client:clients(name)),
          service_request:service_requests(id, request_number, contact_name),
          crew:crews(id, name, code),
          sales_rep:sales_reps(id, name)
        `)
        .single();

      if (error) {
        console.error('Error creating schedule entry:', error);
        throw error;
      }

      return data;
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
          crew:crews(id, name, code),
          sales_rep:sales_reps(id, name)
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
