/**
 * QuoteCard - Unified Create/View component for Quotes
 *
 * CRITICAL UX REQUIREMENT: This component must look IDENTICAL when creating vs viewing.
 * Line items are ALWAYS visible (not on a separate page).
 *
 * Props:
 * - isEditing: true = editable fields, false = read-only
 * - quote: existing quote data (null for new quote)
 * - onSave: callback when quote is saved
 */

import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { Quote, ProductType } from '../../types';
import { TotalsDisplay } from '../shared/TotalsDisplay';

// Line item form data
interface LineItemFormData {
  id?: string;
  tempId?: string; // For new items before save
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sku_id?: string | null;
  sku_code?: string;
  product_type?: string;
  sort_order: number;
}

// Quote form data
interface QuoteFormData {
  product_type?: ProductType;
  linear_feet?: number;
  notes?: string;
  internal_notes?: string;
  deposit_required?: number;
  line_items: LineItemFormData[];
}

interface QuoteCardProps {
  /** When true, fields are editable */
  isEditing: boolean;
  /** Existing quote data (null for new quote) */
  quote?: Quote | null;
  /** Project ID for new quotes */
  projectId?: string;
  /** Callback when save is clicked */
  onSave?: (data: QuoteFormData) => Promise<void>;
  /** Callback when cancel is clicked (edit mode) */
  onCancel?: () => void;
  /** Toggle edit mode */
  onToggleEdit?: () => void;
  /** Show compact view */
  compact?: boolean;
}

