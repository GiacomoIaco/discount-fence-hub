/**
 * JobBudgetSection - Budget vs Actual display for JobCard
 *
 * Shows:
 * - Budgeted vs Actual costs (labor, material, total)
 * - Variance indicators (over/under budget)
 * - Profit margin
 * - Rework indicator if applicable
 */

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import type { JobBudgetSectionProps } from './types';

interface VarianceDisplayProps {
  label: string;
  budgeted: number;
  actual: number;
  variance: number;
  unit?: string;
  isCurrency?: boolean;
}

function VarianceDisplay({
  label,
  budgeted,
  actual,
  variance,
  unit = '',
  isCurrency = true,
}: VarianceDisplayProps) {
  const isOverBudget = variance > 0;
  const isUnderBudget = variance < 0;

  const formatValue = (value: number) => {
    if (isCurrency) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `${value}${unit}`;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* Budgeted */}
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Budgeted</div>
          <div className="text-sm font-semibold text-gray-700">
            {formatValue(budgeted)}
          </div>
        </div>

        {/* Actual */}
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Actual</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatValue(actual)}
          </div>
        </div>

        {/* Variance */}
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Variance</div>
          <div
            className={`text-sm font-semibold flex items-center gap-1 ${
              isOverBudget
                ? 'text-red-600'
                : isUnderBudget
                ? 'text-green-600'
                : 'text-gray-600'
            }`}
          >
            {isOverBudget && <TrendingUp className="w-3.5 h-3.5" />}
            {isUnderBudget && <TrendingDown className="w-3.5 h-3.5" />}
            {isOverBudget && '+'}
            {formatValue(variance)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobBudgetSection({
  totals,
  hasRework,
  reworkReason,
  reworkCost,
}: JobBudgetSectionProps) {
  const {
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
  } = totals;

  // Determine overall budget status
  const isOverBudget = totalCostVariance > 0;
  const budgetStatus = isOverBudget ? 'over' : totalCostVariance < 0 ? 'under' : 'on';

  return (
    <div className="bg-white rounded-xl border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          Budget vs Actual
        </h2>

        {/* Budget Status Badge */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            budgetStatus === 'over'
              ? 'bg-red-100 text-red-700'
              : budgetStatus === 'under'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {budgetStatus === 'over' && 'Over Budget'}
          {budgetStatus === 'under' && 'Under Budget'}
          {budgetStatus === 'on' && 'On Budget'}
        </div>
      </div>

      {/* Rework Warning */}
      {hasRework && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">
              This job has rework costs
            </p>
            {reworkReason && (
              <p className="text-xs text-red-600 mt-0.5">{reworkReason}</p>
            )}
            {reworkCost !== undefined && reworkCost > 0 && (
              <p className="text-sm text-red-700 mt-1">
                Rework cost: ${reworkCost.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Variance Grid */}
      <div className="space-y-3">
        {/* Labor Hours */}
        <VarianceDisplay
          label="Labor Hours"
          budgeted={budgetedLaborHours}
          actual={actualLaborHours}
          variance={laborHoursVariance}
          unit="h"
          isCurrency={false}
        />

        {/* Labor Cost */}
        <VarianceDisplay
          label="Labor Cost"
          budgeted={budgetedLaborCost}
          actual={actualLaborCost}
          variance={laborCostVariance}
        />

        {/* Material Cost */}
        <VarianceDisplay
          label="Material Cost"
          budgeted={budgetedMaterialCost}
          actual={actualMaterialCost}
          variance={materialCostVariance}
        />

        {/* Total Cost */}
        <div
          className={`rounded-lg p-4 ${
            isOverBudget
              ? 'bg-red-50 border border-red-200'
              : 'bg-gray-100'
          }`}
        >
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Total Cost
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Budgeted</div>
              <div className="text-base font-semibold text-gray-700">
                ${budgetedTotalCost.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Actual</div>
              <div className="text-base font-bold text-gray-900">
                ${actualTotalCost.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Variance</div>
              <div
                className={`text-base font-bold flex items-center gap-1 ${
                  isOverBudget
                    ? 'text-red-600'
                    : totalCostVariance < 0
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                {totalCostVariance > 0 && <TrendingUp className="w-4 h-4" />}
                {totalCostVariance < 0 && <TrendingDown className="w-4 h-4" />}
                {totalCostVariance > 0 && '+'}
                ${Math.abs(totalCostVariance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Summary */}
      <div className="mt-4 pt-4 border-t">
        <div className="grid grid-cols-3 gap-4">
          {/* Quoted Total */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Quoted Total</div>
            <div className="text-lg font-bold text-gray-900">
              ${quotedTotal.toLocaleString()}
            </div>
          </div>

          {/* Profit Margin */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Gross Profit</div>
            <div
              className={`text-lg font-bold ${
                profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              ${Math.abs(profitMargin).toLocaleString()}
            </div>
          </div>

          {/* Margin Percent */}
          <div>
            <div className="text-xs text-gray-400 mb-1">Margin %</div>
            <div
              className={`text-lg font-bold ${
                profitMarginPercent >= 15
                  ? 'text-green-600'
                  : profitMarginPercent >= 0
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              {profitMarginPercent.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Low margin warning */}
        {profitMarginPercent < 15 && profitMarginPercent >= 0 && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Margin below 15% target</span>
          </div>
        )}

        {/* Negative margin warning */}
        {profitMarginPercent < 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Job is running at a loss</span>
          </div>
        )}
      </div>
    </div>
  );
}
