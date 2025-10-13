import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { ProjectDetails, LineItem, CalculationResult } from './types';
import { ProjectDetailsForm } from './components/ProjectDetailsForm';
import { getProductsByType } from './mockData';

interface BOMCalculatorProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
}

// SKU Autocomplete Search Component
interface SKUSearchProps {
  value: string;
  onChange: (productId: string, productName: string) => void;
  fenceType: 'wood_vertical' | 'wood_horizontal' | 'iron';
}

function SKUSearch({ value, onChange, fenceType }: SKUSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const products = getProductsByType(fenceType);

  // Filter products based on search
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 20);

  // Find selected product name
  const selectedProduct = products.find(p => p.id === value);
  const displayValue = selectedProduct ? selectedProduct.name : searchTerm;

  return (
    <div className="relative">
      <input
        type="text"
        value={isFocused ? searchTerm : displayValue}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setSearchTerm('');
        }}
        onBlur={() => {
          setTimeout(() => setIsFocused(false), 200);
        }}
        placeholder="Type to search SKU..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {isFocused && filteredProducts.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onMouseDown={() => {
                onChange(product.id, product.name);
                setSearchTerm(product.name);
                setIsFocused(false);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
            >
              <div className="font-medium text-gray-900 text-sm">{product.name}</div>
              <div className="text-xs text-gray-500">{fenceType.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BOMCalculator({ onBack, userRole: _userRole, userId: _userId, userName: _userName }: BOMCalculatorProps) {
  // Project state
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    customerName: '',
    projectName: '',
    businessUnit: 'austin',
  });

  // Line items state - Initialize with one empty SKU row
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    id: `line-${Date.now()}`,
    projectId: undefined,
    fenceType: 'wood_vertical',
    productId: '',
    productName: '',
    postType: 'wood',
    totalFootage: 0,
    buffer: 5, // default 5ft buffer
    numberOfLines: 1,
    numberOfGates: 0,
    netLength: 0,
    sortOrder: 0,
  }]);

  // Calculation results
  const [calculationResult, _setCalculationResult] = useState<CalculationResult | null>(null);

  // Add new SKU line
  const handleAddSKU = () => {
    setLineItems([...lineItems, {
      id: `line-${Date.now()}`,
      projectId: undefined,
      fenceType: 'wood_vertical',
      productId: '',
      productName: '',
      postType: 'wood',
      totalFootage: 0,
      buffer: 5,
      numberOfLines: 1,
      numberOfGates: 0,
      netLength: 0,
      sortOrder: lineItems.length,
    }]);
  };

  // Remove SKU line
  const handleRemoveSKU = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  // Update line item
  const handleUpdateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        // Recalculate net length
        updated.netLength = Math.max(0, updated.totalFootage - updated.buffer);
        return updated;
      }
      return item;
    }));
  };

  // Calculate totals (mock for now)
  const totalMaterialCost = 0;
  const totalLaborCost = 0;
  const totalProjectCost = totalMaterialCost + totalLaborCost;
  const totalFootage = lineItems.reduce((sum, item) => sum + item.netLength, 0);
  const costPerFoot = totalFootage > 0 ? totalProjectCost / totalFootage : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 font-medium flex items-center space-x-2 hover:text-blue-700"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="text-center flex-1">
            <h1 className="text-xl font-bold text-gray-900">BOM Calculator</h1>
            <p className="text-xs text-gray-600">Bill of Materials & Labor</p>
          </div>

          <div className="w-20"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Project Details Section */}
        <ProjectDetailsForm
          projectDetails={projectDetails}
          onChange={setProjectDetails}
          disabled={calculationResult !== null}
        />

        {/* Two-Column Layout: SKU Selection | BOM Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - SKU Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">SKU Selection</h2>
              <button
                onClick={handleAddSKU}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add SKU</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {lineItems.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  {/* SKU Search */}
                  <SKUSearch
                    value={item.productId}
                    onChange={(productId, productName) => {
                      handleUpdateLineItem(item.id, { productId, productName });
                    }}
                    fenceType={item.fenceType}
                  />

                  {/* Footage, Buffer, Lines, Gates */}
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Footage</label>
                      <input
                        type="number"
                        value={item.totalFootage || ''}
                        onChange={(e) => handleUpdateLineItem(item.id, {
                          totalFootage: parseFloat(e.target.value) || 0
                        })}
                        onFocus={(e) => e.target.select()}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Buffer</label>
                      <input
                        type="number"
                        value={item.buffer || ''}
                        onChange={(e) => handleUpdateLineItem(item.id, {
                          buffer: parseFloat(e.target.value) || 0
                        })}
                        onFocus={(e) => e.target.select()}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Lines</label>
                      <select
                        value={item.numberOfLines}
                        onChange={(e) => handleUpdateLineItem(item.id, {
                          numberOfLines: parseInt(e.target.value)
                        })}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Gates</label>
                      <select
                        value={item.numberOfGates}
                        onChange={(e) => handleUpdateLineItem(item.id, {
                          numberOfGates: parseInt(e.target.value)
                        })}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-md"
                      >
                        {[0, 1, 2, 3].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Net Length and Remove Button */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-gray-600">
                      Net Length: <span className="font-medium text-gray-900">{item.netLength} ft</span>
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => handleRemoveSKU(item.id)}
                        className="text-red-500 hover:text-red-700 text-sm flex items-center space-x-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Bill of Materials & Labor */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Bill of Materials & Labor</h2>

            {/* Materials (BOM) */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 text-sm">Materials (BOM)</h3>
                <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                  + Add Material
                </button>
              </div>
              <div className="text-gray-500 text-center py-8 text-sm">
                Add SKUs to see materials
              </div>
            </div>

            {/* Labor (BOL) */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800 text-sm">Labor (BOL)</h3>
                <button
                  disabled={!projectDetails.businessUnit}
                  className={`px-3 py-1 rounded text-xs ${
                    projectDetails.businessUnit
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  + Add Labor
                </button>
              </div>
              <div className="text-gray-500 text-center py-8 text-sm">
                {projectDetails.businessUnit
                  ? 'Add SKUs to see labor'
                  : 'Select Business Unit for labor rates'}
              </div>
            </div>

            {/* Project Totals - Green Gradient Bar */}
            <div className="border-t pt-4">
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs opacity-90">Materials</div>
                    <div className="text-xl font-bold">${totalMaterialCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-90">Labor</div>
                    <div className="text-xl font-bold">${totalLaborCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-90">Total</div>
                    <div className="text-2xl font-bold">${totalProjectCost.toFixed(2)}</div>
                  </div>
                </div>
                {totalFootage > 0 && (
                  <div className="mt-3 text-center text-sm">
                    Cost per foot: <span className="font-bold">${costPerFoot.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                disabled={!projectDetails.customerName || lineItems.length === 0}
                className="bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Save Project
              </button>
              <button
                disabled={!projectDetails.customerName || lineItems.length === 0}
                className="bg-gray-500 text-white py-3 rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
