/**
 * computeProjectStage - Derives the actual pipeline stage from project data
 *
 * Instead of relying on the simple "active/complete" status, this computes
 * where the project actually is in the FSM lifecycle:
 *
 * NEW → QUOTING → WON → SCHEDULED → WORKING → WORK DONE → INVOICED → PAID → COMPLETE
 *
 * Each stage is derived from the actual data (quotes, jobs, invoices, payments).
 */

import type { Project } from '../types';

export type PipelineStageId =
  | 'new'
  | 'quoting'
  | 'won'
  | 'scheduled'
  | 'working'
  | 'work_done'
  | 'invoiced'
  | 'paid'
  | 'complete'
  | 'on_hold'
  | 'cancelled'
  | 'warranty';

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  shortLabel: string;
  description: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  order: number;
}

/**
 * All possible pipeline stages with their display configuration
 */
export const PIPELINE_STAGES: Record<PipelineStageId, PipelineStage> = {
  new: {
    id: 'new',
    label: 'New',
    shortLabel: 'New',
    description: 'Project created, no quotes yet',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
    borderClass: 'border-gray-300',
    order: 1,
  },
  quoting: {
    id: 'quoting',
    label: 'Quoting',
    shortLabel: 'Quote',
    description: 'Quote(s) sent, awaiting approval',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
    order: 2,
  },
  won: {
    id: 'won',
    label: 'Won',
    shortLabel: 'Won',
    description: 'Quote accepted, ready to schedule',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700',
    borderClass: 'border-green-300',
    order: 3,
  },
  scheduled: {
    id: 'scheduled',
    label: 'Scheduled',
    shortLabel: 'Sched',
    description: 'Job(s) scheduled, work not started',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-300',
    order: 4,
  },
  working: {
    id: 'working',
    label: 'In Progress',
    shortLabel: 'Work',
    description: 'Work is in progress',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-300',
    order: 5,
  },
  work_done: {
    id: 'work_done',
    label: 'Work Done',
    shortLabel: 'Done',
    description: 'All work complete, ready to invoice',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-300',
    order: 6,
  },
  invoiced: {
    id: 'invoiced',
    label: 'Invoiced',
    shortLabel: 'Inv',
    description: 'Invoice sent, awaiting payment',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-300',
    order: 7,
  },
  paid: {
    id: 'paid',
    label: 'Paid',
    shortLabel: 'Paid',
    description: 'Fully paid',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    order: 8,
  },
  complete: {
    id: 'complete',
    label: 'Complete',
    shortLabel: 'Done',
    description: 'Project closed and archived',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-300',
    order: 9,
  },
  on_hold: {
    id: 'on_hold',
    label: 'On Hold',
    shortLabel: 'Hold',
    description: 'Project paused',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
    order: 0,
  },
  cancelled: {
    id: 'cancelled',
    label: 'Cancelled',
    shortLabel: 'Cancel',
    description: 'Project cancelled',
    bgClass: 'bg-red-50',
    textClass: 'text-red-600',
    borderClass: 'border-red-200',
    order: 0,
  },
  warranty: {
    id: 'warranty',
    label: 'Warranty',
    shortLabel: 'Warranty',
    description: 'Warranty work in progress',
    bgClass: 'bg-purple-100',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-300',
    order: 10,
  },
};

/**
 * Project with optional view fields from v_projects_full
 */
interface ProjectWithViewFields extends Project {
  cnt_quotes?: number;
  cnt_jobs?: number;
  cnt_active_jobs?: number;
  cnt_invoices?: number;
  cnt_unpaid_invoices?: number;
  sum_invoiced?: number;
  sum_paid?: number;
  sum_balance_due?: number;
  // accepted_quote_id is inherited from Project (string | null)
}

/**
 * Suggested next action for the project
 */
export interface NextAction {
  /** Short action verb (e.g., "Send Quote", "Schedule Job") */
  action: string;
  /** Longer description */
  description: string;
  /** Priority: high = needs attention, normal = routine */
  priority: 'high' | 'normal' | 'low';
  /** Icon hint for UI rendering */
  iconHint: 'send' | 'schedule' | 'create' | 'invoice' | 'collect' | 'complete' | 'followup' | 'none';
}

/**
 * Result of computing the project stage
 */
export interface ComputedStage {
  stage: PipelineStage;
  /** Additional context (e.g., "1 of 3 jobs done") */
  detail?: string;
  /** Progress percentage 0-100 for the current stage */
  progress?: number;
  /** True if there's an issue needing attention */
  hasWarning?: boolean;
  /** Warning message if applicable */
  warningMessage?: string;
  /** Suggested next action for the project */
  nextAction?: NextAction;
}

/**
 * Compute the pipeline stage for a project based on its actual data
 *
 * This examines quotes, jobs, invoices, and payments to determine
 * where the project actually is in the FSM lifecycle.
 *
 * @param project - Project data (preferably from v_projects_full)
 * @returns The computed stage with optional details
 */
