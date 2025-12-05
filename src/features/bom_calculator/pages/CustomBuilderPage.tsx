import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, RotateCcw, AlertTriangle, Trash2, Plus, ArrowLeft, Wrench
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type {
  Material,
  LaborCode,
  LaborRateWithDetails,
  CustomProductWithDetails,
  UnitBasis,
} from '../database.types';

const UNIT_BASIS_OPTIONS: { value: UnitBasis; label: string; description: string }[] = [
  { value: 'LF', label: 'Linear Feet', description: 'Per linear foot of work' },
  { value: 'SF', label: 'Square Feet', description: 'Per square foot of area' },
  { value: 'EA', label: 'Each / Unit', description: 'Per item or unit' },
  { value: 'PROJECT', label: 'Project', description: 'Flat rate per project' },
];

const CATEGORY_OPTIONS = [
  { value: 'Service', label: 'Service' },
  { value: 'Add-On', label: 'Add-On' },
  { value: 'Repair', label: 'Repair' },
  { value: 'Upgrade', label: 'Upgrade' },
  { value: 'Miscellaneous', label: 'Miscellaneous' },
];

interface MaterialLineItem {
  id: string;
  material_id: string;
  quantity_per_unit: number;
}

interface LaborLineItem {
  id: string;
  labor_code_id: string;
  quantity_per_unit: number;
}

interface SelectedSKU {
  id: string;
  type: 'custom';
}

interface CustomBuilderPageProps {
  selectedSKU?: SelectedSKU | null;
  onClearSelection?: () => void;
}

