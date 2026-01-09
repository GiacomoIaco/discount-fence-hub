/**
 * JobCard Type Definitions
 *
 * Types for the unified JobCard component (create/edit/view modes)
 */

import type { Job, JobStatus, JobVisit, JobVisitType, Crew, AddressSnapshot, VisitType } from '../../types';

// Component mode
export type JobCardMode = 'create' | 'edit' | 'view';

// Main component props
export interface JobCardProps {
  mode: JobCardMode;
  jobId?: string;
  projectId?: string;
  quoteId?: string;
  clientId?: string;
  communityId?: string;
  propertyId?: string;
  jobAddress?: AddressSnapshot;
  // Callbacks
  onSave?: (job: Job) => void;
  onCancel?: () => void;
  onBack?: () => void;
  onComplete?: (jobId: string) => void;
  onCreateInvoice?: (jobId: string) => void;
}

// Form state for job editing
export interface JobFormState {
  // Project linkage
  projectId: string;
  quoteId: string;

  // Customer
  clientId: string;
  communityId: string;
  propertyId: string;

  // Address
  jobAddress: AddressSnapshot;

  // Job details
  name: string;
  productType: string;
  linearFeet: number | null;
  description: string;
  specialInstructions: string;
  notes: string;
  internalNotes: string;

  // Pricing
  quotedTotal: number | null;

  // Budget
  budgetedLaborHours: number | null;
  budgetedLaborCost: number | null;
  budgetedMaterialCost: number | null;

  // Scheduling
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd: string;
  estimatedDurationHours: number | null;

  // Assignment
  assignedCrewId: string;
  assignedRepId: string;
  territoryId: string;

  // Material prep
  bomProjectId: string;

  // Phase tracking
  phaseNumber: number;
  phaseName: string;
}

// Computed totals/summary
export interface JobTotals {
  // Budget
  budgetedLaborHours: number;
  budgetedLaborCost: number;
  budgetedMaterialCost: number;
  budgetedTotalCost: number;

  // Actual (from visits)
  actualLaborHours: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualTotalCost: number;

  // Variance
  laborHoursVariance: number;
  laborCostVariance: number;
  materialCostVariance: number;
  totalCostVariance: number;

  // Profit
  quotedTotal: number;
  profitMargin: number;
  profitMarginPercent: number;
}

// Validation state
export interface JobValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

// Visit form state for adding/editing visits
export interface VisitFormState {
  id?: string;
  visitNumber: number;
  visitType: VisitType;
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd: string;
  assignedCrewId: string;
  estimatedHours: number | null;
  notes: string;
}

// Header component props
export interface JobHeaderProps {
  mode: JobCardMode;
  job: Job | null;
  validation: JobValidation;
  isSaving: boolean;
  isDirty: boolean;
  onBack?: () => void;
  onCancel?: () => void;
  onSave: () => void;
  onEdit?: () => void;
  onComplete?: () => void;
  onCreateInvoice?: () => void;
  onSchedule?: () => void;
  onSendToYard?: () => void;
  onAddVisit?: () => void;
  onReportIssue?: () => void;
}

// Visits section props
export interface JobVisitsSectionProps {
  mode: JobCardMode;
  jobId?: string;
  visits: JobVisit[];
  isLoading?: boolean;
  onAddVisit: () => void;
  onEditVisit: (visit: JobVisit) => void;
  onCompleteVisit: (visitId: string) => void;
  onStartVisit: (visitId: string) => void;
}

// Budget section props
export interface JobBudgetSectionProps {
  mode: JobCardMode;
  totals: JobTotals;
  hasRework?: boolean;
  reworkReason?: string | null;
  reworkCost?: number;
}

// Sidebar props
export interface JobSidebarProps {
  mode: JobCardMode;
  form: JobFormState;
  job: Job | null;
  crews: Crew[];
  isLoadingCrews?: boolean;
  validation: JobValidation;
  onFieldChange: (field: keyof JobFormState, value: string | number | null) => void;
  onCrewChange: (crewId: string) => void;
  onRepChange: (repId: string) => void;
}

// Scheduling modal props
export interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    date: string;
    timeStart: string;
    timeEnd: string;
    crewId: string;
  }) => void;
  initialData?: {
    date?: string;
    timeStart?: string;
    timeEnd?: string;
    crewId?: string;
  };
  crews: Crew[];
  isLoading?: boolean;
}

// Visit editor modal props
export interface VisitEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: VisitFormState) => void;
  visit?: JobVisit;
  jobId: string;
  crews: Crew[];
  isLoading?: boolean;
}

// Status constants
export const JOB_STATUS_COLORS: Record<JobStatus, { bg: string; text: string; label: string }> = {
  won: { bg: 'bg-green-100', text: 'text-green-700', label: 'Won' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
  ready_for_yard: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Ready for Yard' },
  picking: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Picking' },
  staged: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Staged' },
  loaded: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Loaded' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
  requires_invoicing: { bg: 'bg-red-100', text: 'text-red-700', label: 'Requires Invoicing' },
};

// Visit type labels (for JobVisitType from job_visits table)
export const VISIT_TYPE_LABELS: Record<JobVisitType, string> = {
  initial: 'Initial Installation',
  continuation: 'Continuation',
  inspection: 'Inspection',
  rework: 'Rework',
  callback: 'Callback',
  warranty: 'Warranty',
};

export const VISIT_TYPE_COLORS: Record<JobVisitType, { bg: string; text: string }> = {
  initial: { bg: 'bg-blue-100', text: 'text-blue-700' },
  continuation: { bg: 'bg-purple-100', text: 'text-purple-700' },
  inspection: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  rework: { bg: 'bg-red-100', text: 'text-red-700' },
  callback: { bg: 'bg-orange-100', text: 'text-orange-700' },
  warranty: { bg: 'bg-amber-100', text: 'text-amber-700' },
};
