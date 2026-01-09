/**
 * useJobForm - Form state management for JobCard
 *
 * Handles:
 * - Loading existing job data
 * - Form state with field setters
 * - Computed totals (budget vs actual)
 * - Validation
 * - Save mutations (create/update)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useJob, useCreateJob, useUpdateJob, useJobVisits } from '../../hooks/useJobs';
import type { AddressSnapshot } from '../../types';
import type { JobFormState, JobTotals, JobValidation, JobCardMode } from './types';

const initialFormState: JobFormState = {
  // Project linkage
  projectId: '',
  quoteId: '',

  // Customer
  clientId: '',
  communityId: '',
  propertyId: '',

  // Address
  jobAddress: {
    line1: '',
    line2: '',
    city: '',
    state: 'TX',
    zip: '',
  },

  // Job details
  name: '',
  productType: '',
  linearFeet: null,
  description: '',
  specialInstructions: '',
  notes: '',
  internalNotes: '',

  // Pricing
  quotedTotal: null,

  // Budget
  budgetedLaborHours: null,
  budgetedLaborCost: null,
  budgetedMaterialCost: null,

  // Scheduling
  scheduledDate: '',
  scheduledTimeStart: '',
  scheduledTimeEnd: '',
  estimatedDurationHours: null,

  // Assignment
  assignedCrewId: '',
  assignedRepId: '',
  territoryId: '',

  // Material prep
  bomProjectId: '',

  // Phase tracking
  phaseNumber: 1,
  phaseName: '',
};

interface UseJobFormParams {
  mode: JobCardMode;
  jobId?: string;
  projectId?: string;
  quoteId?: string;
  clientId?: string;
  communityId?: string;
  propertyId?: string;
  jobAddress?: AddressSnapshot;
}

export function useJobForm({
  mode,
  jobId,
  projectId,
  quoteId,
  clientId,
  communityId,
  propertyId,
  jobAddress,
}: UseJobFormParams) {
  const [form, setForm] = useState<JobFormState>(initialFormState);
  const [originalForm, setOriginalForm] = useState<JobFormState>(initialFormState);
  const initializedRef = useRef(false);

  // Fetch existing job if editing/viewing
  const { data: job, isLoading: isLoadingJob } = useJob(jobId);

  // Fetch visits for the job
  const { data: visits = [], isLoading: isLoadingVisits } = useJobVisits(jobId);

  // Mutations
  const createMutation = useCreateJob();
  const updateMutation = useUpdateJob();

  // Initialize form from existing job (edit/view mode)
  useEffect(() => {
    if (mode !== 'create' && job && !initializedRef.current) {
      const jobForm: JobFormState = {
        projectId: job.project_id || '',
        quoteId: job.quote_id || '',
        clientId: job.client_id || '',
        communityId: job.community_id || '',
        propertyId: job.property_id || '',
        jobAddress: job.job_address || initialFormState.jobAddress,
        name: job.name || '',
        productType: job.product_type || '',
        linearFeet: job.linear_feet,
        description: job.description || '',
        specialInstructions: job.special_instructions || '',
        notes: job.notes || '',
        internalNotes: job.internal_notes || '',
        quotedTotal: job.quoted_total,
        budgetedLaborHours: job.budgeted_labor_hours,
        budgetedLaborCost: job.budgeted_labor_cost,
        budgetedMaterialCost: job.budgeted_material_cost,
        scheduledDate: job.scheduled_date || '',
        scheduledTimeStart: job.scheduled_time_start || '',
        scheduledTimeEnd: job.scheduled_time_end || '',
        estimatedDurationHours: job.estimated_duration_hours,
        assignedCrewId: job.assigned_crew_id || '',
        assignedRepId: job.assigned_rep_user_id || '',
        territoryId: job.territory_id || '',
        bomProjectId: job.bom_project_id || '',
        phaseNumber: job.phase_number || 1,
        phaseName: job.phase_name || '',
      };
      setForm(jobForm);
      setOriginalForm(jobForm);
      initializedRef.current = true;
    }
  }, [mode, job]);

  // Initialize form for create mode from props
  useEffect(() => {
    if (mode === 'create' && !initializedRef.current) {
      setForm(prev => ({
        ...prev,
        projectId: projectId || '',
        quoteId: quoteId || '',
        clientId: clientId || '',
        communityId: communityId || '',
        propertyId: propertyId || '',
        jobAddress: jobAddress || prev.jobAddress,
      }));
      initializedRef.current = true;
    }
  }, [mode, projectId, quoteId, clientId, communityId, propertyId, jobAddress]);

  // Reset initialization flag when mode changes
  useEffect(() => {
    if (mode === 'create') {
      initializedRef.current = false;
    }
  }, [mode]);

  // Field setters
  const setField = useCallback(<K extends keyof JobFormState>(
    key: K,
    value: JobFormState[K]
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFields = useCallback((fields: Partial<JobFormState>) => {
    setForm(prev => ({ ...prev, ...fields }));
  }, []);

  // Computed totals
  const totals = useMemo<JobTotals>(() => {
    const budgetedLaborHours = form.budgetedLaborHours || 0;
    const budgetedLaborCost = form.budgetedLaborCost || 0;
    const budgetedMaterialCost = form.budgetedMaterialCost || 0;
    const budgetedTotalCost = budgetedLaborCost + budgetedMaterialCost;

    // Actual from job (updated after visits complete)
    const actualLaborHours = job?.actual_labor_hours || 0;
    const actualLaborCost = job?.actual_labor_cost || 0;
    const actualMaterialCost = job?.actual_material_cost || 0;
    const actualTotalCost = job?.actual_total_cost || 0;

    // Variance (negative = under budget, positive = over budget)
    const laborHoursVariance = actualLaborHours - budgetedLaborHours;
    const laborCostVariance = actualLaborCost - budgetedLaborCost;
    const materialCostVariance = actualMaterialCost - budgetedMaterialCost;
    const totalCostVariance = actualTotalCost - budgetedTotalCost;

    // Profit
    const quotedTotal = form.quotedTotal || 0;
    const profitMargin = quotedTotal - actualTotalCost;
    const profitMarginPercent = quotedTotal > 0
      ? ((quotedTotal - actualTotalCost) / quotedTotal) * 100
      : 0;

    return {
      budgetedLaborHours,
      budgetedLaborCost,
      budgetedMaterialCost,
      budgetedTotalCost,
      actualLaborHours,
      actualLaborCost,
      actualMaterialCost,
      actualTotalCost,
      laborHoursVariance,
      laborCostVariance,
      materialCostVariance,
      totalCostVariance,
      quotedTotal,
      profitMargin,
      profitMarginPercent,
    };
  }, [form, job]);

  // Validation
  const validation = useMemo<JobValidation>(() => {
    const errors: Record<string, string> = {};

    if (!form.clientId) {
      errors.clientId = 'Client is required';
    }

    if (!form.jobAddress?.line1) {
      errors.jobAddress = 'Job address is required';
    }

    // Scheduling validation
    if (form.scheduledDate && !form.assignedCrewId) {
      errors.assignedCrewId = 'Crew is required when job is scheduled';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [form]);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  // Save function
  const save = useCallback(async (): Promise<string | null> => {
    if (!validation.isValid) {
      return null;
    }

    try {
      if (mode === 'create') {
        const result = await createMutation.mutateAsync({
          quote_id: form.quoteId || undefined,
          client_id: form.clientId,
          community_id: form.communityId || undefined,
          property_id: form.propertyId || undefined,
          job_address: form.jobAddress,
          product_type: form.productType || undefined,
          linear_feet: form.linearFeet || undefined,
          description: form.description || undefined,
          special_instructions: form.specialInstructions || undefined,
          quoted_total: form.quotedTotal || undefined,
          scheduled_date: form.scheduledDate || undefined,
          scheduled_time_start: form.scheduledTimeStart || undefined,
          scheduled_time_end: form.scheduledTimeEnd || undefined,
          estimated_duration_hours: form.estimatedDurationHours || undefined,
          assigned_crew_id: form.assignedCrewId || undefined,
          assigned_rep_id: form.assignedRepId || undefined,
          territory_id: form.territoryId || undefined,
          bom_project_id: form.bomProjectId || undefined,
        });
        return result.id;
      } else if (jobId) {
        await updateMutation.mutateAsync({
          id: jobId,
          data: {
            name: form.name || null,
            product_type: form.productType || null,
            linear_feet: form.linearFeet,
            description: form.description || null,
            special_instructions: form.specialInstructions || null,
            notes: form.notes || null,
            internal_notes: form.internalNotes || null,
            quoted_total: form.quotedTotal,
            budgeted_labor_hours: form.budgetedLaborHours,
            budgeted_labor_cost: form.budgetedLaborCost,
            budgeted_material_cost: form.budgetedMaterialCost,
            scheduled_date: form.scheduledDate || null,
            scheduled_time_start: form.scheduledTimeStart || null,
            scheduled_time_end: form.scheduledTimeEnd || null,
            estimated_duration_hours: form.estimatedDurationHours,
            assigned_crew_id: form.assignedCrewId || null,
            assigned_rep_user_id: form.assignedRepId || null,
            territory_id: form.territoryId || null,
            phase_number: form.phaseNumber,
            phase_name: form.phaseName || null,
          },
        });
        return jobId;
      }
      return null;
    } catch (error) {
      console.error('Failed to save job:', error);
      throw error;
    }
  }, [mode, form, validation, jobId, createMutation, updateMutation]);

  return {
    form,
    setField,
    setFields,
    totals,
    validation,
    isDirty,
    save,
    isSaving: createMutation.isPending || updateMutation.isPending,
    job,
    visits,
    isLoading: isLoadingJob || isLoadingVisits,
  };
}
