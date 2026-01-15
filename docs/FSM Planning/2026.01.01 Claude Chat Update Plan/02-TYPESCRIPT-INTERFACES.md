# TypeScript Interfaces - FSM Architecture Overhaul

## Overview

This document contains all TypeScript interfaces needed for the new FSM architecture. Add these to or modify in `/src/features/fsm/types.ts`.

---

## New Types to Add

### Job Visits

```typescript
// ============================================
// JOB VISITS
// ============================================

export type VisitType = 
  | 'scheduled'     // Original planned work
  | 'continuation'  // Multi-day job, continuing work
  | 'callback'      // Customer called, something wrong
  | 'rework'        // We identified issue, going back to fix
  | 'punch_list'    // Final touch-ups before closing
  | 'inspection';   // Quality check / customer walkthrough

export type VisitStatus = 
  | 'scheduled'
  | 'en_route'
  | 'on_site'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type IssueReportedBy = 
  | 'customer'
  | 'crew'
  | 'office'
  | 'inspection';

export interface JobVisit {
  id: string;
  job_id: string;
  visit_number: number;
  
  // Type
  visit_type: VisitType;
  
  // Scheduling
  scheduled_date: string | null;
  scheduled_time: string | null;
  arrival_window_minutes: number;
  assigned_crew_id: string | null;
  
  // Execution
  started_at: string | null;
  completed_at: string | null;
  
  // Labor tracking
  estimated_hours: number | null;
  actual_hours: number | null;
  labor_rate: number | null;
  labor_cost: number | null;
  
  // Issue tracking (for callbacks/rework)
  issue_description: string | null;
  issue_reported_by: IssueReportedBy | null;
  issue_reported_at: string | null;
  
  // Resolution
  resolution_notes: string | null;
  resolution_verified_by: string | null;
  
  // Notes
  instructions: string | null;
  completion_notes: string | null;
  
  // Status
  status: VisitStatus;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined data
  assigned_crew?: Crew;
  job?: Job;
}

export interface JobVisitFormData {
  visit_type: VisitType;
  scheduled_date: string;
  scheduled_time: string;
  assigned_crew_id: string;
  estimated_hours: string;
  instructions: string;
  issue_description: string;  // For callbacks
}

export interface JobVisitCompletionData {
  actual_hours: string;
  labor_cost: string;
  completion_notes: string;
  resolution_notes: string;  // For callbacks
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  scheduled: 'Scheduled',
  continuation: 'Continuation',
  callback: 'Callback',
  rework: 'Rework',
  punch_list: 'Punch List',
  inspection: 'Inspection',
};

export const VISIT_TYPE_COLORS: Record<VisitType, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  continuation: 'bg-blue-100 text-blue-700',
  callback: 'bg-amber-100 text-amber-700',
  rework: 'bg-red-100 text-red-700',
  punch_list: 'bg-purple-100 text-purple-700',
  inspection: 'bg-gray-100 text-gray-700',
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: 'Scheduled',
  en_route: 'En Route',
  on_site: 'On Site',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

export const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  en_route: 'bg-cyan-100 text-cyan-700',
  on_site: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rescheduled: 'bg-purple-100 text-purple-700',
};

// Helper to check if visit is rework type
export const isReworkVisit = (visit: JobVisit): boolean => 
  visit.visit_type === 'callback' || visit.visit_type === 'rework';
```

### Project Enhancements

