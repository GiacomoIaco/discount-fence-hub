import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Job } from '../../fsm/types';

// ============================================
// UNSCHEDULED JOBS HOOK
// Fetches jobs that don't have schedule entries yet
// ============================================

export interface UnscheduledJob extends Job {
  client_name?: string;
  community_name?: string;
}

export function useUnscheduledJobs() {
  return useQuery({
    queryKey: ['jobs', 'unscheduled'],
    queryFn: async (): Promise<UnscheduledJob[]> => {
      // Get jobs that are in schedulable statuses but don't have schedule entries
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name)
        `)
        .in('status', ['won', 'scheduled', 'ready_for_yard'])
        .is('scheduled_date', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Also get jobs that have a date but no schedule_entry
      const { data: datedJobs, error: datedError } = await supabase
        .from('jobs')
        .select(`
          *,
          client:clients(id, name),
          community:communities(id, name)
        `)
        .in('status', ['won', 'scheduled', 'ready_for_yard'])
        .not('scheduled_date', 'is', null);

      if (datedError) throw datedError;

      // Check which dated jobs have schedule entries
      const datedJobIds = (datedJobs || []).map(j => j.id);

      let jobsWithEntries: string[] = [];
      if (datedJobIds.length > 0) {
        const { data: entries } = await supabase
          .from('schedule_entries')
          .select('job_id')
          .in('job_id', datedJobIds)
          .neq('status', 'cancelled');

        jobsWithEntries = (entries || []).map(e => e.job_id).filter(Boolean) as string[];
      }

      // Filter out jobs that already have schedule entries
      const unscheduledDatedJobs = (datedJobs || []).filter(
        job => !jobsWithEntries.includes(job.id)
      );

      // Combine and format results
      const allJobs = [...(data || []), ...unscheduledDatedJobs];

      return allJobs.map(job => ({
        ...job,
        client_name: job.client?.name,
        community_name: job.community?.name,
      }));
    },
    staleTime: 30000, // 30 seconds
  });
}
