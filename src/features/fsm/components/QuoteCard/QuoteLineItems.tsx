/**
 * QuoteLineItems - Line items editor/display component
 *
 * Always visible in the QuoteCard (not on a separate tab).
 * - Edit mode: Full inline editing with SKU search
 * - View mode: Read-only table display
 */

import { Plus, Trash2, Package, Wrench, User, DollarSign } from 'lucide-react';
import type { LineItemFormState, QuoteCardMode, QuoteTotals } from './types';
import { LINE_TYPE_OPTIONS, UNIT_TYPE_OPTIONS } from './types';
import SkuSearchCombobox from '../SkuSearchCombobox';
import type { SkuSearchResult } from '../../hooks/useSkuSearch';

interface QuoteLineItemsProps {
  mode: QuoteCardMode;
  lineItems: LineItemFormState[];
  totals: QuoteTotals;
  onAddItem: () => void;
  onUpdateItem: (index: number, updates: Partial<LineItemFormState>) => void;
  onRemoveItem: (index: number) => void;
  onSkuSelect?: (index: number, sku: SkuSearchResult | null) => void;
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
}: QuoteLineItemsProps) {
  const isEditable = mode !== 'view';
  const activeItems = lineItems.filter(li => !li.isDeleted);

  // Handle SKU selection with price resolution
  const handleSkuSelect = (index: number, sku: SkuSearchResult | null) => {
    if (onSkuSelect) {
      onSkuSelect(index, sku);
    } else if (sku) {
      // Default behavior: populate from SKU
      onUpdateItem(index, {
        sku_id: sku.id,
        description: sku.sku_name,
        unit_type: 'LF',
        unit_price: sku.standard_cost_per_foot || 0,
        unit_cost: sku.standard_material_cost || 0,
        pricing_source: 'Catalog',
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
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-6 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <div className="col-span-1">Type</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-1">Unit</div>
            <div className="col-span-2 text-right">Price</div>
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
                className="grid grid-cols-12 gap-2 px-6 py-3 items-center hover:bg-gray-50"
              >
                {/* Type */}
                <div className="col-span-1">
                  {isEditable ? (
                    <select
                      value={item.line_type}
                      onChange={(e) => onUpdateItem(index, { line_type: e.target.value as LineItemFormState['line_type'] })}
                      className="w-full px-1.5 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500"
                      disabled={!!item.sku_id}
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

                {/* Description - SKU search OR manual entry */}
                <div className="col-span-3">
                  {isEditable ? (
                    <div className="space-y-1">
                      {/* Show SKU search for material/labor if no custom description yet */}
                      {(item.line_type === 'material' || item.line_type === 'labor') && !item.isCustom ? (
                        <>
                          <SkuSearchCombobox
                            value={item.sku_id ? { id: item.sku_id, sku_name: item.description } as SkuSearchResult : null}
                            onChange={(sku) => handleSkuSelect(index, sku)}
                            placeholder="Search SKU or type custom..."
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
                            placeholder="Description"
                            className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-purple-500"
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
                      {item.pricing_source && (
                        <div className="text-xs text-gray-400 truncate" title={item.pricing_source}>
                          {item.pricing_source}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-900">{item.description}</span>
                  )}
                </div>

                {/* Quantity */}
                <div className="col-span-1">
                  {isEditable ? (
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                    />
                  ) : (
                    <span className="text-sm text-gray-900 text-right block">{item.quantity}</span>
                  )}
                </div>

                {/* Unit Type */}
                <div className="col-span-1">
                  {isEditable ? (
                    <select
                      value={item.unit_type}
                      onChange={(e) => onUpdateItem(index, { unit_type: e.target.value })}
                      className="w-full px-1 py-1 text-xs border rounded focus:ring-2 focus:ring-purple-500"
                      disabled={!!item.sku_id}
                    >
                      {UNIT_TYPE_OPTIONS.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-600">{item.unit_type}</span>
                  )}
                </div>

                {/* Unit Price */}
                <div className="col-span-2">
                  {isEditable && !item.sku_id ? (
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => onUpdateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                      step="0.01"
                    />
                  ) : (
                    <span className={`text-sm text-right block ${item.sku_id ? 'text-gray-500 bg-gray-50 px-2 py-1 rounded' : 'text-gray-900'}`}>
                      ${item.unit_price.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Unit Cost */}
                <div className="col-span-2">
                  {isEditable && !item.sku_id ? (
                    <input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) => onUpdateItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-purple-500"
                      step="0.01"
                    />
                  ) : (
                    <span className={`text-sm text-right block ${item.sku_id ? 'text-gray-500 bg-gray-50 px-2 py-1 rounded' : 'text-gray-900'}`}>
                      ${item.unit_cost.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Line Total */}
                <div className="col-span-1 text-right font-medium text-sm">
                  ${lineTotal.toFixed(2)}
                </div>

                {/* Delete Button */}
                {isEditable && (
                  <div className="col-span-1 text-right">
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

          {/* Totals Row */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="flex justify-end gap-8 text-sm">
              <div className="text-right">
                <div className="text-gray-500">Subtotal</div>
                <div className="font-medium">${totals.subtotal.toFixed(2)}</div>
              </div>
              {totals.discountAmount > 0 && (
                <div className="text-right">
                  <div className="text-gray-500">Discount</div>
                  <div className="font-medium text-green-600">-${totals.discountAmount.toFixed(2)}</div>
                </div>
              )}
              <div className="text-right">
                <div className="text-gray-500">Tax</div>
                <div className="font-medium">${totals.taxAmount.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500">Total</div>
                <div className="text-xl font-bold">${totals.total.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