```typescript
// ============================================
// PROJECT ENHANCEMENTS
// ============================================

export type ProjectRelationshipType = 
  | 'warranty'    // Warranty repair work
  | 'callback'    // Callback/rework after close
  | 'phase_2'     // Phase 2 of multi-phase project
  | 'add_on'      // Customer added more work
  | 'related';    // General relationship

export type ProjectSource = 
  | 'request'        // Came through Request → Quote flow
  | 'direct_quote'   // Quote created without Request
  | 'direct_job'     // Job created without Quote
  | 'warranty'       // Warranty project
  | 'migration'      // Imported from legacy system
  | 'project_radar'; // AI-detected from messages

// Extended Project interface (add to existing)
export interface Project {
  // ... existing fields ...
  
  // Parent/child relationships
  parent_project_id: string | null;
  relationship_type: ProjectRelationshipType | null;
  
  // Source tracking
  source: ProjectSource;
  source_reference: string | null;
  
  // Computed warranty stats
  has_warranty_claims: boolean;
  warranty_cost_total: number;
  child_project_count: number;
  
  // Joined data
  parent_project?: Project;
  child_projects?: Project[];
}

export interface ProjectWithEntities extends Project {
  requests: ServiceRequest[];
  quotes: Quote[];
  jobs: JobWithVisits[];
  invoices: Invoice[];
}

// For creating warranty/related projects
export interface CreateWarrantyProjectData {
  parent_project_id: string;
  name: string;
  issue_description: string;
  is_chargeable: boolean;  // false = covered under warranty
}

export const PROJECT_SOURCE_LABELS: Record<ProjectSource, string> = {
  request: 'From Request',
  direct_quote: 'Direct Quote',
  direct_job: 'Direct Job',
  warranty: 'Warranty',
  migration: 'Imported',
  project_radar: 'Project Radar',
};

export const PROJECT_RELATIONSHIP_LABELS: Record<ProjectRelationshipType, string> = {
  warranty: 'Warranty',
  callback: 'Callback',
  phase_2: 'Phase 2',
  add_on: 'Add-On',
  related: 'Related',
};

export const PROJECT_RELATIONSHIP_COLORS: Record<ProjectRelationshipType, string> = {
  warranty: 'bg-amber-100 text-amber-700',
  callback: 'bg-red-100 text-red-700',
  phase_2: 'bg-blue-100 text-blue-700',
  add_on: 'bg-green-100 text-green-700',
  related: 'bg-gray-100 text-gray-700',
};
```

### Job Enhancements

```typescript
// ============================================
// JOB ENHANCEMENTS
// ============================================

// Extended Job interface with budget vs actual (add to existing)
export interface Job {
  // ... existing fields ...
  
  // Budget (from quote)
  budgeted_labor_hours: number | null;
  budgeted_labor_cost: number | null;
  budgeted_material_cost: number | null;
  budgeted_total_cost: number | null;
  
  // Actual (computed from visits + expenses)
  actual_labor_hours: number;
  actual_labor_cost: number;
  actual_material_cost: number;
  actual_total_cost: number;
  
  // Variance (budgeted - actual, negative = over budget)
  labor_hours_variance: number;
  labor_cost_variance: number;
  total_cost_variance: number;
  
  // Rework tracking
  has_rework: boolean;
  rework_visit_count: number;
  rework_labor_cost: number;
  
  // Visit count
  visit_count: number;
  
  // Profitability
  gross_profit: number;
  gross_margin_percent: number;
}

export interface JobWithVisits extends Job {
  visits: JobVisit[];
}

// Budget summary for UI display
export interface JobBudgetSummary {
  budgeted: {
    labor_hours: number;
    labor_cost: number;
    material_cost: number;
    total: number;
  };
  actual: {
    labor_hours: number;
    labor_cost: number;
    material_cost: number;
    total: number;
  };
  variance: {
    labor_hours: number;
    labor_cost: number;
    material_cost: number;
    total: number;
    is_over_budget: boolean;
    percent_variance: number;
  };
  rework: {
    has_rework: boolean;
    visit_count: number;
    labor_cost: number;
  };
}

// Helper to compute budget summary from job
export function computeJobBudgetSummary(job: Job): JobBudgetSummary {
  const budgeted_total = (job.budgeted_labor_cost || 0) + (job.budgeted_material_cost || 0);
  const actual_total = job.actual_labor_cost + job.actual_material_cost;
  const total_variance = budgeted_total - actual_total;
  
  return {
    budgeted: {
      labor_hours: job.budgeted_labor_hours || 0,
      labor_cost: job.budgeted_labor_cost || 0,
      material_cost: job.budgeted_material_cost || 0,
      total: budgeted_total,
    },
    actual: {
      labor_hours: job.actual_labor_hours,
      labor_cost: job.actual_labor_cost,
      material_cost: job.actual_material_cost,
      total: actual_total,
    },
    variance: {
      labor_hours: (job.budgeted_labor_hours || 0) - job.actual_labor_hours,
      labor_cost: (job.budgeted_labor_cost || 0) - job.actual_labor_cost,
      material_cost: (job.budgeted_material_cost || 0) - job.actual_material_cost,
      total: total_variance,
      is_over_budget: total_variance < 0,
      percent_variance: budgeted_total > 0 
        ? Math.round((total_variance / budgeted_total) * 100) 
        : 0,
    },
    rework: {
      has_rework: job.has_rework,
      visit_count: job.rework_visit_count,
      labor_cost: job.rework_labor_cost,
    },
  };
}
```

