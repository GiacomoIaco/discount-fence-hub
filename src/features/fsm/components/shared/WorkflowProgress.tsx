/**
 * WorkflowProgress - Visual pipeline showing entity progression
 *
 * Used across all FSM entity types to show where an item is in its lifecycle.
 * Follows Jobber pattern: status is derived from actions, not manually set.
 */

import { CheckCircle, Circle } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  label: string;
  /** If true, this step is completed */
  completed: boolean;
  /** If true, this is the current/active step */
  current?: boolean;
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  /** Optional: Compact mode for smaller spaces */
  compact?: boolean;
}

/**
 * WorkflowProgress shows a horizontal pipeline of steps.
 *
 * Usage:
 * ```tsx
 * <WorkflowProgress steps={[
 *   { id: 'pending', label: 'Pending', completed: true },
 *   { id: 'sent', label: 'Sent', completed: true, current: true },
 *   { id: 'approved', label: 'Approved', completed: false },
 *   { id: 'converted', label: 'Converted', completed: false },
 * ]} />
 * ```
 */
export function WorkflowProgress({ steps, compact = false }: WorkflowProgressProps) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-4'}`}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {/* Step indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`
                flex items-center justify-center rounded-full
                ${compact ? 'w-6 h-6' : 'w-8 h-8'}
                ${step.completed
                  ? 'bg-green-100 text-green-600'
                  : step.current
                    ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-2'
                    : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              {step.completed ? (
                <CheckCircle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              ) : (
                <Circle className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
              )}
            </div>
            <span
              className={`
                mt-1 text-center leading-tight
                ${compact ? 'text-xs max-w-16' : 'text-xs max-w-20'}
                ${step.completed
                  ? 'text-green-700 font-medium'
                  : step.current
                    ? 'text-blue-700 font-medium'
                    : 'text-gray-500'
                }
              `}
            >
              {step.label}
            </span>
          </div>

          {/* Connector line (not after last step) */}
          {index < steps.length - 1 && (
            <div
              className={`
                ${compact ? 'w-8 mx-1' : 'w-12 mx-2'} h-0.5
                ${step.completed ? 'bg-green-300' : 'bg-gray-200'}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Pre-configured workflow progress helpers for each entity type
// =============================================================================

interface RequestProgressProps {
  /** Current status - used for future enhancements */
  status?: string;
  requiresAssessment?: boolean;
  assessmentScheduledAt?: string | null;
  assessmentCompletedAt?: string | null;
  convertedToQuoteId?: string | null;
  convertedToJobId?: string | null;
  compact?: boolean;
}

/**
 * Request workflow: Pending -> Assessment (optional) -> Converted
 */
export function RequestProgress({
  status: _status,
  requiresAssessment = true,
  assessmentScheduledAt,
  assessmentCompletedAt,
  convertedToQuoteId,
  convertedToJobId,
  compact = false,
}: RequestProgressProps) {
  const isConverted = !!(convertedToQuoteId || convertedToJobId);

  // If no assessment required, skip that step
  const steps: WorkflowStep[] = requiresAssessment
    ? [
        {
          id: 'pending',
          label: 'Pending',
          completed: true, // Always completed once created
        },
        {
          id: 'scheduled',
          label: 'Scheduled',
          completed: !!assessmentScheduledAt,
          current: !!assessmentScheduledAt && !assessmentCompletedAt && !isConverted,
        },
        {
          id: 'assessed',
          label: 'Assessed',
          completed: !!assessmentCompletedAt,
          current: !!assessmentCompletedAt && !isConverted,
        },
        {
          id: 'converted',
          label: 'Converted',
          completed: isConverted,
          current: isConverted,
        },
      ]
    : [
        {
          id: 'pending',
          label: 'Pending',
          completed: true,
          current: !isConverted,
        },
        {
          id: 'converted',
          label: 'Converted',
          completed: isConverted,
          current: isConverted,
        },
      ];

  return <WorkflowProgress steps={steps} compact={compact} />;
}

interface QuoteProgressProps {
  /** Current status - used for determining lost state */
  status: string;
  sentAt?: string | null;
  approvedAt?: string | null;
  convertedToJobId?: string | null;
  compact?: boolean;
}

/**
 * Quote workflow: Draft -> Sent -> Accepted -> Converted
 * Note: "Sent" = awaiting_response status, "Accepted" = client accepted
 */
export function QuoteProgress({
  status,
  sentAt,
  approvedAt,  // This is client_accepted_at (renamed from client_approved_at)
  convertedToJobId,
  compact = false,
}: QuoteProgressProps) {
  const isLost = status === 'lost';
  const isExpired = status === 'expired';
  const isConverted = !!convertedToJobId || status === 'converted';
  const isTerminal = isLost || isExpired;

  const steps: WorkflowStep[] = [
    {
      id: 'draft',
      label: 'Draft',
      completed: true, // Always completed once created
    },
    {
      id: 'sent',
      label: 'Sent',
      completed: !!sentAt && !isTerminal,
      current: !!sentAt && !approvedAt && !isConverted && !isTerminal,
    },
    {
      id: 'accepted',
      label: 'Accepted',
      completed: !!approvedAt && !isTerminal,
      current: !!approvedAt && !isConverted && !isTerminal,
    },
    {
      id: 'converted',
      label: isLost ? 'Lost' : isExpired ? 'Expired' : 'Job Created',
      completed: isConverted || isTerminal,
      current: isConverted || isTerminal,
    },
  ];

  return <WorkflowProgress steps={steps} compact={compact} />;
}

interface JobProgressProps {
  /** Current status - used for future enhancements */
  status?: string;
  scheduledDate?: string | null;
  workStartedAt?: string | null;
  workCompletedAt?: string | null;
  compact?: boolean;
}

/**
 * Job workflow: Won -> Scheduled -> In Progress -> Completed
 */
export function JobProgress({
  status: _status,
  scheduledDate,
  workStartedAt,
  workCompletedAt,
  compact = false,
}: JobProgressProps) {
  const steps: WorkflowStep[] = [
    {
      id: 'won',
      label: 'Won',
      completed: true, // Always completed once job exists
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      completed: !!scheduledDate,
      current: !!scheduledDate && !workStartedAt,
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      completed: !!workStartedAt,
      current: !!workStartedAt && !workCompletedAt,
    },
    {
      id: 'completed',
      label: 'Completed',
      completed: !!workCompletedAt,
      current: !!workCompletedAt,
    },
  ];

  return <WorkflowProgress steps={steps} compact={compact} />;
}

interface InvoiceProgressProps {
  /** Current status - used for future enhancements */
  status?: string;
  sentAt?: string | null;
  /** Balance due (0 means paid) */
  balanceDue?: number;
  compact?: boolean;
}

/**
 * Invoice workflow: Draft -> Sent -> Paid
 */
export function InvoiceProgress({
  status: _status,
  sentAt,
  balanceDue = 0,
  compact = false,
}: InvoiceProgressProps) {
  const isPaid = balanceDue === 0;

  const steps: WorkflowStep[] = [
    {
      id: 'draft',
      label: 'Draft',
      completed: true, // Always completed once created
    },
    {
      id: 'sent',
      label: 'Sent',
      completed: !!sentAt,
      current: !!sentAt && !isPaid,
    },
    {
      id: 'paid',
      label: 'Paid',
      completed: isPaid,
      current: isPaid,
    },
  ];

  return <WorkflowProgress steps={steps} compact={compact} />;
}

export default WorkflowProgress;
