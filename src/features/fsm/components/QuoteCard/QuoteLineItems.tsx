/**
 * QuoteLineItems - Line items editor/display component
 *
 * Always visible in the QuoteCard (not on a separate tab).
 * - Edit mode: Full inline editing with SKU search
 * - View mode: Read-only table display
 */

import { useState } from 'react';
import { Plus, Trash2, Package, Wrench, User, DollarSign, Percent, Tag } from 'lucide-react';
import type { LineItemFormState, QuoteCardMode, QuoteTotals } from './types';
import { LINE_TYPE_OPTIONS, UNIT_TYPE_OPTIONS } from './types';
import SkuSearchCombobox from '../SkuSearchCombobox';
import type { SkuSearchResult } from '../../hooks/useSkuSearch';

// Currency formatter with commas
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface QuoteLineItemsProps {
  mode: QuoteCardMode;
  lineItems: LineItemFormState[];
  totals: QuoteTotals;
  onAddItem: () => void;
  onUpdateItem: (index: number, updates: Partial<LineItemFormState>) => void;
  onRemoveItem: (index: number) => void;
  onSkuSelect?: (index: number, sku: SkuSearchResult | null) => void;
  /** Discount and deposit props (Jobber style in totals area) */
  discountPercent?: string;
  depositPercent?: string;
  onDiscountChange?: (value: string) => void;
  onDepositChange?: (value: string) => void;
}

const LINE_TYPE_ICONS = {
  material: Package,
  labor: Wrench,
  service: User,
  adjustment: DollarSign,
  discount: DollarSign,
};