### True Profitability

```typescript
// ============================================
// PROFITABILITY CALCULATIONS
// ============================================

export interface ProjectProfitability {
  revenue: number;
  direct_cost: number;
  warranty_cost: number;
  gross_profit: number;
  true_profit: number;
  gross_margin_percent: number;
  true_margin_percent: number;
}

export interface CrewReworkStats {
  crew_id: string;
  crew_name: string;
  total_jobs: number;
  jobs_with_rework: number;
  rework_rate: number;
  total_rework_cost: number;
  total_rework_hours: number;
}
```

---

## Shared Component Props

### EntityHeader

```typescript
// ============================================
// SHARED COMPONENT PROPS
// ============================================

export type EntityType = 'request' | 'quote' | 'job' | 'invoice';

export interface EntityHeaderProps {
  entityType: EntityType;
  entityNumber?: string;
  status?: string;
  statusColor?: string;
  isNew: boolean;
  createdAt?: string;
  updatedAt?: string;
  
  // Breadcrumb/navigation
  projectId?: string;
  projectNumber?: string;
  clientName?: string;
  
  // Linked entities for reference
  linkedEntities?: {
    request?: { id: string; number: string };
    quote?: { id: string; number: string };
    job?: { id: string; number: string };
    project?: { id: string; number: string };
  };
  
  onNavigateToProject?: () => void;
  onNavigateToLinkedEntity?: (type: EntityType, id: string) => void;
}
```

### ClientPropertySection

```typescript
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ClientPropertySectionProps {
  // Client selection
  clientId?: string;
  onClientChange: (clientId: string) => void;
  
  // Property selection (for builder clients)
  communityId?: string;
  propertyId?: string;
  onCommunityChange?: (communityId: string) => void;
  onPropertyChange?: (propertyId: string) => void;
  
  // Address
  jobAddress?: Address;
  billingAddress?: Address;
  onJobAddressChange: (address: Address) => void;
  
  // Display options
  showBillingAddress?: boolean;  // true for invoices
  showCommunityProperty?: boolean;  // true for builder division
  
  // Editability
  readOnly?: boolean;
  clientReadOnly?: boolean;  // Can't change client after certain status
}
```

### LineItemsEditor

```typescript
export interface LineItem {
  id: string;
  sku_id?: string;
  sku_code?: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  
  // DFU-specific
  fence_type?: string;
  bom_line_item_id?: string;
  
  // Display
  sort_order: number;
}

export interface LineItemsEditorProps {
  items: LineItem[];
  onItemsChange: (items: LineItem[]) => void;
  
  // Options
  readOnly?: boolean;
  allowCustomItems?: boolean;
  showBOMLink?: boolean;  // DFU-specific: link to BOM Calculator
  maxItems?: number;
  
  // Tax
  taxRate?: number;
  onTaxRateChange?: (rate: number) => void;
  
  // Discount
  discountAmount?: number;
  discountPercent?: number;
  onDiscountChange?: (amount: number, percent: number) => void;
}
```

### TotalsDisplay

```typescript
export interface TotalsDisplayProps {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  
  // For invoices
  amountPaid?: number;
  balanceDue?: number;
  
  // For jobs with budget tracking
  budgetComparison?: {
    budgeted: number;
    actual: number;
    variance: number;
  };
  
  // Display options
  showBudgetComparison?: boolean;
  showPaymentSummary?: boolean;
  compact?: boolean;
}
```

### SchedulingSection (Job-specific)

```typescript
export interface SchedulingSectionProps {
  // Current values
  scheduledDate?: string;
  scheduledTime?: string;
  assignedCrewId?: string;
  estimatedDuration?: number;
  
  // Callbacks
  onScheduleChange: (data: {
    scheduledDate: string;
    scheduledTime?: string;
    assignedCrewId: string;
    estimatedDuration?: number;
  }) => void;
  
  // Options
  readOnly?: boolean;
  showCalendarPreview?: boolean;
  territoryId?: string;  // Filter crews by territory
}
```

### VisitsTimeline (Job-specific)

