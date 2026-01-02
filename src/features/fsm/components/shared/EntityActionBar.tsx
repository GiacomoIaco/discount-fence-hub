/**
 * EntityActionBar - Consistent action buttons for FSM entities
 *
 * Provides standardized button styles:
 * - Primary: Filled button for main action
 * - Secondary: Outlined button
 * - Danger: Red button for destructive actions
 */

import { type LucideIcon } from 'lucide-react';

export type ActionVariant = 'primary' | 'secondary' | 'danger' | 'success';

export interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Tooltip text */
  title?: string;
}

interface EntityActionBarProps {
  actions: ActionButton[];
  /** Render actions vertically in a column */
  vertical?: boolean;
}

const variantStyles: Record<ActionVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  secondary: 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
  danger: 'border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50',
  success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300',
};

export function EntityActionBar({ actions, vertical = false }: EntityActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-wrap'} gap-2`}>
      {actions.map((action, index) => {
        const Icon = action.icon;
        const variant = action.variant || 'secondary';

        return (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            title={action.title}
            className={`
              flex items-center justify-center gap-2 px-4 py-2 rounded-lg
              font-medium transition-colors
              ${variantStyles[variant]}
              ${action.loading ? 'cursor-wait' : ''}
            `}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {action.loading ? 'Loading...' : action.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pre-configured action button factories for common patterns
 */
export const ActionButtons = {
  edit: (onClick: () => void, disabled = false): ActionButton => ({
    label: 'Edit',
    onClick,
    variant: 'secondary',
    disabled,
  }),

  send: (onClick: () => void, label = 'Send', disabled = false): ActionButton => ({
    label,
    onClick,
    variant: 'primary',
    disabled,
  }),

  schedule: (onClick: () => void, disabled = false): ActionButton => ({
    label: 'Schedule',
    onClick,
    variant: 'primary',
    disabled,
  }),

  complete: (onClick: () => void, loading = false): ActionButton => ({
    label: 'Complete',
    onClick,
    variant: 'success',
    loading,
  }),

  approve: (onClick: () => void, loading = false): ActionButton => ({
    label: 'Approve',
    onClick,
    variant: 'success',
    loading,
  }),

  reject: (onClick: () => void, label = 'Mark Lost'): ActionButton => ({
    label,
    onClick,
    variant: 'danger',
  }),

  convert: (onClick: () => void, label = 'Convert', loading = false): ActionButton => ({
    label,
    onClick,
    variant: 'success',
    loading,
  }),

  navigate: (onClick: () => void, label: string): ActionButton => ({
    label,
    onClick,
    variant: 'secondary',
  }),

  recordPayment: (onClick: () => void, disabled = false): ActionButton => ({
    label: 'Record Payment',
    onClick,
    variant: 'success',
    disabled,
  }),

  createInvoice: (onClick: () => void, loading = false): ActionButton => ({
    label: 'Create Invoice',
    onClick,
    variant: 'primary',
    loading,
  }),
};

export default EntityActionBar;