export default function QuoteLineItems({
  mode,
  lineItems,
  totals,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onSkuSelect,
  discountPercent = '0',
  depositPercent = '0',
  onDiscountChange,
  onDepositChange,
}: QuoteLineItemsProps) {
  const isEditable = mode !== 'view';
  const activeItems = lineItems.filter(li => !li.isDeleted);

  // Local state for showing/hiding discount and deposit inputs
  const [showDiscount, setShowDiscount] = useState(parseFloat(discountPercent) > 0);
  const [showDeposit, setShowDeposit] = useState(parseFloat(depositPercent) > 0);

  // Handle SKU selection with price resolution
  // NOTE: This is the fallback handler. QuoteCard overrides this with onSkuSelect
  // to use BU-specific labor costs from sku_labor_costs_v2.
  const handleSkuSelect = (index: number, sku: SkuSearchResult | null) => {
    if (onSkuSelect) {
      onSkuSelect(index, sku);
    } else if (sku) {
      // Fallback behavior: populate from SKU using stored values
      // Material: standard_cost_per_foot is already per 1 LF (pre-computed)
      // Labor: standard_labor_cost is stored per 100 LF, so divide by 100
      // NOTE: This won't be BU-specific. Use onSkuSelect for proper BU lookup.
      const materialCost = sku.standard_cost_per_foot || 0;
      const laborCost = (sku.standard_labor_cost || 0) / 100;
      const totalCost = materialCost + laborCost;
      onUpdateItem(index, {
        sku_id: sku.id,
        sku_code: sku.sku_code,
        product_type_code: sku.product_type_code,
        description: sku.sku_name,
        unit_type: 'LF',
        unit_price: totalCost,  // Default to cost as price (no rate sheet)
        unit_cost: totalCost,
        material_unit_cost: materialCost,
        labor_unit_cost: laborCost,
        pricing_source: 'Catalog (No Rate Sheet)',
        line_type: 'material',
      });
    } else {
      // Clear SKU selection
      onUpdateItem(index, {
        sku_id: null,
        description: '',
        unit_price: 0,
        unit_cost: 0,
        pricing_source: null,
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold">Line Items</h2>
        {isEditable && (
          <button
            onClick={onAddItem}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        )}
      </div>

      {activeItems.length === 0 ? (
        <div className="p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">No items added yet</p>
          {isEditable && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y">
          {/* Table Header - Redesigned layout */}
          <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <div className="col-span-1">SKU</div>
            <div className="col-span-4">Product/Service</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-1 text-center">Unit</div>
            <div className="col-span-1 text-right">Price</div>
            <div className="col-span-2 text-right">Cost</div>
            <div className="col-span-1 text-right">Total</div>
            {isEditable && <div className="col-span-1"></div>}
          </div>

          {/* Table Rows */}
          {activeItems.map((item, index) => {
            const Icon = LINE_TYPE_ICONS[item.line_type] || Package;
            const lineTotal = item.quantity * item.unit_price;

            return (
              <div
                key={item.id || `new-${index}`}
                className="grid grid-cols-12 gap-2 px-6 py-3 items-start hover:bg-gray-50"
              >
                {/* SKU Column - Product Type + SKU ID */}
                <div className="col-span-1 pt-1">
                  {item.sku_code ? (
                    // Show product type code + SKU ID for catalog items
                    <div className="space-y-1">
                      <div className="flex items-center gap-1" title={`SKU: ${item.sku_code}`}>
                        <span className="font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-xs">
                          {item.product_type_code || 'SKU'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate" title={item.sku_code}>
                        {item.sku_code}
                      </div>
                    </div>
                  ) : isEditable ? (
                    // For custom items, show line type selector
                    <select
                      value={item.line_type}
                      onChange={(e) => onUpdateItem(index, { line_type: e.target.value as LineItemFormState['line_type'] })}
                      className="w-full px-1 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500"
                    >
                      {LINE_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Icon className="w-3 h-3" />
                      <span className="capitalize">{item.line_type}</span>
                    </div>
                  )}
                </div>

                {/* Product/Service - SKU combobox + Description field */}
                <div className="col-span-4">
                  {isEditable ? (
                    <div className="space-y-2">
                      {/* Row 1: SKU search combobox or Product Name input */}
                      {(item.line_type === 'material' || item.line_type === 'labor') && !item.isCustom ? (
                        <>
                          <SkuSearchCombobox
                            value={item.sku_id ? { id: item.sku_id, sku_name: item.description } as SkuSearchResult : null}
                            onChange={(sku) => handleSkuSelect(index, sku)}
                            placeholder="Search SKU catalog..."
                          />
                          {!item.sku_id && (
                            <button
                              type="button"
                              onClick={() => onUpdateItem(index, { isCustom: true })}
                              className="text-xs text-purple-600 hover:text-purple-800"
                            >
                              + Enter custom item
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => onUpdateItem(index, { description: e.target.value })}
                            placeholder="Product/Service name"
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-purple-500"
                          />
                          {(item.line_type === 'material' || item.line_type === 'labor') && item.isCustom && (
                            <button
                              type="button"
                              onClick={() => onUpdateItem(index, { isCustom: false, description: '', sku_id: null })}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Search catalog instead
                            </button>
                          )}
                        </>
                      )}

                      {/* Row 2: Additional description textarea */}
                      <input
                        type="text"
                        value={item.additional_description || ''}
                        onChange={(e) => onUpdateItem(index, { additional_description: e.target.value })}
                        placeholder="Description (optional)"
                        className="w-full px-2 py-1 text-xs border border-dashed rounded focus:ring-2 focus:ring-purple-500 text-gray-600"
                      />

                      {/* Pricing source indicator */}
                      {item.pricing_source && (
                        <div className="text-xs text-gray-400 truncate" title={item.pricing_source}>
                          {item.pricing_source}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900 font-medium">{item.description}</div>
                      {item.additional_description && (
                        <div className="text-xs text-gray-500">{item.additional_description}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="col-span-1 pt-1">
                  {isEditable ? (
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm text-center border rounded focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900 text-center block">{item.quantity}</span>
                  )}
                </div>

                {/* Unit Type */}
                <div className="col-span-1 pt-1">
                  {isEditable ? (
                    <select
                      value={item.unit_type}
                      onChange={(e) => onUpdateItem(index, { unit_type: e.target.value })}
                      className="w-full px-1 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500 text-center"
                      disabled={!!item.sku_id}
                    >
                      {UNIT_TYPE_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-600 text-center block">{item.unit_type}</span>
                  )}
                </div>

                {/* Unit Price - Reduced width */}
                <div className="col-span-1 pt-1">
                  {isEditable && !item.sku_id ? (
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => onUpdateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-1 py-1 text-xs text-right border rounded focus:ring-2 focus:ring-purple-500"
                      step="0.01"
                    />
                  ) : (
                    <span className={`text-sm text-right block ${item.sku_id ? 'text-gray-500' : 'text-gray-900'}`}>
                      ${formatCurrency(item.unit_price)}
                    </span>
                  )}
                </div>

                {/* Unit Cost - With M/L breakdown */}
                <div className="col-span-2 pt-1">
                  {isEditable && !item.sku_id ? (
                    <input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) => onUpdateItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-1 py-1 text-xs text-right border rounded focus:ring-2 focus:ring-purple-500"
                      step="0.01"
                    />
                  ) : (
                    <div className="text-right">
                      <span className={`text-sm block ${item.sku_id ? 'text-gray-500' : 'text-gray-900'}`}>
                        ${formatCurrency(item.unit_cost)}
                      </span>
                      {item.sku_id && item.material_unit_cost !== undefined && item.labor_unit_cost !== undefined && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          M: ${formatCurrency(item.material_unit_cost)} L: ${formatCurrency(item.labor_unit_cost)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Line Total */}
                <div className="col-span-1 text-right font-medium text-sm pt-1">
                  ${formatCurrency(lineTotal)}
                </div>

                {/* Delete Button */}
                {isEditable && (
                  <div className="col-span-1 text-right pt-1">
                    <button
                      onClick={() => onRemoveItem(index)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Totals Section - Jobber style */}
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="max-w-xs ml-auto space-y-2">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Discount - Jobber style */}
              {isEditable ? (
                showDiscount ? (
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-600" />
                      <span className="text-gray-600">Discount</span>
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => onDiscountChange?.(e.target.value)}
                        className="w-16 px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500 text-right"
                        min="0"
                        max="100"
                        step="1"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-green-600">-${formatCurrency(totals.discountAmount)}</span>
                      <button
                        onClick={() => {
                          onDiscountChange?.('0');
                          setShowDiscount(false);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <button
                      onClick={() => setShowDiscount(true)}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      Add Discount
                    </button>
                  </div>
                )
              ) : totals.discountAmount > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount ({discountPercent}%)</span>
                  <span className="font-medium text-green-600">-${formatCurrency(totals.discountAmount)}</span>
                </div>
              ) : null}

              {/* Tax */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium">${formatCurrency(totals.taxAmount)}</span>
              </div>

              {/* Total */}
              <div className="flex justify-between text-base font-semibold pt-2 border-t">
                <span>Total</span>
                <span className="text-lg">${formatCurrency(totals.total)}</span>
              </div>

              {/* Required Deposit - Jobber style */}
              {isEditable ? (
                showDeposit ? (
                  <div className="flex justify-between items-center text-sm pt-2">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-purple-600" />
                      <span className="text-gray-600">Required Deposit</span>
                      <input
                        type="number"
                        value={depositPercent}
                        onChange={(e) => onDepositChange?.(e.target.value)}
                        className="w-16 px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500 text-right"
                        min="0"
                        max="100"
                        step="5"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-purple-600">${formatCurrency(totals.depositAmount)}</span>
                      <button
                        onClick={() => {
                          onDepositChange?.('0');
                          setShowDeposit(false);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm pt-2">
                    <span className="text-gray-600">Required Deposit</span>
                    <button
                      onClick={() => setShowDeposit(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Add Deposit
                    </button>
                  </div>
                )
              ) : totals.depositAmount > 0 ? (
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-600">Required Deposit ({depositPercent}%)</span>
                  <span className="font-medium text-purple-600">${formatCurrency(totals.depositAmount)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
