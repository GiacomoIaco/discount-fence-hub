/**
 * BudgetActualDisplay - Job cost comparison
 *
 * Shows budgeted vs actual costs for labor, materials, and total.
 * Visual indicators for over/under budget.
 */

import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface BudgetActualDisplayProps {
  /** Labor hours and cost */
  labor?: {
    budgetedHours?: number;
    actualHours?: number;
    budgetedCost?: number;
    actualCost?: number;
  };
  /** Material cost */
  materials?: {
    budgeted?: number;
    actual?: number;
  };
  /** Total job cost */
  total?: {
    budgeted?: number;
    actual?: number;
  };
  /** Show variance as percentage */
  showPercentage?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Warning threshold as percentage (default 10%) */
  warningThreshold?: number;
  /** Whether job has rework */
  hasRework?: boolean;
}

const formatCurrency = (amount: number | undefined | null): string => {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatHours = (hours: number | undefined | null): string => {
  if (hours == null) return '-';
  return `${hours.toFixed(1)}h`;
};

const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

function CostComparisonRow({
  label,
  budgeted,
  actual,
  formatFn = formatCurrency,
  showPercentage = false,
  warningThreshold = 10,
}: {
  label: string;
  budgeted: number | undefined;
  actual: number | undefined;
  formatFn?: (v: number | undefined) => string;
  showPercentage?: boolean;
  warningThreshold?: number;
}) {
  if (budgeted === undefined && actual === undefined) return null;

  const variance = budgeted && actual ? ((actual - budgeted) / budgeted) * 100 : 0;
  const isOverBudget = variance > 0;
  const isSignificant = Math.abs(variance) > warningThreshold;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <div className="flex items-center gap-4">
        {/* Budgeted */}
        <div className="text-right w-20">
          <div className="text-xs text-gray-400">Budget</div>
          <div className="font-medium text-gray-700">{formatFn(budgeted)}</div>
        </div>

        {/* Actual */}
        <div className="text-right w-20">
          <div className="text-xs text-gray-400">Actual</div>
          <div className="font-medium text-gray-900">{formatFn(actual)}</div>
        </div>

        {/* Variance */}
        {showPercentage && budgeted && actual && (
          <div className="w-20 flex items-center justify-end gap-1">
            {isOverBudget ? (
              <TrendingUp className={`w-4 h-4 ${isSignificant ? 'text-red-500' : 'text-amber-500'}`} />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-500" />
            )}
            <span
              className={`text-sm font-medium ${
                isOverBudget
                  ? isSignificant
                    ? 'text-red-600'
                    : 'text-amber-600'
                  : 'text-green-600'
              }`}
            >
              {formatPercent(variance)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BudgetActualDisplay({
  labor,
  materials,
  total,
  showPercentage = true,
  compact = false,
  warningThreshold = 10,
  hasRework = false,
}: BudgetActualDisplayProps) {
  // Calculate overall status
  const totalBudget = total?.budgeted;
  const totalActual = total?.actual;
  const overallVariance =
    totalBudget && totalActual ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;
  const isOverBudget = overallVariance > 0;
  const isSignificant = Math.abs(overallVariance) > warningThreshold;

  return (
    <div className={`bg-white rounded-lg border ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : ''}`}>
          Budget vs Actual
        </h3>
        {totalBudget && totalActual && (
          <div className="flex items-center gap-2">
            {isOverBudget && isSignificant ? (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4" />
                Over Budget
              </span>
            ) : isOverBudget ? (
              <span className="flex items-center gap-1 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Slightly Over
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                On Track
              </span>
            )}
          </div>
        )}
      </div>

      {/* Rework Warning */}
      {hasRework && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium">Rework Required</span>
          </div>
        </div>
      )}

      {/* Cost Rows */}
      <div className="space-y-1">
        {labor?.budgetedHours !== undefined || labor?.actualHours !== undefined ? (
          <CostComparisonRow
            label="Labor Hours"
            budgeted={labor.budgetedHours}
            actual={labor.actualHours}
            formatFn={formatHours}
            showPercentage={showPercentage}
            warningThreshold={warningThreshold}
          />
        ) : null}

        {labor?.budgetedCost !== undefined || labor?.actualCost !== undefined ? (
          <CostComparisonRow
            label="Labor Cost"
            budgeted={labor.budgetedCost}
            actual={labor.actualCost}
            showPercentage={showPercentage}
            warningThreshold={warningThreshold}
          />
        ) : null}

        {materials?.budgeted !== undefined || materials?.actual !== undefined ? (
          <CostComparisonRow
            label="Materials"
            budgeted={materials.budgeted}
            actual={materials.actual}
            showPercentage={showPercentage}
            warningThreshold={warningThreshold}
          />
        ) : null}

        {total?.budgeted !== undefined || total?.actual !== undefined ? (
          <div className="pt-2 mt-2 border-t border-gray-200">
            <CostComparisonRow
              label="Total Cost"
              budgeted={total.budgeted}
              actual={total.actual}
              showPercentage={showPercentage}
              warningThreshold={warningThreshold}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Simple profit margin display
 */
export function ProfitMarginBadge({
  revenue,
  cost,
}: {
  revenue: number;
  cost: number;
}) {
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const isPositive = profit > 0;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
      <div className="text-center">
        <div className="text-xs text-gray-500">Profit</div>
        <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(profit)}
        </div>
      </div>
      <div className="w-px h-8 bg-gray-300" />
      <div className="text-center">
        <div className="text-xs text-gray-500">Margin</div>
        <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {margin.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

export default BudgetActualDisplay;
