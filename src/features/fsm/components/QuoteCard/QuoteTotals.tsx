/**
 * QuoteTotals - Totals display component
 *
 * Shows subtotal, discount, tax, and total.
 * Used as a summary at the bottom of the quote card.
 */

import type { QuoteTotals as QuoteTotalsType } from './types';

interface QuoteTotalsProps {
  totals: QuoteTotalsType;
  depositPercent: number;
  compact?: boolean;
}

export default function QuoteTotals({ totals, depositPercent, compact = false }: QuoteTotalsProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-end gap-6 text-sm">
        <span className="text-gray-500">Subtotal: ${totals.subtotal.toFixed(2)}</span>
        {totals.discountAmount > 0 && (
          <span className="text-green-600">-${totals.discountAmount.toFixed(2)} discount</span>
        )}
        <span className="text-gray-500">+${totals.taxAmount.toFixed(2)} tax</span>
        <span className="font-bold text-lg">${totals.total.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-t p-6">
      <div className="max-w-md ml-auto">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
          </div>

          {totals.discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Discount</span>
              <span className="font-medium text-green-600">-${totals.discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-600">Tax</span>
            <span className="font-medium">${totals.taxAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-900 font-semibold">Total</span>
            <span className="text-xl font-bold text-gray-900">${totals.total.toFixed(2)}</span>
          </div>

          {totals.depositAmount > 0 && (
            <div className="flex justify-between text-purple-600">
              <span>Deposit Due ({depositPercent}%)</span>
              <span className="font-medium">${totals.depositAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Margin indicator */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Gross Margin</span>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${totals.marginPercent >= 15 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.marginPercent.toFixed(1)}%
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                totals.marginPercent >= 20 ? 'bg-green-100 text-green-700' :
                totals.marginPercent >= 15 ? 'bg-green-100 text-green-600' :
                totals.marginPercent >= 10 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {totals.marginPercent >= 20 ? 'Excellent' :
                 totals.marginPercent >= 15 ? 'Good' :
                 totals.marginPercent >= 10 ? 'Low' : 'Critical'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
