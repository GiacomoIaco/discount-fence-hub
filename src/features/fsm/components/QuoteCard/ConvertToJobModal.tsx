/**
 * ConvertToJobModal - Modal for selecting line items when converting a quote to a job
 *
 * Shows all quote line items with checkboxes. User can:
 * - Select All / Deselect All
 * - Individually select line items
 * - See total for selected items
 */

import { useState, useMemo } from 'react';
import { X, Package, Wrench, User, DollarSign, CheckSquare, Square, Briefcase } from 'lucide-react';
import type { LineItemFormState } from './types';

interface ConvertToJobModalProps {
  isOpen: boolean;
  lineItems: LineItemFormState[];
  quoteNumber?: string;
  onClose: () => void;
  onConfirm: (selectedLineItemIds: string[]) => void;
  isConverting?: boolean;
}

const LINE_TYPE_ICONS = {
  material: Package,
  labor: Wrench,
  service: User,
  adjustment: DollarSign,
  discount: DollarSign,
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ConvertToJobModal({
  isOpen,
  lineItems,
  quoteNumber,
  onClose,
  onConfirm,
  isConverting = false,
}: ConvertToJobModalProps) {
  // Filter to only show active (non-deleted) items
  const activeItems = useMemo(() =>
    lineItems.filter(li => !li.isDeleted && li.id),
    [lineItems]
  );

  // Start with all items selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    new Set(activeItems.map(item => item.id!))
  );

  // Check if all items are selected
  const allSelected = selectedIds.size === activeItems.length;
  const noneSelected = selectedIds.size === 0;

  // Calculate selected total
  const selectedTotal = useMemo(() => {
    return activeItems
      .filter(item => item.id && selectedIds.has(item.id))
      .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [activeItems, selectedIds]);

  // Handle select all toggle
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeItems.map(item => item.id!)));
    }
  };

  // Handle individual item toggle
  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedIds(newSelected);
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Briefcase className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Convert to Job</h2>
              {quoteNumber && (
                <p className="text-sm text-gray-500">From {quoteNumber}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isConverting}
            className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Select All Header */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {allSelected ? (
              <CheckSquare className="w-5 h-5 text-green-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <div className="text-sm text-gray-500">
            {selectedIds.size} of {activeItems.length} items selected
          </div>
        </div>

        {/* Line Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No line items to select</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeItems.map((item) => {
                const Icon = LINE_TYPE_ICONS[item.line_type] || Package;
                const isSelected = item.id ? selectedIds.has(item.id) : false;
                const lineTotal = item.quantity * item.unit_price;

                return (
                  <div
                    key={item.id}
                    onClick={() => item.id && handleToggleItem(item.id)}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-green-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        isSelected ? 'text-green-600' : 'text-gray-500'
                      }`} />
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        isSelected ? 'text-gray-900' : 'text-gray-600'
                      }`}>
                        {item.description || 'Unnamed item'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} {item.unit_type} @ ${formatCurrency(item.unit_price)}
                      </p>
                    </div>

                    {/* Line total */}
                    <div className={`text-right font-medium ${
                      isSelected ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      ${formatCurrency(lineTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with totals and actions */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">Selected Total</span>
            <span className="text-xl font-bold text-gray-900">
              ${formatCurrency(selectedTotal)}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isConverting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConverting || noneSelected}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConverting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  Create Job ({selectedIds.size} items)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
