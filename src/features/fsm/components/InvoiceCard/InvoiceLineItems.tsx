/**
 * InvoiceLineItems - Line items table for InvoiceCard
 *
 * Shows:
 * - Editable line items table
 * - Subtotal, Tax, Discount, Total
 * - Amount Paid, Balance Due
 */

import { Plus, Trash2 } from 'lucide-react';
import type { InvoiceLineItemsProps } from './types';
import { useCanEditPrices, useCanGiveDiscounts } from '../../../../lib/permissions';

export default function InvoiceLineItems({
  mode,
  lineItems,
  totals,
  taxRate,
  discountAmount,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onTaxRateChange,
  onDiscountChange,
}: InvoiceLineItemsProps) {
  const isEditable = mode !== 'view';

  // Permission checks - price editing requires edit_prices permission
  const canEditPrices = useCanEditPrices();
  const canGiveDiscounts = useCanGiveDiscounts();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-xl border">
      {/* Table Header */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
              <th className="px-6 py-3 w-2/5">Description</th>
              <th className="px-4 py-3 w-24 text-center">Qty</th>
              <th className="px-4 py-3 w-32 text-right">Unit Price</th>
              <th className="px-4 py-3 w-32 text-right">Amount</th>
              {isEditable && <th className="px-4 py-3 w-16"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {lineItems.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {/* Description */}
                <td className="px-6 py-3">
                  {isEditable ? (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => onUpdateItem(index, { description: e.target.value })}
                      placeholder="Enter description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{item.description}</span>
                  )}
                </td>

                {/* Quantity */}
                <td className="px-4 py-3">
                  {isEditable ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900 text-center block">
                      {item.quantity}
                    </span>
                  )}
                </td>

                {/* Unit Price - editing requires edit_prices permission */}
                <td className="px-4 py-3">
                  {isEditable && canEditPrices ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          onUpdateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-900 text-right block">
                      {formatCurrency(item.unitPrice)}
                    </span>
                  )}
                </td>

                {/* Amount */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(item.amount)}
                  </span>
                </td>

                {/* Remove Button */}
                {isEditable && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemoveItem(index)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Item Button */}
      {isEditable && (
        <div className="px-6 py-3 border-t">
          <button
            onClick={onAddItem}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      )}

      {/* Totals Section */}
      <div className="px-6 py-4 bg-gray-50 border-t">
        <div className="flex flex-col items-end gap-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between w-72">
            <span className="text-sm text-gray-600">Subtotal</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>

          {/* Tax */}
          <div className="flex items-center justify-between w-72">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Tax</span>
              {isEditable ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              ) : (
                <span className="text-xs text-gray-500">({taxRate}%)</span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(totals.taxAmount)}
            </span>
          </div>

          {/* Discount - editing requires give_discounts permission */}
          <div className="flex items-center justify-between w-72">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Discount</span>
              {isEditable && canGiveDiscounts && (
                <button
                  onClick={() => {
                    const newDiscount = prompt('Enter discount amount:', discountAmount.toString());
                    if (newDiscount !== null) {
                      onDiscountChange(parseFloat(newDiscount) || 0);
                    }
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {discountAmount > 0 ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            <span className="text-sm font-medium text-gray-900">
              {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : '$0.00'}
            </span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between w-72 pt-2 border-t">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(totals.total)}
            </span>
          </div>

          {/* Amount Paid (view mode) */}
          {mode === 'view' && totals.amountPaid > 0 && (
            <div className="flex items-center justify-between w-72">
              <span className="text-sm text-gray-600">Amount Paid</span>
              <span className="text-sm font-medium text-green-600">
                -{formatCurrency(totals.amountPaid)}
              </span>
            </div>
          )}

          {/* Balance Due (view mode) */}
          {mode === 'view' && (
            <div className="flex items-center justify-between w-72 pt-2 border-t">
              <span className="text-base font-semibold text-gray-900">Balance Due</span>
              <span
                className={`text-lg font-bold ${
                  totals.balanceDue > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {formatCurrency(totals.balanceDue)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
