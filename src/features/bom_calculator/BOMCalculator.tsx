import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, FolderOpen, Wrench, BookOpen, PackagePlus, Calculator } from 'lucide-react';
import type { ProjectDetails, LineItem, CalculationResult } from './types';
import { ProjectDetailsForm } from './components/ProjectDetailsForm';
import { useBOMCalculatorData } from './hooks';
import { FenceCalculator } from './services/FenceCalculator';
import type { WoodVerticalProductWithMaterials, WoodHorizontalProductWithMaterials, IronProductWithMaterials } from './database.types';

interface BOMCalculatorProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
}

// SKU Autocomplete Search Component
interface SKUSearchProps {
  value: string;
  onChange: (productId: string, productName: string, postType: 'WOOD' | 'STEEL') => void;
  fenceType: 'wood_vertical' | 'wood_horizontal' | 'iron';
  products: {
    woodVertical: WoodVerticalProductWithMaterials[];
    woodHorizontal: WoodHorizontalProductWithMaterials[];
    iron: IronProductWithMaterials[];
  };
}

function SKUSearch({ value, onChange, fenceType, products }: SKUSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Get products for the selected fence type
  const productList =
    fenceType === 'wood_vertical' ? products.woodVertical :
    fenceType === 'wood_horizontal' ? products.woodHorizontal :
    products.iron;

  // Filter products based on search
  const filteredProducts = productList.filter(p =>
    p.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku_code.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 20);

  // Find selected product name
  const selectedProduct = productList.find(p => p.id === value);
  const displayValue = selectedProduct ? selectedProduct.sku_name : searchTerm;

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
                onChange(product.id, product.sku_name, product.post_type);
                setSearchTerm(product.sku_name);
                setIsFocused(false);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100"
            >
              <div className="font-medium text-gray-900 text-sm">{product.sku_code} - {product.sku_name}</div>
              <div className="text-xs text-gray-500">{fenceType.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ModalView = 'none' | 'projects' | 'sku-builder' | 'catalog' | 'new-material';

export function BOMCalculator({ onBack, userRole: _userRole, userId: _userId, userName: _userName }: BOMCalculatorProps) {
  // Modal state
  const [activeModal, setActiveModal] = useState<ModalView>('none');

  // Project state
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    customerName: '',
    projectName: '',
    businessUnit: '', // Business Unit ID (UUID)
  });

  // Line items state - Initialize with one empty SKU row
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    id: `line-${Date.now()}`,
    projectId: undefined,
    fenceType: 'wood_vertical',
    productId: '',
    productName: '',
    postType: 'WOOD',
    totalFootage: 0,
    buffer: 5, // default 5ft buffer
    numberOfLines: 1,
    numberOfGates: 0,
    netLength: 0,
    sortOrder: 0,
  }]);

  // Calculation results
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);

  // Fetch data from database
  const { businessUnits, laborRates, products, loading, error } = useBOMCalculatorData(projectDetails.businessUnit);

  // Calculate BOM
  const handleCalculate = () => {
    if (!projectDetails.businessUnit) {
      alert('Please select a business unit first');
      return;
    }

    const calculator = new FenceCalculator('project');
    const allMaterials: any[] = [];
    const allLabor: any[] = [];

    // Calculate each line item
    for (const item of lineItems) {
      if (!item.productId || item.netLength <= 0) continue;

      const input = {
        netLength: item.netLength,
        numberOfLines: item.numberOfLines,
        numberOfGates: item.numberOfGates,
      };

      let result;
      if (item.fenceType === 'wood_vertical') {
        const product = products.woodVertical.find(p => p.id === item.productId);
        if (product) {
          result = calculator.calculateWoodVertical(product, input, laborRates);
        }
      } else if (item.fenceType === 'wood_horizontal') {
        const product = products.woodHorizontal.find(p => p.id === item.productId);
        if (product) {
          result = calculator.calculateWoodHorizontal(product, input, laborRates);
        }
      } else if (item.fenceType === 'iron') {
        const product = products.iron.find(p => p.id === item.productId);
        if (product) {
          result = calculator.calculateIron(product, input, laborRates);
        }
      }

      if (result) {
        allMaterials.push(...result.materials);
        allLabor.push(...result.labor);
      }
    }

    // Aggregate materials by material_id
    const materialMap = new Map();
    for (const mat of allMaterials) {
      if (materialMap.has(mat.material_id)) {
        const existing = materialMap.get(mat.material_id);
        existing.quantity += mat.quantity;
      } else {
        materialMap.set(mat.material_id, { ...mat });
      }
    }

    // Aggregate labor by labor_code_id
    const laborMap = new Map();
    for (const lab of allLabor) {
      if (laborMap.has(lab.labor_code_id)) {
        const existing = laborMap.get(lab.labor_code_id);
        existing.quantity += lab.quantity;
      } else {
        laborMap.set(lab.labor_code_id, { ...lab });
      }
    }

    setCalculationResult({
      materials: Array.from(materialMap.values()),
      labor: Array.from(laborMap.values()),
    });
  };

  // Add new SKU line
  const handleAddSKU = () => {
    setLineItems([...lineItems, {
      id: `line-${Date.now()}`,
      projectId: undefined,
      fenceType: 'wood_vertical',
      productId: '',
      productName: '',
      postType: 'WOOD',
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

  // Calculate totals from results
  const totalMaterialCost = calculationResult?.materials.reduce((sum, m) => {
    return sum + (Math.ceil(m.quantity) * m.unit_cost);
  }, 0) || 0;

  const totalLaborCost = calculationResult?.labor.reduce((sum, l) => {
    return sum + (l.quantity * l.rate);
  }, 0) || 0;

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

        {/* Sub-header with navigation buttons */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center space-x-3">
            <button
              onClick={() => setActiveModal('projects')}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2 text-sm font-medium transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Projects</span>
            </button>

            <button
              onClick={() => setActiveModal('sku-builder')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2 text-sm font-medium transition-colors"
            >
              <Wrench className="w-4 h-4" />
              <span>SKU Builder</span>
            </button>

            <button
              onClick={() => setActiveModal('catalog')}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center space-x-2 text-sm font-medium transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>SKU Catalog</span>
            </button>

            <button
              onClick={() => setActiveModal('new-material')}
              className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 flex items-center space-x-2 text-sm font-medium transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              <span>New Material</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Project Details Section */}
        <ProjectDetailsForm
          projectDetails={projectDetails}
          onChange={setProjectDetails}
          businessUnits={businessUnits}
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
                    onChange={(productId, productName, postType) => {
                      handleUpdateLineItem(item.id, { productId, productName, postType });
                    }}
                    fenceType={item.fenceType}
                    products={products}
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Bill of Materials & Labor</h2>
              <button
                onClick={handleCalculate}
                disabled={lineItems.length === 0 || !projectDetails.businessUnit || loading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 text-sm font-medium"
              >
                <Calculator className="w-4 h-4" />
                <span>Calculate</span>
              </button>
            </div>

            {/* Loading / Error States */}
            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading data from database...
              </div>
            )}
            {error && (
              <div className="text-center py-8 text-red-600">
                Error: {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Materials (BOM) */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm">Materials (BOM)</h3>
                    <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                      + Add Material
                    </button>
                  </div>
                  {calculationResult && calculationResult.materials.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 pb-2 border-b">
                        <div className="col-span-5">Material</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Rounded</div>
                        <div className="col-span-2 text-right">Cost</div>
                        <div className="col-span-1 text-right">Total</div>
                      </div>
                      {calculationResult.materials.map((mat, idx) => {
                        const roundedQty = Math.ceil(mat.quantity);
                        const extCost = roundedQty * mat.unit_cost;
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 text-xs py-1 hover:bg-gray-50">
                            <div className="col-span-5 truncate" title={mat.material_name}>
                              <span className="font-mono text-gray-600">{mat.material_sku}</span>
                              <span className="ml-1 text-gray-700">{mat.material_name}</span>
                            </div>
                            <div className="col-span-2 text-right text-gray-600">
                              {mat.quantity.toFixed(2)}
                            </div>
                            <div className="col-span-2 text-right font-semibold">
                              {roundedQty}
                            </div>
                            <div className="col-span-2 text-right text-gray-600">
                              ${mat.unit_cost.toFixed(2)}
                            </div>
                            <div className="col-span-1 text-right font-medium">
                              ${extCost.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-8 text-sm">
                      Click Calculate to see materials
                    </div>
                  )}
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
                  {calculationResult && calculationResult.labor.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 pb-2 border-b">
                        <div className="col-span-6">Labor Code</div>
                        <div className="col-span-2 text-right">Quantity</div>
                        <div className="col-span-2 text-right">Rate</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {calculationResult.labor.map((lab, idx) => {
                        const extCost = lab.quantity * lab.rate;
                        return (
                          <div key={idx} className="grid grid-cols-12 gap-2 text-xs py-1 hover:bg-gray-50">
                            <div className="col-span-6 truncate" title={lab.description}>
                              <span className="font-mono text-gray-600">{lab.labor_sku}</span>
                              <span className="ml-1 text-gray-700">{lab.description}</span>
                            </div>
                            <div className="col-span-2 text-right text-gray-600">
                              {lab.quantity.toFixed(2)} {lab.unit_type}
                            </div>
                            <div className="col-span-2 text-right text-gray-600">
                              ${lab.rate.toFixed(2)}
                            </div>
                            <div className="col-span-2 text-right font-medium">
                              ${extCost.toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-center py-8 text-sm">
                      {projectDetails.businessUnit
                        ? 'Click Calculate to see labor'
                        : 'Select Business Unit for labor rates'}
                    </div>
                  )}
                </div>
              </>
            )}

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

      {/* Modal Overlays */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-100 border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {activeModal === 'projects' && 'Projects'}
                {activeModal === 'sku-builder' && 'SKU Builder'}
                {activeModal === 'catalog' && 'SKU Catalog'}
                {activeModal === 'new-material' && 'New Material'}
              </h2>
              <button
                onClick={() => setActiveModal('none')}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {activeModal === 'projects' && (
                <div className="text-center py-12 text-gray-500">
                  <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">Projects List</p>
                  <p className="text-sm mt-2">View and manage saved BOM projects</p>
                  <p className="text-xs mt-4 text-gray-400">(Coming soon)</p>
                </div>
              )}

              {activeModal === 'sku-builder' && (
                <div className="text-center py-12 text-gray-500">
                  <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">SKU Builder</p>
                  <p className="text-sm mt-2">Create new fence SKU configurations</p>
                  <p className="text-xs mt-4 text-gray-400">(Coming soon)</p>
                </div>
              )}

              {activeModal === 'catalog' && (
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">SKU Catalog</p>
                  <p className="text-sm mt-2">Browse all available fence SKUs</p>
                  <p className="text-xs mt-4 text-gray-400">(Coming soon)</p>
                </div>
              )}

              {activeModal === 'new-material' && (
                <div className="text-center py-12 text-gray-500">
                  <PackagePlus className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium">New Material</p>
                  <p className="text-sm mt-2">Add new material to the database</p>
                  <p className="text-xs mt-4 text-gray-400">(Coming soon)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
