import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Loader2, Save, X, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LineItem } from './types';
import { useBOMCalculatorData } from './hooks';
import { FenceCalculator } from './services/FenceCalculator';
import { supabase } from '../../lib/supabase';
import { showSuccess, showError } from '../../lib/toast';
import type { WoodVerticalProductWithMaterials, WoodHorizontalProductWithMaterials, IronProductWithMaterials } from './database.types';

// Material from database
interface Material {
  id: string;
  material_sku: string;
  material_name: string;
  category: string;
  unit_cost: number;
  unit_type: string;
}

// Labor code from database
interface LaborCode {
  id: string;
  labor_sku: string;
  description: string;
  unit_type: string;
}

interface BOMCalculatorProps {
  onBack: () => void;
  userRole: 'operations' | 'admin';
  userId?: string;
  userName?: string;
  hideHeader?: boolean;
}

// Material row in BOM with adjustment support
interface MaterialRow {
  material_id: string;
  material_sku: string;
  material_name: string;
  unit_cost: number;
  calculated_qty: number;
  rounded_qty: number;
  adjustment: number;
  total_qty: number;
  total_cost: number;
  is_manual: boolean;
}

// Labor row in BOL with adjustment support
interface LaborRow {
  labor_code_id: string;
  labor_sku: string;
  description: string;
  rate: number;
  quantity: number;
  calculated_cost: number;
  adjustment: number;
  total_cost: number;
  is_manual: boolean;
}

interface Yard {
  id: string;
  code: string;
  name: string;
  city: string;
}