```typescript
export interface VisitsTimelineProps {
  jobId: string;
  visits: JobVisit[];
  
  // Actions
  onAddVisit: (type: VisitType) => void;
  onEditVisit: (visitId: string) => void;
  onCompleteVisit: (visitId: string) => void;
  onCancelVisit: (visitId: string) => void;
  
  // Options
  readOnly?: boolean;
  showBudgetImpact?: boolean;  // Show how visits affect budget
  expandedVisitId?: string;
}
```

### PaymentsSection (Invoice-specific)

```typescript
export interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface PaymentsSectionProps {
  invoiceTotal: number;
  amountPaid: number;
  balanceDue: number;
  payments: Payment[];
  
  // Actions
  onRecordPayment: () => void;
  onVoidPayment?: (paymentId: string) => void;
  
  // Options
  readOnly?: boolean;
  showPaymentHistory?: boolean;
}
```

### EntityActionBar

```typescript
export interface EntityAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
}

export interface EntityActionBarProps {
  entityType: EntityType;
  status: string;
  isNew: boolean;
  isDirty: boolean;  // Has unsaved changes
  
  // Primary actions based on status
  primaryAction?: EntityAction;
  secondaryActions?: EntityAction[];
  
  // Common actions
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  
  // Status-specific actions (computed from status)
  availableTransitions?: string[];
  
  // Options
  showDeleteButton?: boolean;
  saveLabel?: string;  // "Save Draft", "Update", etc.
  isSaving?: boolean;
}
```

---

## Hook Interfaces

### useJobVisits

```typescript
export interface UseJobVisitsReturn {
  visits: JobVisit[];
  isLoading: boolean;
  error: Error | null;
  
  // Mutations
  addVisit: (data: JobVisitFormData) => Promise<JobVisit>;
  updateVisit: (id: string, data: Partial<JobVisitFormData>) => Promise<JobVisit>;
  completeVisit: (id: string, data: JobVisitCompletionData) => Promise<JobVisit>;
  cancelVisit: (id: string, reason?: string) => Promise<void>;
  rescheduleVisit: (id: string, newDate: string, newCrewId?: string) => Promise<JobVisit>;
  
  // Computed
  totalVisits: number;
  completedVisits: number;
  reworkVisits: JobVisit[];
  totalActualHours: number;
  totalLaborCost: number;
}
```

### useProjectWithEntities

```typescript
export interface UseProjectWithEntitiesReturn {
  project: ProjectWithEntities | null;
  isLoading: boolean;
  error: Error | null;
  
  // Related data
  requests: ServiceRequest[];
  quotes: Quote[];
  jobs: JobWithVisits[];
  invoices: Invoice[];
  childProjects: Project[];
  
  // Profitability
  profitability: ProjectProfitability | null;
  
  // Actions
  createWarrantyProject: (data: CreateWarrantyProjectData) => Promise<Project>;
  updateProjectStatus: (status: ProjectStatus) => Promise<void>;
}
```

---

## Form Validation Schemas (Zod)

```typescript
import { z } from 'zod';

// Job Visit Form
export const jobVisitFormSchema = z.object({
  visit_type: z.enum(['scheduled', 'continuation', 'callback', 'rework', 'punch_list', 'inspection']),
  scheduled_date: z.string().min(1, 'Date is required'),
  scheduled_time: z.string().optional(),
  assigned_crew_id: z.string().min(1, 'Crew is required'),
  estimated_hours: z.string().transform(v => parseFloat(v) || 0),
  instructions: z.string().optional(),
  issue_description: z.string().optional(),
}).refine(
  (data) => {
    // Issue description required for callbacks/rework
    if (['callback', 'rework'].includes(data.visit_type)) {
      return !!data.issue_description && data.issue_description.length > 0;
    }
    return true;
  },
  {
    message: 'Issue description is required for callbacks and rework',
    path: ['issue_description'],
  }
);

// Visit Completion Form
export const visitCompletionSchema = z.object({
  actual_hours: z.string().transform(v => parseFloat(v) || 0),
  labor_cost: z.string().transform(v => parseFloat(v) || 0).optional(),
  completion_notes: z.string().optional(),
  resolution_notes: z.string().optional(),
});

// Warranty Project Form
export const warrantyProjectSchema = z.object({
  parent_project_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  issue_description: z.string().min(1, 'Issue description is required'),
  is_chargeable: z.boolean().default(false),
});
```

---

## END OF TYPESCRIPT INTERFACES