export function QuoteCard({
  isEditing,
  quote,
  projectId: _projectId,
  onSave,
  onCancel,
  onToggleEdit,
  compact = false,
}: QuoteCardProps) {
  const [formData, setFormData] = useState<QuoteFormData>({
    product_type: undefined,
    linear_feet: undefined,
    notes: '',
    internal_notes: '',
    deposit_required: 0,
    line_items: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Initialize form data from quote
  useEffect(() => {
    if (quote) {
      setFormData({
        product_type: (quote.product_type as ProductType) || undefined,
        linear_feet: quote.linear_feet || undefined,
        notes: quote.notes || '',
        internal_notes: quote.internal_notes || '',
        deposit_required: quote.deposit_required || 0,
        line_items: (quote.line_items || []).map((item, idx) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total: item.total ?? item.total_price ?? 0,
          sku_id: item.sku_id,
          sku_code: item.sku_code,
          product_type: item.product_type,
          sort_order: item.sort_order || idx,
        })),
      });
    }
  }, [quote]);

  // Calculate totals
  const subtotal = formData.line_items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal; // Add tax/discount logic as needed

  // Add new line item
  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [
        ...formData.line_items,
        {
          tempId: `new-${Date.now()}`,
          description: '',
          quantity: 1,
          unit_price: 0,
          total: 0,
          sort_order: formData.line_items.length,
        },
      ],
    });
  };

  // Update line item
  const updateLineItem = (
    index: number,
    field: keyof LineItemFormData,
    value: string | number
  ) => {
    const updated = [...formData.line_items];
    (updated[index] as Record<string, unknown>)[field] = value;

    // Recalculate total
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total = updated[index].quantity * updated[index].unit_price;
    }

    setFormData({ ...formData, line_items: updated });
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    const updated = formData.line_items.filter((_, i) => i !== index);
    setFormData({ ...formData, line_items: updated });
  };

  // Move line item up/down
  const moveLineItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.line_items.length) return;

    const updated = [...formData.line_items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((item, i) => {
      item.sort_order = i;
    });
    setFormData({ ...formData, line_items: updated });
  };

  // Handle save
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Render header row (compact mode toggle)
  if (compact && !isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="bg-white rounded-lg border p-4 cursor-pointer hover:border-blue-300 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {quote?.quote_number || 'New Quote'}
              </p>
              <p className="text-sm text-gray-500">
                {formData.line_items.length} line items
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(total)}</p>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {quote?.quote_number || 'New Quote'}
            </h3>
            {quote?.acceptance_status && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  quote.acceptance_status === 'accepted'
                    ? 'bg-green-100 text-green-700'
                    : quote.acceptance_status === 'declined'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {quote.acceptance_status}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {onToggleEdit && (
                <button
                  onClick={onToggleEdit}
                  className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  Edit
                </button>
              )}
              {compact && (
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 hover:bg-gray-200 rounded"
                >
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quote Details */}
      <div className="p-4 space-y-4">
        {/* Product Type & Linear Feet */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Type
            </label>
            {isEditing ? (
              <select
                value={formData.product_type || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    product_type: e.target.value as ProductType || undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type...</option>
                <option value="wood">Wood</option>
                <option value="chain_link">Chain Link</option>
                <option value="iron">Iron</option>
                <option value="vinyl">Vinyl</option>
                <option value="gate">Gate</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <p className="text-gray-900">
                {formData.product_type || '-'}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Linear Feet
            </label>
            {isEditing ? (
              <input
                type="number"
                value={formData.linear_feet || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    linear_feet: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            ) : (
              <p className="text-gray-900">{formData.linear_feet || '-'} LF</p>
            )}
          </div>
        </div>
      </div>

      {/* Line Items - ALWAYS VISIBLE */}
      <div className="border-t">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">
              Line Items ({formData.line_items.length})
            </h4>
            {isEditing && (
              <button
                onClick={addLineItem}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                {isEditing && <th className="pb-2 w-8"></th>}
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right w-20">Qty</th>
                <th className="pb-2 font-medium text-right w-28">Unit Price</th>
                <th className="pb-2 font-medium text-right w-28">Total</th>
                {isEditing && <th className="pb-2 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr key={item.id || item.tempId} className="border-b last:border-0">
                  {/* Reorder buttons */}
                  {isEditing && (
                    <td className="py-2 pr-2">
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveLineItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveLineItem(idx, 'down')}
                          disabled={idx === formData.line_items.length - 1}
                          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  )}

                  {/* Description */}
                  <td className="py-2 pr-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(idx, 'description', e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                        placeholder="Description"
                      />
                    ) : (
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.description}
                        </p>
                        {item.sku_code && (
                          <p className="text-xs text-gray-500">
                            SKU: {item.sku_code}
                          </p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Quantity */}
                  <td className="py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(idx, 'quantity', Number(e.target.value))
                        }
                        className="w-16 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="1"
                      />
                    ) : (
                      <span className="text-gray-600">{item.quantity}</span>
                    )}
                  </td>

                  {/* Unit Price */}
                  <td className="py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(idx, 'unit_price', Number(e.target.value))
                        }
                        className="w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-gray-600">
                        {formatCurrency(item.unit_price)}
                      </span>
                    )}
                  </td>

                  {/* Total */}
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(item.total)}
                  </td>

                  {/* Delete button */}
                  {isEditing && (
                    <td className="py-2 pl-2">
                      <button
                        onClick={() => removeLineItem(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {/* Empty state */}
              {formData.line_items.length === 0 && (
                <tr>
                  <td
                    colSpan={isEditing ? 6 : 4}
                    className="py-8 text-center text-gray-500"
                  >
                    {isEditing ? (
                      <button
                        onClick={addLineItem}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        + Add your first line item
                      </button>
                    ) : (
                      'No line items'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-4 bg-gray-50 border-t">
          <TotalsDisplay
            subtotal={subtotal}
            tax={quote?.tax_amount || 0}
            taxRate={quote?.tax_rate}
            discount={quote?.discount_amount || 0}
            total={total}
            horizontal
          />
        </div>
      </div>

      {/* Notes */}
      <div className="p-4 border-t space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (visible to client)
          </label>
          {isEditing ? (
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes for the client..."
            />
          ) : (
            <p className="text-gray-600">{formData.notes || '-'}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Internal Notes (not visible to client)
          </label>
          {isEditing ? (
            <textarea
              value={formData.internal_notes}
              onChange={(e) =>
                setFormData({ ...formData, internal_notes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-50"
              placeholder="Add internal notes..."
            />
          ) : (
            formData.internal_notes && (
              <p className="text-gray-600 bg-yellow-50 p-2 rounded">
                {formData.internal_notes}
              </p>
            )
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deposit Required
          </label>
          {isEditing ? (
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                value={formData.deposit_required || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deposit_required: Number(e.target.value) || 0,
                  })
                }
                className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                step="0.01"
              />
            </div>
          ) : (
            <p className="text-gray-900">
              {formatCurrency(formData.deposit_required || 0)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuoteCard;