export function computeProjectStage(project: ProjectWithViewFields): ComputedStage {
  // Check for status overrides first
  if (project.status === 'cancelled') {
    return { stage: PIPELINE_STAGES.cancelled };
  }
  if (project.status === 'on_hold') {
    return { stage: PIPELINE_STAGES.on_hold };
  }
  if (project.status === 'warranty') {
    return { stage: PIPELINE_STAGES.warranty };
  }
  if (project.status === 'complete') {
    return { stage: PIPELINE_STAGES.complete };
  }

  // Extract counts (handle both view fields and fallbacks)
  const quoteCount = project.cnt_quotes ?? project.quote_count ?? 0;
  const jobCount = project.cnt_jobs ?? project.job_count ?? 0;
  const activeJobCount = project.cnt_active_jobs ?? 0;
  const invoiceCount = project.cnt_invoices ?? project.invoice_count ?? 0;
  const unpaidInvoiceCount = project.cnt_unpaid_invoices ?? 0;
  const totalInvoiced = project.sum_invoiced ?? project.total_invoiced ?? 0;
  const totalPaid = project.sum_paid ?? project.total_paid ?? 0;
  const balanceDue = project.sum_balance_due ?? (totalInvoiced - totalPaid);
  const hasAcceptedQuote = !!project.accepted_quote_id;

  // Compute from most advanced stage backward

  // PAID: All invoices paid, balance = 0
  if (invoiceCount > 0 && unpaidInvoiceCount === 0 && balanceDue <= 0) {
    return {
      stage: PIPELINE_STAGES.paid,
      detail: `$${totalPaid.toLocaleString()} collected`,
      nextAction: {
        action: 'Close Project',
        description: 'Mark project as complete',
        priority: 'low',
        iconHint: 'complete',
      },
    };
  }

  // INVOICED: Has invoices with unpaid balance
  if (invoiceCount > 0 && (unpaidInvoiceCount > 0 || balanceDue > 0)) {
    const paidPercent = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;
    const hasWarning = balanceDue > 0 && paidPercent < 50;
    return {
      stage: PIPELINE_STAGES.invoiced,
      detail: paidPercent > 0 ? `${paidPercent}% paid` : `$${balanceDue.toLocaleString()} due`,
      progress: paidPercent,
      hasWarning,
      warningMessage: hasWarning ? 'Awaiting significant payment' : undefined,
      nextAction: {
        action: 'Collect Payment',
        description: `$${balanceDue.toLocaleString()} outstanding`,
        priority: hasWarning ? 'high' : 'normal',
        iconHint: 'collect',
      },
    };
  }

  // WORK DONE: All jobs complete (no active jobs), no invoices yet
  if (jobCount > 0 && activeJobCount === 0 && invoiceCount === 0) {
    return {
      stage: PIPELINE_STAGES.work_done,
      detail: `${jobCount} job${jobCount > 1 ? 's' : ''} complete`,
      hasWarning: true,
      warningMessage: 'Ready to invoice',
      nextAction: {
        action: 'Create Invoice',
        description: 'Work complete, ready to bill',
        priority: 'high',
        iconHint: 'invoice',
      },
    };
  }

  // WORKING: Has active jobs (in progress)
  if (jobCount > 0 && activeJobCount > 0) {
    const completedJobs = jobCount - activeJobCount;
    const progress = jobCount > 0 ? Math.round((completedJobs / jobCount) * 100) : 0;
    return {
      stage: PIPELINE_STAGES.working,
      detail: completedJobs > 0 ? `${completedJobs}/${jobCount} done` : `${activeJobCount} active`,
      progress,
      nextAction: {
        action: 'Monitor Progress',
        description: `${activeJobCount} job${activeJobCount > 1 ? 's' : ''} in progress`,
        priority: 'normal',
        iconHint: 'none',
      },
    };
  }

  // SCHEDULED: Has jobs but none active yet (they haven't started)
  // Note: We don't have visibility into scheduled_date from the view,
  // so any job that exists but isn't "active" is considered scheduled
  if (jobCount > 0) {
    return {
      stage: PIPELINE_STAGES.scheduled,
      detail: `${jobCount} job${jobCount > 1 ? 's' : ''}`,
      nextAction: {
        action: 'Prepare Materials',
        description: 'Jobs scheduled, prep for work',
        priority: 'normal',
        iconHint: 'none',
      },
    };
  }

  // WON: Quote accepted but no jobs yet
  if (hasAcceptedQuote && jobCount === 0) {
    return {
      stage: PIPELINE_STAGES.won,
      detail: 'Ready to schedule',
      hasWarning: true,
      warningMessage: 'Create job to continue',
      nextAction: {
        action: 'Create Job',
        description: 'Quote accepted, schedule work',
        priority: 'high',
        iconHint: 'create',
      },
    };
  }

  // QUOTING: Has quotes but none accepted
  if (quoteCount > 0 && !hasAcceptedQuote) {
    return {
      stage: PIPELINE_STAGES.quoting,
      detail: `${quoteCount} quote${quoteCount > 1 ? 's' : ''} pending`,
      nextAction: {
        action: 'Follow Up',
        description: 'Quote sent, awaiting approval',
        priority: 'normal',
        iconHint: 'followup',
      },
    };
  }

  // NEW: Nothing yet
  return {
    stage: PIPELINE_STAGES.new,
    detail: 'No quotes',
    nextAction: {
      action: 'Create Quote',
      description: 'No quotes yet',
      priority: 'high',
      iconHint: 'create',
    },
  };
}

/**
 * Get a simple badge display for a project stage
 */
export function getStageBadgeClasses(stageId: PipelineStageId): string {
  const stage = PIPELINE_STAGES[stageId];
  return `${stage.bgClass} ${stage.textClass}`;
}

/**
 * Sort projects by their pipeline stage (most advanced first by default)
 */
export function sortByPipelineStage(
  projects: ProjectWithViewFields[],
  ascending = false
): ProjectWithViewFields[] {
  return [...projects].sort((a, b) => {
    const stageA = computeProjectStage(a).stage.order;
    const stageB = computeProjectStage(b).stage.order;
    return ascending ? stageA - stageB : stageB - stageA;
  });
}

export default computeProjectStage;
