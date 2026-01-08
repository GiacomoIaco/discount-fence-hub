/**
 * ProjectPipelineProgress - Shows overall project progress through lifecycle stages
 *
 * Displays 4 stages: Quote → Job → Invoice → Paid
 * Each stage is derived from aggregate project data, not individual entity status.
 *
 * Features:
 * - Hover tooltips with detailed breakdown
 * - Warning states for items needing attention
 * - Sub-status awareness (e.g., "1 complete, 1 in-progress")
 *
 * Used in:
 * - UnifiedProjectHeader
 * - ProjectDetailPage (full mode)
 */

import { useState } from 'react';
import { FileText, Wrench, Receipt, CreditCard, Check, Circle, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ProjectPipelineData {
  // Quote stage
  quoteCount: number;
  acceptedQuoteId?: string | null;
  pendingQuoteCount?: number;
  // Job stage
  jobCount: number;
  activeJobCount: number; // Jobs not completed/cancelled
  completedJobCount?: number;
  scheduledJobCount?: number;
  unscheduledJobCount?: number;
  // Invoice stage
  invoiceCount: number;
  unpaidInvoiceCount: number;
  pastDueInvoiceCount?: number;
  // Payment stage
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
}

type StageStatus = 'pending' | 'in_progress' | 'completed' | 'warning';

interface PipelineStage {
  id: string;
  label: string;
  icon: ReactNode;
  status: StageStatus;
  detail?: string;
  /** Detailed tooltip text shown on hover */
  tooltipLines?: string[];
  /** True if this stage needs attention */
  hasWarning?: boolean;
}

function getStageStatus(data: ProjectPipelineData): PipelineStage[] {
  // Quote stage
  const quoteStatus: StageStatus =
    data.acceptedQuoteId ? 'completed' :
    data.quoteCount > 0 ? 'in_progress' : 'pending';

  const quoteDetail = data.acceptedQuoteId
    ? 'Accepted'
    : data.quoteCount > 0
      ? `${data.quoteCount} quote${data.quoteCount > 1 ? 's' : ''}`
      : undefined;

  // Quote tooltip breakdown
  const quoteTooltip: string[] = [];
  if (data.quoteCount > 0) {
    if (data.acceptedQuoteId) {
      quoteTooltip.push(`${data.quoteCount} quotes (1 accepted${data.pendingQuoteCount ? `, ${data.pendingQuoteCount} pending` : ''})`);
    } else {
      quoteTooltip.push(`${data.quoteCount} quote${data.quoteCount > 1 ? 's' : ''} pending approval`);
    }
  }

  // Job stage - completed when all jobs are done (no active jobs)
  const completedJobs = data.completedJobCount ?? (data.jobCount - data.activeJobCount);
  const scheduledJobs = data.scheduledJobCount ?? 0;
  const unscheduledJobs = data.unscheduledJobCount ?? (data.activeJobCount - scheduledJobs);

  const jobStatus: StageStatus =
    data.jobCount > 0 && data.activeJobCount === 0 ? 'completed' :
    data.jobCount > 0 ? 'in_progress' : 'pending';

  const jobDetail = data.jobCount > 0
    ? data.activeJobCount === 0
      ? `${data.jobCount} done`
      : `${completedJobs}/${data.jobCount}`
    : undefined;

  // Job tooltip breakdown
  const jobTooltip: string[] = [];
  if (data.jobCount > 0) {
    const parts: string[] = [];
    if (completedJobs > 0) parts.push(`${completedJobs} complete`);
    if (scheduledJobs > 0) parts.push(`${scheduledJobs} scheduled`);
    if (unscheduledJobs > 0) parts.push(`${unscheduledJobs} not scheduled`);
    jobTooltip.push(parts.join(', '));
  }

  // Invoice stage - completed when all invoices paid
  const hasPastDue = (data.pastDueInvoiceCount ?? 0) > 0;
  const invoiceStatus: StageStatus =
    hasPastDue ? 'warning' :
    data.invoiceCount > 0 && data.unpaidInvoiceCount === 0 && data.balanceDue === 0 ? 'completed' :
    data.invoiceCount > 0 ? 'in_progress' : 'pending';

  const invoiceDetail = data.invoiceCount > 0
    ? hasPastDue
      ? `${data.pastDueInvoiceCount} past due`
      : data.unpaidInvoiceCount > 0
        ? `${data.unpaidInvoiceCount} unpaid`
        : 'Paid'
    : undefined;

  // Invoice tooltip breakdown
  const invoiceTooltip: string[] = [];
  if (data.invoiceCount > 0) {
    const paidCount = data.invoiceCount - data.unpaidInvoiceCount;
    const parts: string[] = [];
    if (paidCount > 0) parts.push(`${paidCount} paid`);
    if (data.pastDueInvoiceCount && data.pastDueInvoiceCount > 0) {
      parts.push(`${data.pastDueInvoiceCount} past due`);
    } else if (data.unpaidInvoiceCount > 0) {
      parts.push(`${data.unpaidInvoiceCount} unpaid`);
    }
    invoiceTooltip.push(parts.join(', '));
  }

  // Paid stage - completed when balance is 0 and there are invoices
  const paidStatus: StageStatus =
    data.invoiceCount > 0 && data.balanceDue === 0 ? 'completed' :
    data.totalPaid > 0 ? 'in_progress' : 'pending';

  const paidPercent = data.totalInvoiced > 0
    ? Math.round((data.totalPaid / data.totalInvoiced) * 100)
    : 0;

  const paidDetail = data.totalPaid > 0
    ? data.balanceDue === 0
      ? 'Complete'
      : `$${Math.round(data.totalPaid / 1000)}K/${Math.round(data.totalInvoiced / 1000)}K`
    : undefined;

  // Paid tooltip breakdown
  const paidTooltip: string[] = [];
  if (data.totalInvoiced > 0) {
    paidTooltip.push(`${paidPercent}% collected`);
    if (data.balanceDue > 0) {
      paidTooltip.push(`$${data.balanceDue.toLocaleString()} balance`);
    }
  }

  return [
    {
      id: 'quote',
      label: 'Quote',
      icon: <FileText className="w-4 h-4" />,
      status: quoteStatus,
      detail: quoteDetail,
      tooltipLines: quoteTooltip,
    },
    {
      id: 'job',
      label: 'Jobs',
      icon: <Wrench className="w-4 h-4" />,
      status: jobStatus,
      detail: jobDetail,
      tooltipLines: jobTooltip,
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: <Receipt className="w-4 h-4" />,
      status: invoiceStatus,
      detail: invoiceDetail,
      tooltipLines: invoiceTooltip,
      hasWarning: hasPastDue,
    },
    {
      id: 'paid',
      label: 'Paid',
      icon: <CreditCard className="w-4 h-4" />,
      status: paidStatus,
      detail: paidDetail,
      tooltipLines: paidTooltip,
    },
  ];
}

interface ProjectPipelineProgressProps {
  data: ProjectPipelineData;
  /** Compact mode for header display */
  compact?: boolean;
  /** Dark mode for use in dark headers */
  darkMode?: boolean;
  /** Show detailed text below each stage */
  showDetails?: boolean;
  /** Callback when clicking a stage */
  onStageClick?: (stageId: string) => void;
}

/**
 * ProjectPipelineProgress shows the overall project lifecycle status
 *
 * Usage:
 * ```tsx
 * <ProjectPipelineProgress
 *   data={{
 *     quoteCount: 2,
 *     acceptedQuoteId: 'abc123',
 *     jobCount: 1,
 *     activeJobCount: 1,
 *     invoiceCount: 0,
 *     unpaidInvoiceCount: 0,
 *     totalInvoiced: 0,
 *     totalPaid: 0,
 *     balanceDue: 0,
 *   }}
 *   compact
 *   darkMode
 * />
 * ```
 */
export function ProjectPipelineProgress({
  data,
  compact = false,
  darkMode = false,
  showDetails = true,
  onStageClick,
}: ProjectPipelineProgressProps) {
  const stages = getStageStatus(data);

  // Track which stage is being hovered for tooltip
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  // Color classes based on status and mode
  const getStageColors = (status: StageStatus) => {
    if (darkMode) {
      switch (status) {
        case 'completed':
          return 'bg-green-500/30 text-green-300 ring-green-400/50';
        case 'warning':
          return 'bg-amber-500/30 text-amber-300 ring-amber-400/50';
        case 'in_progress':
          return 'bg-blue-500/30 text-blue-300 ring-blue-400/50';
        case 'pending':
        default:
          return 'bg-white/10 text-slate-400';
      }
    } else {
      switch (status) {
        case 'completed':
          return 'bg-green-100 text-green-600';
        case 'warning':
          return 'bg-amber-100 text-amber-600 ring-2 ring-amber-500 ring-offset-1';
        case 'in_progress':
          return 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-1';
        case 'pending':
        default:
          return 'bg-gray-100 text-gray-400';
      }
    }
  };

  const getConnectorColor = (currentStatus: StageStatus, _nextStatus: StageStatus) => {
    if (currentStatus === 'completed') {
      return darkMode ? 'bg-green-400/50' : 'bg-green-300';
    }
    return darkMode ? 'bg-white/20' : 'bg-gray-200';
  };

  const getTextColor = (status: StageStatus) => {
    if (darkMode) {
      switch (status) {
        case 'completed':
          return 'text-green-300';
        case 'warning':
          return 'text-amber-300';
        case 'in_progress':
          return 'text-blue-300';
        default:
          return 'text-slate-500';
      }
    } else {
      switch (status) {
        case 'completed':
          return 'text-green-700';
        case 'warning':
          return 'text-amber-700';
        case 'in_progress':
          return 'text-blue-700';
        default:
          return 'text-gray-500';
      }
    }
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-center">
          {/* Stage indicator with tooltip */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredStage(stage.id)}
            onMouseLeave={() => setHoveredStage(null)}
          >
            <button
              type="button"
              onClick={() => onStageClick?.(stage.id)}
              disabled={!onStageClick}
              className={`
                flex flex-col items-center
                ${onStageClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                transition-opacity
              `}
            >
              <div
                className={`
                  flex items-center justify-center rounded-full relative
                  ${compact ? 'w-7 h-7' : 'w-9 h-9'}
                  ${getStageColors(stage.status)}
                `}
              >
                {stage.status === 'completed' ? (
                  <Check className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                ) : stage.status === 'warning' ? (
                  <AlertTriangle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                ) : stage.status === 'in_progress' ? (
                  stage.icon
                ) : (
                  <Circle className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                )}
                {/* Warning indicator dot */}
                {stage.hasWarning && stage.status !== 'warning' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Label + Detail */}
              <div className={`flex flex-col items-center ${compact ? 'mt-0.5' : 'mt-1'}`}>
                <span
                  className={`
                    font-medium leading-tight
                    ${compact ? 'text-[10px]' : 'text-xs'}
                    ${getTextColor(stage.status)}
                  `}
                >
                  {stage.label}
                </span>
                {showDetails && stage.detail && !compact && (
                  <span
                    className={`
                      text-[10px] leading-tight
                      ${darkMode ? 'text-slate-500' : 'text-gray-500'}
                    `}
                  >
                    {stage.detail}
                  </span>
                )}
              </div>
            </button>

            {/* Hover tooltip */}
            {hoveredStage === stage.id && stage.tooltipLines && stage.tooltipLines.length > 0 && (
              <div
                className={`
                  absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                  px-3 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap
                  ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-gray-900 text-white'}
                `}
              >
                {stage.tooltipLines.map((line, i) => (
                  <div key={i} className="leading-relaxed">{line}</div>
                ))}
                {/* Tooltip arrow */}
                <div
                  className={`
                    absolute top-full left-1/2 -translate-x-1/2
                    border-4 border-transparent
                    ${darkMode ? 'border-t-slate-800' : 'border-t-gray-900'}
                  `}
                />
              </div>
            )}
          </div>

          {/* Connector line (not after last stage) */}
          {index < stages.length - 1 && (
            <div
              className={`
                ${compact ? 'w-4 mx-0.5' : 'w-8 mx-1'} h-0.5
                ${getConnectorColor(stage.status, stages[index + 1].status)}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Helper to extract pipeline data from v_projects_full
// =============================================================================

/**
 * Extract pipeline data from a project record (v_projects_full view)
 * Use with useProjectFull hook results
 */
export function extractPipelineData(project: {
  cnt_quotes?: number;
  accepted_quote_id?: string | null;
  cnt_jobs?: number;
  cnt_active_jobs?: number;
  cnt_invoices?: number;
  cnt_unpaid_invoices?: number;
  sum_invoiced?: number;
  total_invoiced?: number;
  sum_paid?: number;
  total_paid?: number;
  sum_balance_due?: number;
  // Fallback fields from Project type
  acceptedQuoteId?: string | null;
}): ProjectPipelineData {
  return {
    quoteCount: project.cnt_quotes ?? 0,
    acceptedQuoteId: project.accepted_quote_id ?? project.acceptedQuoteId ?? null,
    jobCount: project.cnt_jobs ?? 0,
    activeJobCount: project.cnt_active_jobs ?? 0,
    invoiceCount: project.cnt_invoices ?? 0,
    unpaidInvoiceCount: project.cnt_unpaid_invoices ?? 0,
    totalInvoiced: project.sum_invoiced ?? project.total_invoiced ?? 0,
    totalPaid: project.sum_paid ?? project.total_paid ?? 0,
    balanceDue: project.sum_balance_due ?? 0,
  };
}

export default ProjectPipelineProgress;
