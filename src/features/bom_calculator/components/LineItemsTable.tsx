import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LineItem, FenceType, Product } from '../types';
import { getProductsByType } from '../mockData';

interface LineItemsTableProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  disabled?: boolean;
}

export function LineItemsTable({ lineItems, onChange, disabled = false }: LineItemsTableProps) {
  const [newItemFenceType, setNewItemFenceType] = useState<FenceType>('wood_vertical');
  const [newItemProductId, setNewItemProductId] = useState<string>('');
  const [newItemLength, setNewItemLength] = useState<string>('');

  const availableProducts = getProductsByType(newItemFenceType);

  const handleAddLineItem = () => {
    if (!newItemProductId || !newItemLength) {
      alert('Please select a product and enter a length');
      return;
    }

    const product = availableProducts.find((p) => p.id === newItemProductId);
    if (!product) return;

    const length = parseFloat(newItemLength);
    if (isNaN(length) || length <= 0) {
      alert('Please enter a valid length');
      return;
    }

    // Create new line item with basic calculations
    const newItem: LineItem = {
      id: `line-${Date.now()}`,
      fenceType: newItemFenceType,
      productId: product.id,
      productName: product.name,
      postType: product.postType,
      length,
      sortOrder: lineItems.length,
    };

    // Perform basic calculations based on fence type
    if (newItemFenceType === 'wood_vertical') {
      const wvProduct = product as any;
      const lengthInches = length * 12;
      newItem.calculatedPosts = Math.ceil(lengthInches / wvProduct.postSpacing) + 1;
      newItem.calculatedPrimaryMaterial = Math.ceil((lengthInches / wvProduct.picketWidth) * 1.025);
      newItem.calculatedSecondaryMaterial = Math.ceil(lengthInches / 96) * wvProduct.railsPerSection;
    } else if (newItemFenceType === 'wood_horizontal') {
      const whProduct = product as any;
      const lengthInches = length * 12;
      newItem.calculatedPosts = Math.ceil(lengthInches / whProduct.postSpacing) + 1;
      const boardsPerFoot = 12 / whProduct.boardWidth;
      newItem.calculatedPrimaryMaterial = Math.ceil(length * boardsPerFoot * whProduct.height / 12);
    } else if (newItemFenceType === 'iron') {
      const ironProduct = product as any;
      newItem.calculatedPosts = Math.ceil(length / ironProduct.panelWidth) + 1;
      newItem.calculatedPrimaryMaterial = Math.ceil(length / ironProduct.panelWidth);
    }

    onChange([...lineItems, newItem]);

    // Reset form
    setNewItemProductId('');
    setNewItemLength('');
  };

  const handleDeleteLineItem = (id: string) => {
    onChange(lineItems.filter((item) => item.id !== id));
  };

  const handleUpdateAdjustment = (id: string, field: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    onChange(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: numValue } : item
      )
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Line Items</h2>

      {/* Add Line Item Form */}
      {!disabled && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Line Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Fence Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fence Type</label>
              <select
                value={newItemFenceType}
                onChange={(e) => {
                  setNewItemFenceType(e.target.value as FenceType);
                  setNewItemProductId('');
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="wood_vertical">Wood Vertical</option>
                <option value="wood_horizontal">Wood Horizontal</option>
                <option value="iron">Iron</option>
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
              <select
                value={newItemProductId}
                onChange={(e) => setNewItemProductId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select product...</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Length */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Length (ft)</label>
              <input
                type="number"
                value={newItemLength}
                onChange={(e) => setNewItemLength(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                min="0"
                step="0.1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Add Button */}
            <div className="flex items-end">
              <button
                onClick={handleAddLineItem}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items Table */}
      {lineItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No line items added yet.</p>
          <p className="text-sm">Add line items above to start your estimate.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Product</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Length (ft)</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Posts</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Primary</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Secondary</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Adj. Posts</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Adj. Primary</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">Adj. Secondary</th>
                {!disabled && <th className="text-center py-2 px-3 font-semibold text-gray-700">Action</th>}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900">{item.productName}</td>
                  <td className="py-2 px-3 text-right text-gray-900">{item.length}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{item.calculatedPosts || 0}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{item.calculatedPrimaryMaterial || 0}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{item.calculatedSecondaryMaterial || 0}</td>

                  {/* Manual Adjustments */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={item.adjustedPosts ?? ''}
                      onChange={(e) => handleUpdateAdjustment(item.id, 'adjustedPosts', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      disabled={disabled}
                      placeholder="-"
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={item.adjustedPrimaryMaterial ?? ''}
                      onChange={(e) => handleUpdateAdjustment(item.id, 'adjustedPrimaryMaterial', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      disabled={disabled}
                      placeholder="-"
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      value={item.adjustedSecondaryMaterial ?? ''}
                      onChange={(e) => handleUpdateAdjustment(item.id, 'adjustedSecondaryMaterial', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      disabled={disabled}
                      placeholder="-"
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </td>

                  {!disabled && (
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteLineItem(item.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Row */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-semibold text-blue-900">
              Total Linear Feet: {lineItems.reduce((sum, item) => sum + item.length, 0).toFixed(1)} ft
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