// SKU Search Component
function SKUSearch({
  value,
  onChange,
  fenceType,
  products,
}: {
  value: string;
  onChange: (productId: string, productName: string, postType: 'WOOD' | 'STEEL', skuCode: string) => void;
  fenceType: 'wood_vertical' | 'wood_horizontal' | 'iron';
  products: {
    woodVertical: WoodVerticalProductWithMaterials[];
    woodHorizontal: WoodHorizontalProductWithMaterials[];
    iron: IronProductWithMaterials[];
  };
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const productList =
    fenceType === 'wood_vertical' ? products.woodVertical :
    fenceType === 'wood_horizontal' ? products.woodHorizontal :
    products.iron;

  const filteredProducts = productList.filter(p =>
    p.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku_code.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 15);

  const selectedProduct = productList.find(p => p.id === value);
  const displayValue = selectedProduct ? `${selectedProduct.sku_code} - ${selectedProduct.sku_name}` : searchTerm;

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={isFocused ? searchTerm : displayValue}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => { setIsFocused(true); setSearchTerm(''); }}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        placeholder="Search SKU..."
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
      />
      {isFocused && filteredProducts.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              onMouseDown={() => {
                onChange(product.id, product.sku_name, product.post_type, product.sku_code);
                setSearchTerm('');
                setIsFocused(false);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-green-50 border-b border-gray-100 last:border-0"
            >
              <div className="font-mono text-sm font-medium text-gray-900">{product.sku_code}</div>
              <div className="text-xs text-gray-600 truncate">{product.sku_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add Material Modal Component
function AddMaterialModal({
  isOpen,
  onClose,
  materials,
  existingMaterialIds,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  existingMaterialIds: Set<string>;
  onAdd: (material: Material) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  if (!isOpen) return null;

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.material_sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || m.category === categoryFilter;
    const notAlreadyAdded = !existingMaterialIds.has(m.id);
    return matchesSearch && matchesCategory && notAlreadyAdded;
  });

  const categories = [...new Set(materials.map(m => m.category))].sort();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add Material</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredMaterials.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm || categoryFilter ? 'No materials match your filters' : 'All materials already added'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMaterials.slice(0, 50).map(material => (
                <div
                  key={material.id}
                  onClick={() => {
                    onAdd(material);
                    onClose();
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{material.material_name}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      <span className="font-mono">{material.material_sku}</span>
                      <span>•</span>
                      <span>{material.category}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">${material.unit_cost.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{material.unit_type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add Labor Modal Component
function AddLaborModal({
  isOpen,
  onClose,
  laborCodes,
  laborRates,
  existingLaborIds,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  laborCodes: LaborCode[];
  laborRates: { labor_code_id: string; rate: number }[];
  existingLaborIds: Set<string>;
  onAdd: (laborCode: LaborCode, rate: number) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Get rates for current BU
  const rateMap = new Map(laborRates.map(r => [r.labor_code_id, r.rate]));

  const filteredLabor = laborCodes.filter(lc => {
    const matchesSearch = lc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lc.labor_sku.toLowerCase().includes(searchTerm.toLowerCase());
    const notAlreadyAdded = !existingLaborIds.has(lc.id);
    return matchesSearch && notAlreadyAdded;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add Labor</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search labor codes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredLabor.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? 'No labor codes match your search' : 'All labor codes already added'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLabor.map(lc => {
                const rate = rateMap.get(lc.id) || 0;
                return (
                  <div
                    key={lc.id}
                    onClick={() => {
                      onAdd(lc, rate);
                      onClose();
                    }}
                    className="px-4 py-3 hover:bg-purple-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{lc.description}</div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        <span className="font-mono">{lc.labor_sku}</span>
                        <span>•</span>
                        <span>{lc.unit_type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-600">${rate.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">per {lc.unit_type}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BOMCalculator({
  userId,
  hideHeader = false,
}: BOMCalculatorProps) {
  const queryClient = useQueryClient();

  // Project state
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [yardId, setYardId] = useState('');
  const [expectedPickupDate, setExpectedPickupDate] = useState('');
  const [projectNotes, setProjectNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([{
    id: `line-${Date.now()}`,
    fenceType: 'wood_vertical',
    productId: '',
    productName: '',
    postType: 'WOOD',
    totalFootage: 0,
    buffer: 5,
    numberOfLines: 1,
    numberOfGates: 0,
    netLength: 0,
    sortOrder: 0,
  }]);

  // BOM/BOL with adjustments
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [laborRows, setLaborRows] = useState<LaborRow[]>([]);

  // UI state
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showAddLaborModal, setShowAddLaborModal] = useState(false);

  // Fetch data
  const { businessUnits, laborRates, products, loading } = useBOMCalculatorData(businessUnitId);

  // Fetch all materials for manual addition
  const { data: allMaterials = [] } = useQuery({
    queryKey: ['all-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_sku, material_name, category, unit_cost, unit_type')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Fetch all labor codes for manual addition
  const { data: allLaborCodes = [] } = useQuery({
    queryKey: ['all-labor-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_codes')
        .select('id, labor_sku, description, unit_type')
        .eq('is_active', true)
        .order('labor_sku');
      if (error) throw error;
      return data as LaborCode[];
    },
  });

  // Fetch yards
  const { data: yards = [] } = useQuery({
    queryKey: ['yards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yards')
        .select('id, code, name, city')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as Yard[];
    },
  });

  // Set default BU and yard
  useEffect(() => {
    if (businessUnits.length > 0 && !businessUnitId) {
      setBusinessUnitId(businessUnits[0].id);
    }
  }, [businessUnits, businessUnitId]);

  useEffect(() => {
    if (yards.length > 0 && !yardId) {
      setYardId(yards[0].id);
    }
  }, [yards, yardId]);

  // Auto-calculate when inputs change
  const calculate = useCallback(() => {
    if (!businessUnitId || loading) return;

    const calculator = new FenceCalculator('project');
    const allMaterials: any[] = [];
    const allLabor: any[] = [];

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
        if (product) result = calculator.calculateWoodVertical(product, input, laborRates);
      } else if (item.fenceType === 'wood_horizontal') {
        const product = products.woodHorizontal.find(p => p.id === item.productId);
        if (product) result = calculator.calculateWoodHorizontal(product, input, laborRates);
      } else if (item.fenceType === 'iron') {
        const product = products.iron.find(p => p.id === item.productId);
        if (product) result = calculator.calculateIron(product, input, laborRates);
      }

      if (result) {
        allMaterials.push(...result.materials);
        allLabor.push(...result.labor);
      }
    }

    // Aggregate materials
    const materialMap = new Map<string, MaterialRow>();
    for (const mat of allMaterials) {
      if (materialMap.has(mat.material_id)) {
        const existing = materialMap.get(mat.material_id)!;
        existing.calculated_qty += mat.quantity;
        existing.rounded_qty = Math.ceil(existing.calculated_qty);
        existing.total_qty = existing.rounded_qty + existing.adjustment;
        existing.total_cost = existing.total_qty * existing.unit_cost;
      } else {
        const rounded = Math.ceil(mat.quantity);
        materialMap.set(mat.material_id, {
          material_id: mat.material_id,
          material_sku: mat.material_sku,
          material_name: mat.material_name,
          unit_cost: mat.unit_cost,
          calculated_qty: mat.quantity,
          rounded_qty: rounded,
          adjustment: 0,
          total_qty: rounded,
          total_cost: rounded * mat.unit_cost,
          is_manual: false,
        });
      }
    }

    // Preserve existing adjustments
    setMaterialRows(prev => {
      const newRows = Array.from(materialMap.values());
      return newRows.map(row => {
        const existing = prev.find(p => p.material_id === row.material_id);
        if (existing && !existing.is_manual) {
          row.adjustment = existing.adjustment;
          row.total_qty = row.rounded_qty + row.adjustment;
          row.total_cost = row.total_qty * row.unit_cost;
        }
        return row;
      }).concat(prev.filter(p => p.is_manual)); // Keep manual additions
    });

    // Aggregate labor
    const laborMap = new Map<string, LaborRow>();
    for (const lab of allLabor) {
      if (laborMap.has(lab.labor_code_id)) {
        const existing = laborMap.get(lab.labor_code_id)!;
        existing.quantity += lab.quantity;
        existing.calculated_cost = existing.quantity * existing.rate;
        existing.total_cost = existing.calculated_cost + existing.adjustment;
      } else {
        const calcCost = lab.quantity * lab.rate;
        laborMap.set(lab.labor_code_id, {
          labor_code_id: lab.labor_code_id,
          labor_sku: lab.labor_sku,
          description: lab.description,
          rate: lab.rate,
          quantity: lab.quantity,
          calculated_cost: calcCost,
          adjustment: 0,
          total_cost: calcCost,
          is_manual: false,
        });
      }
    }

    // Preserve existing adjustments
    setLaborRows(prev => {
      const newRows = Array.from(laborMap.values());
      return newRows.map(row => {
        const existing = prev.find(p => p.labor_code_id === row.labor_code_id);
        if (existing && !existing.is_manual) {
          row.adjustment = existing.adjustment;
          row.total_cost = row.calculated_cost + row.adjustment;
        }
        return row;
      }).concat(prev.filter(p => p.is_manual));
    });
  }, [businessUnitId, lineItems, products, laborRates, loading]);

  // Debounced auto-calculate
  useEffect(() => {
    const timer = setTimeout(calculate, 300);
    return () => clearTimeout(timer);
  }, [calculate]);

  // Calculate totals
  const totals = useMemo(() => {
    const materialTotal = materialRows.reduce((sum, m) => sum + m.total_cost, 0);
    const laborTotal = laborRows.reduce((sum, l) => sum + l.total_cost, 0);
    const materialCalc = materialRows.reduce((sum, m) => sum + (m.rounded_qty * m.unit_cost), 0);
    const laborCalc = laborRows.reduce((sum, l) => sum + l.calculated_cost, 0);
    const totalFootage = lineItems.reduce((sum, item) => sum + item.netLength, 0);
    const projectTotal = materialTotal + laborTotal;
    const adjustmentTotal = (materialTotal - materialCalc) + (laborTotal - laborCalc);

    return {
      material: materialTotal,
      labor: laborTotal,
      total: projectTotal,
      footage: totalFootage,
      perFoot: totalFootage > 0 ? projectTotal / totalFootage : 0,
      adjustments: adjustmentTotal,
      calculatedTotal: materialCalc + laborCalc,
    };
  }, [materialRows, laborRows, lineItems]);

  // Line item handlers
  const handleAddLine = () => {
    setLineItems([...lineItems, {
      id: `line-${Date.now()}`,
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

  const handleRemoveLine = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleUpdateLine = (id: string, updates: Partial<LineItem>) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        updated.netLength = Math.max(0, updated.totalFootage - updated.buffer);
        return updated;
      }
      return item;
    }));
  };

  // Material adjustment handler
  const handleMaterialAdjustment = (materialId: string, adj: number) => {
    setMaterialRows(rows => rows.map(row => {
      if (row.material_id === materialId) {
        const newTotalQty = row.rounded_qty + adj;
        return {
          ...row,
          adjustment: adj,
          total_qty: Math.max(0, newTotalQty),
          total_cost: Math.max(0, newTotalQty) * row.unit_cost,
        };
      }
      return row;
    }));
  };

  // Labor adjustment handler (dollar amount)
  const handleLaborAdjustment = (laborCodeId: string, adj: number) => {
    setLaborRows(rows => rows.map(row => {
      if (row.labor_code_id === laborCodeId) {
        return {
          ...row,
          adjustment: adj,
          total_cost: row.calculated_cost + adj,
        };
      }
      return row;
    }));
  };

  // Add manual material
  const handleAddManualMaterial = (material: Material) => {
    const newRow: MaterialRow = {
      material_id: material.id,
      material_sku: material.material_sku,
      material_name: material.material_name,
      unit_cost: material.unit_cost,
      calculated_qty: 0,
      rounded_qty: 0,
      adjustment: 0,
      total_qty: 0,
      total_cost: 0,
      is_manual: true,
    };
    setMaterialRows(prev => [...prev, newRow]);
    showSuccess(`Added ${material.material_name}`);
  };

  // Add manual labor
  const handleAddManualLabor = (laborCode: LaborCode, rate: number) => {
    const newRow: LaborRow = {
      labor_code_id: laborCode.id,
      labor_sku: laborCode.labor_sku,
      description: laborCode.description,
      rate: rate,
      quantity: 0,
      calculated_cost: 0,
      adjustment: 0,
      total_cost: 0,
      is_manual: true,
    };
    setLaborRows(prev => [...prev, newRow]);
    showSuccess(`Added ${laborCode.description}`);
  };

  // Remove manual material
  const handleRemoveMaterial = (materialId: string) => {
    setMaterialRows(prev => prev.filter(m => m.material_id !== materialId || !m.is_manual));
  };

  // Remove manual labor
  const handleRemoveLabor = (laborCodeId: string) => {
    setLaborRows(prev => prev.filter(l => l.labor_code_id !== laborCodeId || !l.is_manual));
  };

  // Save project mutation
  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'ready') => {
      if (!projectName.trim()) throw new Error('Project name is required');
      if (!businessUnitId) throw new Error('Business unit is required');

      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('bom_projects')
        .insert({
          project_name: projectName.trim(),
          customer_name: customerName.trim() || null,
          business_unit_id: businessUnitId,
          yard_id: yardId || null,
          expected_pickup_date: expectedPickupDate || null,
          notes: projectNotes.trim() || null,
          status,
          total_linear_feet: totals.footage,
          total_material_cost: totals.material,
          total_labor_cost: totals.labor,
          total_calculated_cost: totals.calculatedTotal,
          total_adjustment_amount: totals.adjustments,
          total_project_cost: totals.total,
          cost_per_foot: totals.perFoot,
          adjustment_flagged: Math.abs(totals.adjustments) > 500 || (totals.calculatedTotal > 0 && Math.abs(totals.adjustments / totals.calculatedTotal) > 0.05),
          created_by: userId,
          updated_by: userId,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // 2. Create line items
      const lineItemInserts = lineItems
        .filter(item => item.productId && item.netLength > 0)
        .map((item, idx) => {
          const product =
            item.fenceType === 'wood_vertical' ? products.woodVertical.find(p => p.id === item.productId) :
            item.fenceType === 'wood_horizontal' ? products.woodHorizontal.find(p => p.id === item.productId) :
            products.iron.find(p => p.id === item.productId);

          return {
            project_id: project.id,
            fence_type: item.fenceType,
            product_id: item.productId,
            product_sku_code: product?.sku_code || '',
            product_name: product?.sku_name || item.productName,
            total_footage: item.totalFootage,
            buffer: item.buffer,
            net_length: item.netLength,
            number_of_lines: item.numberOfLines,
            number_of_gates: item.numberOfGates,
            sort_order: idx,
          };
        });

      if (lineItemInserts.length > 0) {
        const { error: lineError } = await supabase
          .from('project_line_items')
          .insert(lineItemInserts);
        if (lineError) throw lineError;
      }

      // 3. Create project materials
      const materialInserts = materialRows.map(mat => ({
        project_id: project.id,
        material_id: mat.material_id,
        calculated_quantity: mat.calculated_qty,
        rounded_quantity: mat.rounded_qty,
        manual_quantity: mat.adjustment !== 0 ? mat.total_qty : null,
        unit_cost: mat.unit_cost,
        adjustment_amount: mat.adjustment,
        calculated_extended_cost: mat.rounded_qty * mat.unit_cost,
        adjusted_extended_cost: mat.total_cost,
        is_manual_addition: mat.is_manual,
      }));

      if (materialInserts.length > 0) {
        const { error: matError } = await supabase
          .from('project_materials')
          .insert(materialInserts);
        if (matError) throw matError;
      }

      // 4. Create project labor
      const laborInserts = laborRows.map(lab => ({
        project_id: project.id,
        labor_code_id: lab.labor_code_id,
        calculated_quantity: lab.quantity,
        manual_quantity: null,
        labor_rate: lab.rate,
        adjustment_amount: lab.adjustment,
        calculated_extended_cost: lab.calculated_cost,
        adjusted_extended_cost: lab.total_cost,
        is_manual_addition: lab.is_manual,
      }));

      if (laborInserts.length > 0) {
        const { error: labError } = await supabase
          .from('project_labor')
          .insert(laborInserts);
        if (labError) throw labError;
      }

      return project;
    },
    onSuccess: (_, status) => {
      showSuccess(status === 'draft' ? 'Draft saved' : 'Project saved');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
      // Reset form for new project
      setProjectName('');
      setCustomerName('');
      setProjectNotes('');
      setExpectedPickupDate('');
      setLineItems([{
        id: `line-${Date.now()}`,
        fenceType: 'wood_vertical',
        productId: '',
        productName: '',
        postType: 'WOOD',
        totalFootage: 0,
        buffer: 5,
        numberOfLines: 1,
        numberOfGates: 0,
        netLength: 0,
        sortOrder: 0,
      }]);
      setMaterialRows([]);
      setLaborRows([]);
    },
    onError: (err: Error) => {
      showError(err.message);
    },
  });

  const handleSave = (status: 'draft' | 'ready') => {
    saveMutation.mutate(status);
  };

  const formatCurrency = (num: number) => '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className={hideHeader ? "h-full flex flex-col bg-gray-50 overflow-hidden" : "min-h-screen flex flex-col bg-gray-50"}>
      {/* TOP SECTION - Project Info & Summary Metrics */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex gap-6">
          {/* Project Details */}
          <div className="flex-1 grid grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Project Name *</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Customer</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Business Unit *</label>
              <select
                value={businessUnitId}
                onChange={(e) => setBusinessUnitId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Yard</label>
              <select
                value={yardId}
                onChange={(e) => setYardId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {yards.map(y => (
                  <option key={y.id} value={y.id}>{y.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Expected Pickup</label>
              <input
                type="date"
                value={expectedPickupDate}
                onChange={(e) => setExpectedPickupDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Save Buttons */}
          <div className="flex gap-2 items-end">
            <button
              onClick={() => handleSave('draft')}
              disabled={saveMutation.isPending || !projectName.trim()}
              className="px-4 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300 text-sm font-medium"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave('ready')}
              disabled={saveMutation.isPending || !projectName.trim()}
              className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 text-sm font-medium"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Project
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-6 gap-3 mt-4">
          <div className="bg-green-50 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-green-600 font-medium uppercase">Total Material</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totals.material)}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-purple-600 font-medium uppercase">Total Labor</div>
            <div className="text-lg font-bold text-purple-700">{formatCurrency(totals.labor)}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-blue-600 font-medium uppercase">Project Total</div>
            <div className="text-lg font-bold text-blue-700">{formatCurrency(totals.total)}</div>
          </div>
          <div className="bg-gray-100 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-600 font-medium uppercase">Total Footage</div>
            <div className="text-lg font-bold text-gray-700">{totals.footage.toLocaleString()} ft</div>
          </div>
          <div className="bg-gray-100 rounded-lg p-2.5 text-center">
            <div className="text-[10px] text-gray-600 font-medium uppercase">$/Foot</div>
            <div className="text-lg font-bold text-gray-700">{formatCurrency(totals.perFoot)}</div>
          </div>
          <div className={`rounded-lg p-2.5 text-center ${totals.adjustments !== 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <div className="text-[10px] text-amber-600 font-medium uppercase">Adjustments</div>
            <div className={`text-lg font-bold ${totals.adjustments > 0 ? 'text-red-600' : totals.adjustments < 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {totals.adjustments >= 0 ? '+' : ''}{formatCurrency(totals.adjustments)}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION - SKU Lines (Left 50%) & BOM/BOL (Right 50%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - SKU Lines */}
        <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900 text-sm">SKU Lines</h3>
            <button
              onClick={handleAddLine}
              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Line
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {lineItems.map((item, idx) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-4">{idx + 1}</span>
                  <select
                    value={item.fenceType}
                    onChange={(e) => handleUpdateLine(item.id, {
                      fenceType: e.target.value as any,
                      productId: '',
                      productName: '',
                    })}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                  >
                    <option value="wood_vertical">Wood Vert</option>
                    <option value="wood_horizontal">Wood Horiz</option>
                    <option value="iron">Iron</option>
                  </select>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => handleRemoveLine(item.id)}
                      className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <SKUSearch
                  value={item.productId}
                  onChange={(productId, productName, postType) => {
                    handleUpdateLine(item.id, { productId, productName, postType });
                  }}
                  fenceType={item.fenceType}
                  products={products}
                />

                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <label className="block text-[10px] text-gray-500">Footage</label>
                    <input
                      type="number"
                      value={item.totalFootage || ''}
                      onChange={(e) => handleUpdateLine(item.id, { totalFootage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500">Buffer</label>
                    <input
                      type="number"
                      value={item.buffer || ''}
                      onChange={(e) => handleUpdateLine(item.id, { buffer: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500">Lines</label>
                    <select
                      value={item.numberOfLines}
                      onChange={(e) => handleUpdateLine(item.id, { numberOfLines: parseInt(e.target.value) })}
                      className="w-full px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500">Gates</label>
                    <select
                      value={item.numberOfGates}
                      onChange={(e) => handleUpdateLine(item.id, { numberOfGates: parseInt(e.target.value) })}
                      className="w-full px-1 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                    >
                      {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="text-xs text-gray-600 pt-1">
                  Net: <span className="font-semibold text-gray-900">{item.netLength} ft</span>
                </div>
              </div>
            ))}

            {/* Notes at the bottom of SKU panel */}
            <div className="pt-3 border-t border-gray-200">
              <label className="block text-xs text-gray-600 mb-1">Notes</label>
              <textarea
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Project notes..."
              />
            </div>
          </div>
        </div>

        {/* Right Panel - BOM & BOL */}
        <div className="w-1/2 flex flex-col overflow-hidden">

        {/* BOM & BOL Tables */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Materials (BOM) */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Materials (BOM)</h3>
              <button
                onClick={() => setShowAddMaterialModal(true)}
                className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Material
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left py-2 px-3 font-medium">Material</th>
                    <th className="text-right py-2 px-3 font-medium w-20">Cost</th>
                    <th className="text-right py-2 px-3 font-medium w-16">Calc</th>
                    <th className="text-center py-2 px-3 font-medium w-20">Adj</th>
                    <th className="text-right py-2 px-3 font-medium w-16">Total</th>
                    <th className="text-right py-2 px-3 font-medium w-24">Total Cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materialRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        Add SKUs and footage to see materials
                      </td>
                    </tr>
                  ) : (
                    materialRows.map(mat => (
                      <tr key={mat.material_id} className={`hover:bg-gray-50 ${mat.is_manual ? 'bg-blue-50' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <div className="font-medium text-gray-900">{mat.material_name}</div>
                            {mat.is_manual && <span className="text-[10px] bg-blue-200 text-blue-700 px-1 rounded">Manual</span>}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{mat.material_sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(mat.unit_cost)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{mat.is_manual ? '-' : mat.rounded_qty}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={mat.is_manual ? (mat.total_qty || '') : (mat.adjustment || '')}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              if (mat.is_manual) {
                                // For manual entries, set total_qty directly
                                setMaterialRows(rows => rows.map(r =>
                                  r.material_id === mat.material_id
                                    ? { ...r, total_qty: Math.max(0, val), total_cost: Math.max(0, val) * r.unit_cost }
                                    : r
                                ));
                              } else {
                                handleMaterialAdjustment(mat.material_id, val);
                              }
                            }}
                            className={`w-full px-2 py-1 text-xs text-center border rounded ${mat.adjustment !== 0 || mat.is_manual ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
                            placeholder={mat.is_manual ? 'Qty' : '0'}
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">{mat.total_qty}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${mat.adjustment !== 0 || mat.is_manual ? 'text-amber-600' : 'text-green-600'}`}>
                          {formatCurrency(mat.total_cost)}
                        </td>
                        <td className="py-2 px-1">
                          {mat.is_manual && (
                            <button
                              onClick={() => handleRemoveMaterial(mat.material_id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {materialRows.length > 0 && (
                  <tfoot className="bg-green-50">
                    <tr>
                      <td colSpan={6} className="py-2 px-3 text-right font-semibold text-gray-700">Material Total:</td>
                      <td className="py-2 px-3 text-right font-bold text-green-700">{formatCurrency(totals.material)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Labor (BOL) */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Labor (BOL)</h3>
              <button
                onClick={() => setShowAddLaborModal(true)}
                className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Labor
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left py-2 px-3 font-medium">Labor</th>
                    <th className="text-right py-2 px-3 font-medium w-20">Rate</th>
                    <th className="text-right py-2 px-3 font-medium w-16">Qty</th>
                    <th className="text-right py-2 px-3 font-medium w-24">Calc Cost</th>
                    <th className="text-center py-2 px-3 font-medium w-24">Adj ($)</th>
                    <th className="text-right py-2 px-3 font-medium w-24">Total Cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {laborRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400">
                        Add SKUs and footage to see labor
                      </td>
                    </tr>
                  ) : (
                    laborRows.map(lab => (
                      <tr key={lab.labor_code_id} className={`hover:bg-gray-50 ${lab.is_manual ? 'bg-purple-50' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <div className="font-medium text-gray-900">{lab.description}</div>
                            {lab.is_manual && <span className="text-[10px] bg-purple-200 text-purple-700 px-1 rounded">Manual</span>}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{lab.labor_sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(lab.rate)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{lab.is_manual ? '-' : lab.quantity.toFixed(1)}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{lab.is_manual ? '-' : formatCurrency(lab.calculated_cost)}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={lab.is_manual ? (lab.total_cost || '') : (lab.adjustment || '')}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (lab.is_manual) {
                                // For manual entries, set total_cost directly
                                setLaborRows(rows => rows.map(r =>
                                  r.labor_code_id === lab.labor_code_id
                                    ? { ...r, total_cost: val }
                                    : r
                                ));
                              } else {
                                handleLaborAdjustment(lab.labor_code_id, val);
                              }
                            }}
                            className={`w-full px-2 py-1 text-xs text-center border rounded ${lab.adjustment !== 0 || lab.is_manual ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}
                            placeholder={lab.is_manual ? '$' : '0'}
                            step="0.01"
                          />
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold ${lab.adjustment !== 0 || lab.is_manual ? 'text-amber-600' : 'text-purple-600'}`}>
                          {formatCurrency(lab.total_cost)}
                        </td>
                        <td className="py-2 px-1">
                          {lab.is_manual && (
                            <button
                              onClick={() => handleRemoveLabor(lab.labor_code_id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {laborRows.length > 0 && (
                  <tfoot className="bg-purple-50">
                    <tr>
                      <td colSpan={6} className="py-2 px-3 text-right font-semibold text-gray-700">Labor Total:</td>
                      <td className="py-2 px-3 text-right font-bold text-purple-700">{formatCurrency(totals.labor)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Add Material Modal */}
      <AddMaterialModal
        isOpen={showAddMaterialModal}
        onClose={() => setShowAddMaterialModal(false)}
        materials={allMaterials}
        existingMaterialIds={new Set(materialRows.map(m => m.material_id))}
        onAdd={handleAddManualMaterial}
      />

      {/* Add Labor Modal */}
      <AddLaborModal
        isOpen={showAddLaborModal}
        onClose={() => setShowAddLaborModal(false)}
        laborCodes={allLaborCodes}
        laborRates={laborRates}
        existingLaborIds={new Set(laborRows.map(l => l.labor_code_id))}
        onAdd={handleAddManualLabor}
      />
    </div>
  );
}
