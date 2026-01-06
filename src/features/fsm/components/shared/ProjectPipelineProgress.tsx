/**
 * ProjectPipelineProgress - Shows overall project progress through lifecycle stages
 *
 * Displays 4 stages: Quote → Job → Invoice → Paid
 * Each stage is derived from aggregate project data, not individual entity status.
 *
 * Used in:
 * - ProjectContextHeader (compact mode)
 * - ProjectDetailPage (full mode)
 */

import { FileText, Wrench, Receipt, CreditCard, Check, Circle } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ProjectPipelineData {
  // Quote stage
  quoteCount: number;
  acceptedQuoteId?: string | null;
  // Job stage
  jobCount: number;
  activeJobCount: number; // Jobs not completed/cancelled
  // Invoice stage
  invoiceCount: number;
  unpaidInvoiceCount: number;
  // Payment stage
  totalInvoiced: number;
  totalPaid: number;
  balanceDue: number;
}

type StageStatus = 'pending' | 'in_progress' | 'completed';

interface PipelineStage {
  id: string;
  label: string;
  icon: ReactNode;
  status: StageStatus;
  detail?: string;
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

  // Job stage - completed when all jobs are done (no active jobs)
  const jobStatus: StageStatus =
    data.jobCount > 0 && data.activeJobCount === 0 ? 'completed' :
    data.jobCount > 0 ? 'in_progress' : 'pending';

  const jobDetail = data.jobCount > 0
    ? data.activeJobCount === 0
      ? `${data.jobCount} done`
      : `${data.activeJobCount} active`
    : undefined;

  // Invoice stage - completed when all invoices sent
  const invoiceStatus: StageStatus =
    data.invoiceCount > 0 && data.unpaidInvoiceCount === 0 && data.balanceDue === 0 ? 'completed' :
    data.invoiceCount > 0 ? 'in_progress' : 'pending';

  const invoiceDetail = data.invoiceCount > 0
    ? data.unpaidInvoiceCount > 0
      ? `${data.unpaidInvoiceCount} unpaid`
      : 'Sent'
    : undefined;

  // Paid stage - completed when balance is 0 and there are invoices
  const paidStatus: StageStatus =
    data.invoiceCount > 0 && data.balanceDue === 0 ? 'completed' :
    data.totalPaid > 0 ? 'in_progress' : 'pending';

  const paidDetail = data.totalPaid > 0
    ? data.balanceDue === 0
      ? 'Complete'
      : `$${data.balanceDue.toLocaleString()} due`
    : undefined;

  return [
    {
      id: 'quote',
      label: 'Quote',
      icon: <FileText className="w-4 h-4" />,
      status: quoteStatus,
      detail: quoteDetail,
    },
    {
      id: 'job',
      label: 'Job',
      icon: <Wrench className="w-4 h-4" />,
      status: jobStatus,
      detail: jobDetail,
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: <Receipt className="w-4 h-4" />,
      status: invoiceStatus,
      detail: invoiceDetail,
    },
    {
      id: 'paid',
      label: 'Paid',
      icon: <CreditCard className="w-4 h-4" />,
      status: paidStatus,
      detail: paidDetail,
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

  // Color classes based on status and mode
  const getStageColors = (status: StageStatus) => {
    if (darkMode) {
      switch (status) {
        case 'completed':
          return 'bg-green-500/30 text-green-300 ring-green-400/50';
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
        case 'in_progress':
          return 'text-blue-300';
        default:
          return 'text-slate-500';
      }
    } else {
      switch (status) {
        case 'completed':
          return 'text-green-700';
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
          {/* Stage indicator */}
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
                flex items-center justify-center rounded-full
                ${compact ? 'w-7 h-7' : 'w-9 h-9'}
                ${getStageColors(stage.status)}
              `}
            >
              {stage.status === 'completed' ? (
                <Check className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              ) : stage.status === 'in_progress' ? (
                stage.icon
              ) : (
                <Circle className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
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