// Helper to truncate text
const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export default function CustomBuilderPage({ selectedSKU, onClearSelection }: CustomBuilderPageProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Basic info
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [unitBasis, setUnitBasis] = useState<UnitBasis>('LF');
  const [category, setCategory] = useState('Service');
  const [description, setDescription] = useState('');

  // Line items
  const [materialItems, setMaterialItems] = useState<MaterialLineItem[]>([]);
  const [laborItems, setLaborItems] = useState<LaborLineItem[]>([]);

  // Preview parameters
  const [previewQuantity, setPreviewQuantity] = useState(100);
  const [previewBusinessUnitId, setPreviewBusinessUnitId] = useState('');

  // Load selected SKU data
  useEffect(() => {
    if (!selectedSKU || selectedSKU.type !== 'custom') {
      setEditingId(null);
      return;
    }

    const loadSKU = async () => {
      try {
        const { data, error } = await supabase
          .from('custom_products')
          .select(`
            *,
            materials:custom_product_materials(
              id,
              material_id,
              quantity_per_unit
            ),
            labor:custom_product_labor(
              id,
              labor_code_id,
              quantity_per_unit
            )
          `)
          .eq('id', selectedSKU.id)
          .single();

        if (error) throw error;

        const product = data as CustomProductWithDetails;
        setSkuCode(product.sku_code);
        setSkuName(product.sku_name);
        setUnitBasis(product.unit_basis);
        setCategory(product.category || 'Service');
        setDescription(product.product_description || '');

        // Map material items
        setMaterialItems(
          (product.materials || []).map((m: { id: string; material_id: string; quantity_per_unit: number }) => ({
            id: m.id,
            material_id: m.material_id,
            quantity_per_unit: m.quantity_per_unit,
          }))
        );

        // Map labor items
        setLaborItems(
          (product.labor || []).map((l: { id: string; labor_code_id: string; quantity_per_unit: number }) => ({
            id: l.id,
            labor_code_id: l.labor_code_id,
            quantity_per_unit: l.quantity_per_unit,
          }))
        );

        setEditingId(selectedSKU.id);
      } catch (err) {
        console.error('Error loading custom SKU:', err);
        showError('Failed to load custom product');
      }
    };

    loadSKU();
  }, [selectedSKU]);

  // Fetch materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['materials-for-custom-builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('status', 'Active')
        .order('category')
        .order('material_name');
      if (error) throw error;
      return data as Material[];
    },
  });

  // Fetch labor codes
  const { data: laborCodes = [], isLoading: loadingLaborCodes } = useQuery({
    queryKey: ['labor-codes-for-custom-builder'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labor_codes')
        .select('*')
        .eq('is_active', true)
        .order('labor_sku');
      if (error) throw error;
      return data as LaborCode[];
    },
  });

  // Fetch business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-custom'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      if (data && data.length > 0 && !previewBusinessUnitId) {
        setPreviewBusinessUnitId(data[0].id);
      }
      return data;
    },
  });

  // Fetch labor rates for selected BU
  const { data: laborRates = [] } = useQuery({
    queryKey: ['labor-rates-with-details', previewBusinessUnitId],
    queryFn: async () => {
      if (!previewBusinessUnitId) return [];
      const { data, error } = await supabase
        .from('labor_rates')
        .select(`
          *,
          labor_code:labor_codes(*),
          business_unit:business_units(*)
        `)
        .eq('business_unit_id', previewBusinessUnitId);
      if (error) throw error;
      return data as LaborRateWithDetails[];
    },
    enabled: !!previewBusinessUnitId,
  });

  // Helper to get material by ID
  const getMaterial = (id: string): Material | undefined =>
    materials.find(m => m.id === id);

  // Helper to get labor code by ID
  const getLaborCode = (id: string): LaborCode | undefined =>
    laborCodes.find(l => l.id === id);

  // Helper to get labor rate for a code
  const getLaborRate = (laborCodeId: string): number => {
    const rate = laborRates.find(r => r.labor_code_id === laborCodeId);
    return rate?.rate || 0;
  };

  // Add material line item
  const addMaterialItem = () => {
    setMaterialItems([
      ...materialItems,
      { id: `temp-${Date.now()}`, material_id: '', quantity_per_unit: 1 },
    ]);
  };

  // Remove material line item
  const removeMaterialItem = (index: number) => {
    setMaterialItems(materialItems.filter((_, i) => i !== index));
  };

  // Update material line item
  const updateMaterialItem = (index: number, field: keyof MaterialLineItem, value: string | number) => {
    setMaterialItems(
      materialItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Add labor line item
  const addLaborItem = () => {
    setLaborItems([
      ...laborItems,
      { id: `temp-${Date.now()}`, labor_code_id: '', quantity_per_unit: 1 },
    ]);
  };

  // Remove labor line item
  const removeLaborItem = (index: number) => {
    setLaborItems(laborItems.filter((_, i) => i !== index));
  };

  // Update labor line item
  const updateLaborItem = (index: number, field: keyof LaborLineItem, value: string | number) => {
    setLaborItems(
      laborItems.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Calculate cost preview
  const costPreview = useMemo(() => {
    let materialCost = 0;
    let laborCost = 0;

    // Calculate material cost per unit
    for (const item of materialItems) {
      const mat = getMaterial(item.material_id);
      if (mat) {
        materialCost += item.quantity_per_unit * mat.unit_cost;
      }
    }

    // Calculate labor cost per unit
    for (const item of laborItems) {
      const rate = getLaborRate(item.labor_code_id);
      laborCost += item.quantity_per_unit * rate;
    }

    const costPerUnit = materialCost + laborCost;
    const totalCost = costPerUnit * previewQuantity;
    const totalMaterialCost = materialCost * previewQuantity;
    const totalLaborCost = laborCost * previewQuantity;

    return {
      materialCostPerUnit: materialCost,
      laborCostPerUnit: laborCost,
      costPerUnit,
      totalCost,
      totalMaterialCost,
      totalLaborCost,
    };
  }, [materialItems, laborItems, materials, laborRates, previewQuantity]);

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setSkuCode('');
    setSkuName('');
    setUnitBasis('LF');
    setCategory('Service');
    setDescription('');
    setMaterialItems([]);
    setLaborItems([]);
    onClearSelection?.();
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!skuCode) throw new Error('SKU code is required');
      if (!skuName) throw new Error('SKU name is required');

      const isEditing = !!editingId;

      // Prepare product data
      const productPayload = {
        sku_code: skuCode,
        sku_name: skuName,
        unit_basis: unitBasis,
        category,
        product_description: description || null,
        standard_material_cost: costPreview.materialCostPerUnit,
        standard_labor_cost: costPreview.laborCostPerUnit,
        standard_cost_per_unit: costPreview.costPerUnit,
        standard_cost_calculated_at: new Date().toISOString(),
      };

      let productId = editingId;

      if (isEditing) {
        // Update existing product
        const { error } = await supabase
          .from('custom_products')
          .update(productPayload)
          .eq('id', editingId);
        if (error) throw error;

        // Delete existing material and labor associations
        await supabase.from('custom_product_materials').delete().eq('custom_product_id', editingId);
        await supabase.from('custom_product_labor').delete().eq('custom_product_id', editingId);
      } else {
        // Insert new product
        const { data, error } = await supabase
          .from('custom_products')
          .insert({ ...productPayload, is_active: true })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id;
      }

      // Insert material associations
      if (materialItems.length > 0) {
        const validMaterials = materialItems.filter(m => m.material_id);
        if (validMaterials.length > 0) {
          const { error } = await supabase.from('custom_product_materials').insert(
            validMaterials.map(m => ({
              custom_product_id: productId,
              material_id: m.material_id,
              quantity_per_unit: m.quantity_per_unit,
            }))
          );
          if (error) throw error;
        }
      }

      // Insert labor associations
      if (laborItems.length > 0) {
        const validLabor = laborItems.filter(l => l.labor_code_id);
        if (validLabor.length > 0) {
          const { error } = await supabase.from('custom_product_labor').insert(
            validLabor.map(l => ({
              custom_product_id: productId,
              labor_code_id: l.labor_code_id,
              quantity_per_unit: l.quantity_per_unit,
            }))
          );
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      showSuccess(editingId ? 'Custom product updated' : 'Custom product saved');
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products-catalog'] });
      if (editingId) {
        onClearSelection?.();
        setEditingId(null);
      }
      resetForm();
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to save custom product');
    },
  });

  // Number formatting
  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  if (loadingMaterials || loadingLaborCodes) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden h-full">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editingId && (
            <button
              onClick={resetForm}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="New Custom Product"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-purple-600" />
            <div>
              <h1 className="text-base font-bold text-gray-900">
                {editingId ? 'Edit Custom Product' : 'Custom Builder'}
              </h1>
              {editingId && <p className="text-xs text-purple-600">{skuCode}</p>}
            </div>
          </div>
        </div>

        {/* Test Parameters & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Test:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={previewQuantity}
                onChange={(e) => setPreviewQuantity(Number(e.target.value) || 0)}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <span className="text-gray-400">{unitBasis}</span>
            </div>
            <select
              value={previewBusinessUnitId}
              onChange={(e) => setPreviewBusinessUnitId(e.target.value)}
              className="w-24 px-1 py-1 border border-gray-300 rounded text-xs"
            >
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.code}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-gray-300" />

          <button
            onClick={resetForm}
            className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !skuCode || !skuName}
            className={`px-3 py-1.5 text-white rounded text-xs font-medium flex items-center gap-1.5 disabled:bg-gray-400 ${
              editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {editingId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* Cost Summary Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex gap-3">
          <div className="bg-purple-600 text-white rounded-lg px-4 py-2 text-center min-w-[120px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Cost/{unitBasis}</div>
            <div className="text-xl font-bold">${formatNumber(costPreview.costPerUnit)}</div>
          </div>
          <div className="bg-green-600 text-white rounded-lg px-4 py-2 text-center min-w-[120px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Total ({previewQuantity} {unitBasis})</div>
            <div className="text-xl font-bold">${formatNumber(costPreview.totalCost)}</div>
          </div>
          <div className="bg-amber-500 text-white rounded-lg px-4 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Material</div>
            <div className="text-lg font-bold">${formatNumber(costPreview.materialCostPerUnit)}</div>
          </div>
          <div className="bg-blue-500 text-white rounded-lg px-4 py-2 text-center min-w-[100px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Labor</div>
            <div className="text-lg font-bold">${formatNumber(costPreview.laborCostPerUnit)}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Basic Info Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">SKU Code</label>
                <input
                  type="text"
                  value={skuCode}
                  onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
                  placeholder="TOFO"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">SKU Name</label>
                <input
                  type="text"
                  value={skuName}
                  onChange={(e) => setSkuName(e.target.value)}
                  placeholder="Tear Out & Haul Off"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Unit Basis</label>
                <select
                  value={unitBasis}
                  onChange={(e) => setUnitBasis(e.target.value as UnitBasis)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                >
                  {UNIT_BASIS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Materials Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Materials (Optional)
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-amber-700">
                  Subtotal: ${formatNumber(costPreview.totalMaterialCost)}
                </span>
                <button
                  onClick={addMaterialItem}
                  className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-amber-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>

            {materialItems.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500 italic">
                No materials added - this will be a labor-only product
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[10px] text-gray-500 uppercase">
                    <th className="text-left py-2 px-3">Material</th>
                    <th className="text-right py-2 px-2 w-20">Qty/{unitBasis}</th>
                    <th className="text-right py-2 px-2 w-20">Unit Cost</th>
                    <th className="text-right py-2 px-2 w-24">Test Qty</th>
                    <th className="text-right py-2 px-2 w-24">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {materialItems.map((item, index) => {
                    const mat = getMaterial(item.material_id);
                    const totalQty = item.quantity_per_unit * previewQuantity;
                    const totalCost = mat ? totalQty * mat.unit_cost : 0;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <select
                            value={item.material_id}
                            onChange={(e) => updateMaterialItem(index, 'material_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                          >
                            <option value="">Select material...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.material_sku} - {truncate(m.material_name, 35)} (${m.unit_cost.toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={item.quantity_per_unit}
                            onChange={(e) => updateMaterialItem(index, 'quantity_per_unit', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                            step="0.1"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          {mat ? `$${mat.unit_cost.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          {mat ? Math.ceil(totalQty).toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-amber-600">
                          {mat ? `$${formatNumber(totalCost)}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => removeMaterialItem(index)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Labor Card */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                Labor Codes
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-blue-700">
                  Subtotal: ${formatNumber(costPreview.totalLaborCost)}
                </span>
                <button
                  onClick={addLaborItem}
                  className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>

            {laborItems.length === 0 ? (
              <div className="px-4 py-3 flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Add at least one labor code for this product
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-[10px] text-gray-500 uppercase">
                    <th className="text-left py-2 px-3">Labor Code</th>
                    <th className="text-right py-2 px-2 w-20">Qty/{unitBasis}</th>
                    <th className="text-right py-2 px-2 w-20">Rate</th>
                    <th className="text-right py-2 px-2 w-24">Test Qty</th>
                    <th className="text-right py-2 px-2 w-24">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {laborItems.map((item, index) => {
                    const laborCode = getLaborCode(item.labor_code_id);
                    const rate = getLaborRate(item.labor_code_id);
                    const totalQty = item.quantity_per_unit * previewQuantity;
                    const totalCost = totalQty * rate;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <select
                            value={item.labor_code_id}
                            onChange={(e) => updateLaborItem(index, 'labor_code_id', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                          >
                            <option value="">Select labor code...</option>
                            {laborCodes.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.labor_sku} - {truncate(l.description, 40)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            value={item.quantity_per_unit}
                            onChange={(e) => updateLaborItem(index, 'quantity_per_unit', parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                            step="0.1"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          {laborCode && rate > 0 ? `$${rate.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-600">
                          {laborCode ? totalQty.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-blue-600">
                          {laborCode ? `$${formatNumber(totalCost)}` : '-'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => removeLaborItem(index)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
