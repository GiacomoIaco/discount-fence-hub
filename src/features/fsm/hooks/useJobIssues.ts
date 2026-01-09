/**
 * useJobIssues - Hook for Job Issues CRUD with Penalization
 *
 * Job Issues are problems discovered during job execution that require
 * tracking, accountability, and potentially penalization.
 *
 * Issue Types:
 * - rework_crew: Previous crew set something wrong
 * - rework_material: Material was defective
 * - existing_condition: Rotted wood, etc. customer didn't disclose
 * - customer_caused: Customer damaged fence
 * - scope_change: Customer wants something different
 * - weather_damage: Storm damage during project
 * - other: Anything else
 *
 * Penalization Types:
 * - backcharge_crew: Deduct from crew payment
 * - commission_reduction: Reduce rep commission
 * - formal_warning: Logged warning (accumulates)
 * - supplier_claim: Vendor dispute
 * - none: No penalty
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { showError, showSuccess } from '@/utils/toast';
import type {
  JobIssue,
  JobIssueType,
  JobIssueStatus,
  PenalizationType,
} from '../types';

// Query for all issues on a specific job
export function useJobIssues(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job_issues', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_issues')
        .select(`
          *,
          job:jobs(id, job_number),
          responsible_crew:crews(id, name),
          responsible_user:user_profiles(id, full_name),
          penalization_approver:user_profiles!job_issues_penalization_approved_by_fkey(id, full_name)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as JobIssue[];
    },
    enabled: !!jobId,
  });
}

// Query for a single issue
export function useJobIssue(issueId: string | undefined) {
  return useQuery({
    queryKey: ['job_issue', issueId],
    queryFn: async () => {
      if (!issueId) return null;

      const { data, error } = await supabase
        .from('job_issues')
        .select(`
          *,
          job:jobs(id, job_number, project_id),
          responsible_crew:crews(id, name),
          responsible_user:user_profiles(id, full_name),
          penalization_approver:user_profiles!job_issues_penalization_approved_by_fkey(id, full_name)
        `)
        .eq('id', issueId)
        .single();

      if (error) throw error;
      return data as JobIssue;
    },
    enabled: !!issueId,
  });
}

// Create issue data interface
interface CreateJobIssueData {
  job_id: string;
  issue_type: JobIssueType;
  title: string;
  description?: string;
  is_billable?: boolean;
  estimated_cost?: number;
  estimated_price?: number;
  responsible_crew_id?: string;
  responsible_user_id?: string;
}

export function useCreateJobIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateJobIssueData) => {
      const { data: result, error } = await supabase
        .from('job_issues')
        .insert({
          job_id: data.job_id,
          issue_type: data.issue_type,
          title: data.title,
          description: data.description || null,
          is_billable: data.is_billable || false,
          estimated_cost: data.estimated_cost || null,
          estimated_price: data.estimated_price || null,
          responsible_crew_id: data.responsible_crew_id || null,
          responsible_user_id: data.responsible_user_id || null,
          status: 'identified',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job_issues', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      showSuccess('Issue reported');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to report issue');
    },
  });
}

// Update issue data interface
interface UpdateJobIssueData {
  id: string;
  issue_type?: JobIssueType;
  title?: string;
  description?: string;
  is_billable?: boolean;
  estimated_cost?: number;
  estimated_price?: number;
  actual_cost?: number;
  status?: JobIssueStatus;
  resolution_notes?: string;
  responsible_crew_id?: string | null;
  responsible_user_id?: string | null;
}

export function useUpdateJobIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateJobIssueData) => {
      const { id, ...updates } = data;
      const { error } = await supabase
        .from('job_issues')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_issues'] });
      queryClient.invalidateQueries({ queryKey: ['job_issue'] });
      showSuccess('Issue updated');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update issue');
    },
  });
}

// Resolve an issue
interface ResolveJobIssueData {
  id: string;
  resolution_notes: string;
  actual_cost?: number;
}

export function useResolveJobIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ResolveJobIssueData) => {
      const { error } = await supabase
        .from('job_issues')
        .update({
          status: 'resolved',
          resolution_notes: data.resolution_notes,
          actual_cost: data.actual_cost || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_issues'] });
      queryClient.invalidateQueries({ queryKey: ['job_issue'] });
      showSuccess('Issue resolved');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to resolve issue');
    },
  });
}

// Apply penalization to an issue
interface ApplyPenalizationData {
  id: string;
  penalization_type: PenalizationType;
  penalization_amount?: number;  // For backcharge_crew, supplier_claim
  penalization_percent?: number; // For commission_reduction
  penalization_notes?: string;
  penalization_target_id?: string; // crew_id or user_id
}

export function useApplyPenalization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ApplyPenalizationData) => {
      // Get current user for approval tracking
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('job_issues')
        .update({
          penalization_type: data.penalization_type,
          penalization_amount: data.penalization_amount || null,
          penalization_percent: data.penalization_percent || null,
          penalization_target_id: data.penalization_target_id || null,
          penalization_notes: data.penalization_notes || null,
          penalization_approved_by: user?.id || null,
          penalization_approved_at: new Date().toISOString(),
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_issues'] });
      queryClient.invalidateQueries({ queryKey: ['job_issue'] });
      showSuccess('Penalization applied');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to apply penalization');
    },
  });
}

// Delete an issue (only if not yet approved)
export function useDeleteJobIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('job_issues')
        .delete()
        .eq('id', id)
        .neq('status', 'approved'); // Can't delete approved issues

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job_issues'] });
      showSuccess('Issue deleted');
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to delete issue');
    },
  });
}

// Helper constants for UI
export const ISSUE_TYPE_LABELS: Record<JobIssueType, string> = {
  rework_crew: 'Crew Rework',
  rework_material: 'Material Defect',
  existing_condition: 'Existing Condition',
  customer_caused: 'Customer Caused',
  scope_change: 'Scope Change',
  weather_damage: 'Weather Damage',
  other: 'Other',
};

export const ISSUE_TYPE_COLORS: Record<JobIssueType, string> = {
  rework_crew: 'bg-red-100 text-red-700',
  rework_material: 'bg-orange-100 text-orange-700',
  existing_condition: 'bg-amber-100 text-amber-700',
  customer_caused: 'bg-yellow-100 text-yellow-700',
  scope_change: 'bg-blue-100 text-blue-700',
  weather_damage: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
};

export const ISSUE_STATUS_LABELS: Record<JobIssueStatus, string> = {
  identified: 'Identified',
  assessing: 'Assessing',
  approved: 'Approved',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export const ISSUE_STATUS_COLORS: Record<JobIssueStatus, string> = {
  identified: 'bg-gray-100 text-gray-700',
  assessing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  in_progress: 'bg-purple-100 text-purple-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const PENALIZATION_TYPE_LABELS: Record<PenalizationType, string> = {
  backcharge_crew: 'Backcharge Crew',
  commission_reduction: 'Commission Reduction',
  formal_warning: 'Formal Warning',
  supplier_claim: 'Supplier Claim',
  none: 'No Penalty',
};

export const PENALIZATION_TYPE_COLORS: Record<PenalizationType, string> = {
  backcharge_crew: 'bg-red-100 text-red-700',
  commission_reduction: 'bg-orange-100 text-orange-700',
  formal_warning: 'bg-amber-100 text-amber-700',
  supplier_claim: 'bg-purple-100 text-purple-700',
  none: 'bg-gray-100 text-gray-600',
};
