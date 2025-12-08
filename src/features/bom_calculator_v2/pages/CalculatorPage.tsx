/**
 * Calculator Page - v2
 *
 * Main BOM/BOL estimation engine using the new component-based architecture.
 * Supports multiple line items, adjustments, and project saving.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Loader2, Save, Search, Calculator, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { getCalculator, hasCalculator } from '../calculators';
import type { ProductSKUWithDetails, CalculationInput } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface LineItem {
  id: string;
  productTypeId: string;
  productTypeName: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  postType: 'WOOD' | 'STEEL';
  totalFootage: number;
  buffer: number;
  numberOfLines: number;
  numberOfGates: number;
  netLength: number;
  sortOrder: number;
}

interface MaterialRow {
  material_id: string;
  material_sku: string;
  material_name: string;
  component_code: string;
  unit_cost: number;
  calculated_qty: number;
  rounded_qty: number;
  adjustment: number;
  total_qty: number;
  total_cost: number;
  is_manual: boolean;
}

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

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

interface Yard {
  id: string;
  code: string;
  name: string;
  city: string;
}

interface ProductType {
  id: string;
  code: string;
  name: string;
}

interface SKUOption {
  id: string;
  sku_code: string;
  sku_name: string;
  product_type_id: string;
  post_type: 'WOOD' | 'STEEL';
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CalculatorPageProps {
  userId?: string;
  initialProjectId?: string;  // TODO: Implement loading existing projects
  duplicateMode?: boolean;     // TODO: Implement duplicate mode
  onProjectSaved?: (projectId: string) => void;
}

export function CalculatorPage({
  userId,
  initialProjectId: _initialProjectId,
  duplicateMode: _duplicateMode = false,
  onProjectSaved,
}: CalculatorPageProps) {
  const queryClient = useQueryClient();

  // Project state
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [yardId, setYardId] = useState('');
  const [expectedPickupDate, _setExpectedPickupDate] = useState('');
  const [projectNotes, _setProjectNotes] = useState('');

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // BOM/BOL with adjustments
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);
  const [laborRows, setLaborRows] = useState<LaborRow[]>([]);

  // UI state
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [expandedLineItem, setExpandedLineItem] = useState<string | null>(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  // Business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-calc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as BusinessUnit[];
    },
  });

  // Yards
  const { data: yards = [] } = useQuery({
    queryKey: ['yards-calc'],
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

  // Product types
  const { data: productTypes = [] } = useQuery({
    queryKey: ['product-types-calc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_types')
        .select('id, code, name')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as ProductType[];
    },
  });

  // All SKUs for dropdown (excluding archived)
  const { data: allSKUs = [] } = useQuery({
    queryKey: ['all-skus-calc'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_skus')
        .select('id, sku_code, sku_name, product_type_id, post_type')
        .eq('is_active', true)
        .is('archived_at', null)
        .order('sku_code');
      if (error) throw error;
      return data as SKUOption[];
    },
  });

  // =============================================================================
  // DEFAULTS
  // =============================================================================

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

  // =============================================================================
  // LINE ITEM MANAGEMENT
  // =============================================================================

  const addLineItem = () => {
    const defaultType = productTypes[0];
    if (!defaultType) return;

    const newItem: LineItem = {
      id: `line-${Date.now()}`,
      productTypeId: defaultType.id,
      productTypeName: defaultType.name,
      skuId: '',
      skuCode: '',
      skuName: '',
      postType: 'WOOD',
      totalFootage: 100,
      buffer: 5,
      numberOfLines: 1,
      numberOfGates: 0,
      netLength: 95,
      sortOrder: lineItems.length,
    };

    setLineItems([...lineItems, newItem]);
    setExpandedLineItem(newItem.id);
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(items =>
      items.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // Recalculate net length
        if ('totalFootage' in updates || 'buffer' in updates) {
          updated.netLength = Math.max(0, updated.totalFootage - updated.buffer);
        }

        return updated;
      })
    );
  };

  const removeLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id));
  };

  const selectSKU = (lineItemId: string, sku: SKUOption) => {
    const productType = productTypes.find(t => t.id === sku.product_type_id);
    updateLineItem(lineItemId, {
      skuId: sku.id,
      skuCode: sku.sku_code,
      skuName: sku.sku_name,
      productTypeId: sku.product_type_id,
      productTypeName: productType?.name || '',
      postType: sku.post_type,
    });
  };

  // =============================================================================
  // CALCULATION
  // =============================================================================

  const runCalculation = useCallback(async () => {
    if (!businessUnitId || lineItems.length === 0) return;

    // Check if all line items have SKUs
    const validItems = lineItems.filter(item => item.skuId);
    if (validItems.length === 0) return;

    setIsCalculating(true);

    try {
      const allMaterials: MaterialRow[] = [];
      const allLabor: LaborRow[] = [];

      for (const item of validItems) {
        // Find product type code
        const productType = productTypes.find(t => t.id === item.productTypeId);
        if (!productType || !hasCalculator(productType.code)) {
          console.warn(`No calculator for product type: ${productType?.code}`);
          continue;
        }

        // Load full SKU with details
        const { data: skuData } = await supabase
          .from('product_skus')
          .select(`
            *,
            product_type:product_types(*),
            product_style:product_styles(*),
            components:sku_components_v2(
              component:component_definitions_v2(*),
              material:materials(*)
            )
          `)
          .eq('id', item.skuId)
          .single();

        if (!skuData) continue;

        // Transform to expected format
        const sku: ProductSKUWithDetails = {
          ...skuData,
          product_type: skuData.product_type,
          product_style: skuData.product_style,
          components: skuData.components.map((c: any) => ({
            component: c.component,
            material: c.material,
          })),
        };

        // Build calculation input
        const input: CalculationInput = {
          netLength: item.netLength,
          numberOfLines: item.numberOfLines,
          numberOfGates: item.numberOfGates,
          businessUnitId,
        };

        // Run calculator
        const calculator = getCalculator(productType.code);
        const result = await calculator.calculate(sku, input);

        // Merge materials
        for (const mat of result.materials) {
          const existing = allMaterials.find(m => m.material_id === mat.material_id);
          if (existing) {
            existing.calculated_qty += mat.quantity;
            existing.rounded_qty = Math.ceil(existing.calculated_qty);
            existing.total_qty = existing.rounded_qty + existing.adjustment;
            existing.total_cost = existing.total_qty * existing.unit_cost;
          } else {
            allMaterials.push({
              material_id: mat.material_id,
              material_sku: mat.material_sku,
              material_name: mat.material_name,
              component_code: mat.component_code,
              unit_cost: mat.unit_cost,
              calculated_qty: mat.quantity,
              rounded_qty: Math.ceil(mat.quantity),
              adjustment: 0,
              total_qty: Math.ceil(mat.quantity),
              total_cost: Math.ceil(mat.quantity) * mat.unit_cost,
              is_manual: false,
            });
          }
        }

        // Merge labor
        for (const lab of result.labor) {
          const existing = allLabor.find(l => l.labor_code_id === lab.labor_code_id);
          if (existing) {
            existing.quantity += lab.quantity;
            existing.calculated_cost = existing.quantity * existing.rate;
            existing.total_cost = existing.calculated_cost + existing.adjustment;
          } else {
            allLabor.push({
              labor_code_id: lab.labor_code_id,
              labor_sku: lab.labor_sku,
              description: lab.description,
              rate: lab.rate,
              quantity: lab.quantity,
              calculated_cost: lab.quantity * lab.rate,
              adjustment: 0,
              total_cost: lab.quantity * lab.rate,
              is_manual: false,
            });
          }
        }
      }

      // Preserve existing adjustments
      setMaterialRows(prev => {
        return allMaterials.map(mat => {
          const existing = prev.find(m => m.material_id === mat.material_id);
          if (existing) {
            mat.adjustment = existing.adjustment;
            mat.total_qty = mat.rounded_qty + mat.adjustment;
            mat.total_cost = mat.total_qty * mat.unit_cost;
          }
          return mat;
        });
      });

      setLaborRows(prev => {
        return allLabor.map(lab => {
          const existing = prev.find(l => l.labor_code_id === lab.labor_code_id);
          if (existing) {
            lab.adjustment = existing.adjustment;
            lab.total_cost = lab.calculated_cost + lab.adjustment;
          }
          return lab;
        });
      });

    } catch (error) {
      console.error('Calculation error:', error);
      showError('Error running calculation');
    } finally {
      setIsCalculating(false);
    }
  }, [businessUnitId, lineItems, productTypes]);

  // Auto-calculate when line items change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      runCalculation();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [runCalculation]);

  // =============================================================================
  // ADJUSTMENTS
  // =============================================================================

  const updateMaterialAdjustment = (materialId: string, adjustment: number) => {
    setMaterialRows(rows =>
      rows.map(row => {
        if (row.material_id !== materialId) return row;
        const totalQty = row.rounded_qty + adjustment;
        return {
          ...row,
          adjustment,
          total_qty: totalQty,
          total_cost: totalQty * row.unit_cost,
        };
      })
    );
  };

  const updateLaborAdjustment = (laborCodeId: string, adjustment: number) => {
    setLaborRows(rows =>
      rows.map(row => {
        if (row.labor_code_id !== laborCodeId) return row;
        return {
          ...row,
          adjustment,
          total_cost: row.calculated_cost + adjustment,
        };
      })
    );
  };

  // =============================================================================
  // TOTALS
  // =============================================================================

  const totals = useMemo(() => {
    const materialTotal = materialRows.reduce((sum, r) => sum + r.total_cost, 0);
    const laborTotal = laborRows.reduce((sum, r) => sum + r.total_cost, 0);
    const totalFootage = lineItems.reduce((sum, i) => sum + i.netLength, 0);
    const projectTotal = materialTotal + laborTotal;
    const costPerFoot = totalFootage > 0 ? projectTotal / totalFootage : 0;

    const materialAdjustments = materialRows.reduce((sum, r) => sum + (r.adjustment * r.unit_cost), 0);
    const laborAdjustments = laborRows.reduce((sum, r) => sum + r.adjustment, 0);

    return {
      materialTotal,
      laborTotal,
      projectTotal,
      totalFootage,
      costPerFoot,
      totalAdjustments: materialAdjustments + laborAdjustments,
    };
  }, [materialRows, laborRows, lineItems]);

  // =============================================================================
  // SAVE PROJECT
  // =============================================================================

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectName.trim()) throw new Error('Project name is required');
      if (!businessUnitId) throw new Error('Business unit is required');

      const projectData = {
        project_name: projectName.trim(),
        customer_name: customerName.trim() || null,
        business_unit_id: businessUnitId,
        yard_id: yardId || null,
        expected_pickup_date: expectedPickupDate || null,
        notes: projectNotes.trim() || null,
        status: 'draft' as const,
        total_material_cost: totals.materialTotal,
        total_labor_cost: totals.laborTotal,
        total_cost: totals.projectTotal,
        created_by: userId || null,
      };

      let projectId: string;

      if (editingProjectId) {
        const { error } = await supabase
          .from('bom_projects')
          .update(projectData)
          .eq('id', editingProjectId);
        if (error) throw error;
        projectId = editingProjectId;
      } else {
        const { data, error } = await supabase
          .from('bom_projects')
          .insert(projectData)
          .select('id')
          .single();
        if (error) throw error;
        projectId = data.id;
      }

      // Delete existing line items, materials, labor
      await Promise.all([
        supabase.from('project_line_items').delete().eq('project_id', projectId),
        supabase.from('project_materials').delete().eq('project_id', projectId),
        supabase.from('project_labor').delete().eq('project_id', projectId),
      ]);

      // Insert line items
      if (lineItems.length > 0) {
        const lineItemsData = lineItems.map((item, idx) => ({
          project_id: projectId,
          fence_type: productTypes.find(t => t.id === item.productTypeId)?.code || 'wood-vertical',
          product_id: item.skuId || null,
          product_name: item.skuName,
          total_footage: item.totalFootage,
          buffer: item.buffer,
          net_length: item.netLength,
          number_of_lines: item.numberOfLines,
          number_of_gates: item.numberOfGates,
          sort_order: idx,
        }));

        const { error } = await supabase
          .from('project_line_items')
          .insert(lineItemsData);
        if (error) throw error;
      }

      // Insert materials
      if (materialRows.length > 0) {
        const materialsData = materialRows.map(row => ({
          project_id: projectId,
          material_id: row.material_id,
          calculated_qty: row.calculated_qty,
          rounded_qty: row.rounded_qty,
          adjustment: row.adjustment,
          total_qty: row.total_qty,
          unit_cost: row.unit_cost,
          total_cost: row.total_cost,
          is_manual: row.is_manual,
        }));

        const { error } = await supabase
          .from('project_materials')
          .insert(materialsData);
        if (error) throw error;
      }

      // Insert labor
      if (laborRows.length > 0) {
        const laborData = laborRows.map(row => ({
          project_id: projectId,
          labor_code_id: row.labor_code_id,
          quantity: row.quantity,
          rate: row.rate,
          calculated_cost: row.calculated_cost,
          adjustment: row.adjustment,
          total_cost: row.total_cost,
          is_manual: row.is_manual,
        }));

        const { error } = await supabase
          .from('project_labor')
          .insert(laborData);
        if (error) throw error;
      }

      return projectId;
    },
    onSuccess: (projectId) => {
      showSuccess(editingProjectId ? 'Project updated!' : 'Project saved!');
      queryClient.invalidateQueries({ queryKey: ['bom-projects'] });
      setEditingProjectId(projectId);
      onProjectSaved?.(projectId);
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to save project');
    },
  });

  // =============================================================================
  // FORMATTING
  // =============================================================================

  const formatCurrency = (num: number) =>
    '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // =============================================================================
  // RENDER
  // =============================================================================

  const loading = !businessUnits.length || !productTypes.length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading calculator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-gray-50 overflow-hidden h-full">
      {/* Left Panel - Line Items */}
      <div className="w-[450px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">Calculator</h1>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !projectName.trim()}
              className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>

          {/* Project Details */}
          <div className="space-y-2">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project Name *"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={businessUnitId}
                onChange={(e) => setBusinessUnitId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                {businessUnits.map(bu => (
                  <option key={bu.id} value={bu.id}>{bu.code} - {bu.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {lineItems.map((item, idx) => (
            <LineItemCard
              key={item.id}
              item={item}
              index={idx}
              isExpanded={expandedLineItem === item.id}
              productTypes={productTypes}
              allSKUs={allSKUs}
              onToggle={() => setExpandedLineItem(expandedLineItem === item.id ? null : item.id)}
              onUpdate={(updates) => updateLineItem(item.id, updates)}
              onSelectSKU={(sku) => selectSKU(item.id, sku)}
              onRemove={() => removeLineItem(item.id)}
            />
          ))}

          <button
            onClick={addLineItem}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>
      </div>

      {/* Right Panel - BOM/BOL */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Summary Stats */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-purple-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase opacity-80">Cost/Ft</div>
              <div className="text-lg font-bold">{formatCurrency(totals.costPerFoot)}</div>
            </div>
            <div className="bg-green-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase opacity-80">Total</div>
              <div className="text-lg font-bold">{formatCurrency(totals.projectTotal)}</div>
            </div>
            <div className="bg-amber-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase opacity-80">Materials</div>
              <div className="text-lg font-bold">{formatCurrency(totals.materialTotal)}</div>
            </div>
            <div className="bg-blue-500 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase opacity-80">Labor</div>
              <div className="text-lg font-bold">{formatCurrency(totals.laborTotal)}</div>
            </div>
            <div className="bg-gray-600 text-white rounded-lg px-3 py-2 text-center">
              <div className="text-[10px] uppercase opacity-80">Footage</div>
              <div className="text-lg font-bold">{totals.totalFootage.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Materials & Labor Tables */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isCalculating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-600">Calculating...</span>
            </div>
          )}

          {!isCalculating && lineItems.length === 0 && (
            <div className="text-center py-12">
              <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Add a line item to start calculating</p>
            </div>
          )}

          {!isCalculating && materialRows.length > 0 && (
            <>
              {/* Materials Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Materials (BOM)</h3>
                  <span className="font-semibold text-green-600">{formatCurrency(totals.materialTotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 px-3">Material</th>
                      <th className="text-right py-2 px-3 w-16">Calc</th>
                      <th className="text-right py-2 px-3 w-16">Rnd</th>
                      <th className="text-right py-2 px-3 w-20">Adj</th>
                      <th className="text-right py-2 px-3 w-16">Qty</th>
                      <th className="text-right py-2 px-3 w-20">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materialRows.map(row => (
                      <tr key={row.material_id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{row.material_name}</div>
                          <div className="text-xs text-gray-500">{row.material_sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-500">{row.calculated_qty.toFixed(1)}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{row.rounded_qty}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.adjustment}
                            onChange={(e) => updateMaterialAdjustment(row.material_id, Number(e.target.value))}
                            className={`w-16 px-2 py-1 border rounded text-right text-sm ${
                              row.adjustment !== 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{row.total_qty}</td>
                        <td className="py-2 px-3 text-right font-medium text-green-600">{formatCurrency(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Labor Table */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Labor (BOL)</h3>
                  <span className="font-semibold text-blue-600">{formatCurrency(totals.laborTotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 px-3">Labor</th>
                      <th className="text-right py-2 px-3 w-16">Qty</th>
                      <th className="text-right py-2 px-3 w-16">Rate</th>
                      <th className="text-right py-2 px-3 w-20">Calc</th>
                      <th className="text-right py-2 px-3 w-20">Adj $</th>
                      <th className="text-right py-2 px-3 w-20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {laborRows.map(row => (
                      <tr key={row.labor_code_id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{row.description}</div>
                          <div className="text-xs text-gray-500">{row.labor_sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">{row.quantity}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(row.rate)}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(row.calculated_cost)}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            value={row.adjustment}
                            onChange={(e) => updateLaborAdjustment(row.labor_code_id, Number(e.target.value))}
                            className={`w-16 px-2 py-1 border rounded text-right text-sm ${
                              row.adjustment !== 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                            }`}
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-blue-600">{formatCurrency(row.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LINE ITEM CARD COMPONENT
// =============================================================================

function LineItemCard({
  item,
  index,
  isExpanded,
  productTypes,
  allSKUs,
  onToggle,
  onUpdate,
  onSelectSKU,
  onRemove,
}: {
  item: LineItem;
  index: number;
  isExpanded: boolean;
  productTypes: ProductType[];
  allSKUs: SKUOption[];
  onToggle: () => void;
  onUpdate: (updates: Partial<LineItem>) => void;
  onSelectSKU: (sku: SKUOption) => void;
  onRemove: () => void;
}) {
  const [skuSearch, setSkuSearch] = useState('');
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);

  // Filter SKUs by product type and search
  const filteredSKUs = useMemo(() => {
    return allSKUs
      .filter(sku => sku.product_type_id === item.productTypeId)
      .filter(sku =>
        sku.sku_code.toLowerCase().includes(skuSearch.toLowerCase()) ||
        sku.sku_name.toLowerCase().includes(skuSearch.toLowerCase())
      )
      .slice(0, 10);
  }, [allSKUs, item.productTypeId, skuSearch]);

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {item.skuCode || 'Select SKU'}
            </div>
            <div className="text-xs text-gray-500">
              {item.netLength} ft net • {item.numberOfLines} line{item.numberOfLines !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-white border-t border-gray-200">
          {/* Product Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
            <select
              value={item.productTypeId}
              onChange={(e) => {
                const type = productTypes.find(t => t.id === e.target.value);
                onUpdate({
                  productTypeId: e.target.value,
                  productTypeName: type?.name || '',
                  skuId: '',
                  skuCode: '',
                  skuName: '',
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {productTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* SKU Search */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={showSkuDropdown ? skuSearch : (item.skuCode ? `${item.skuCode} - ${item.skuName}` : '')}
                onChange={(e) => setSkuSearch(e.target.value)}
                onFocus={() => { setShowSkuDropdown(true); setSkuSearch(''); }}
                onBlur={() => setTimeout(() => setShowSkuDropdown(false), 200)}
                placeholder="Search SKU..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {showSkuDropdown && filteredSKUs.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSKUs.map(sku => (
                  <div
                    key={sku.id}
                    onMouseDown={() => {
                      onSelectSKU(sku);
                      setShowSkuDropdown(false);
                      setSkuSearch('');
                    }}
                    className="px-3 py-2 cursor-pointer hover:bg-purple-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="font-mono text-sm font-medium">{sku.sku_code}</div>
                    <div className="text-xs text-gray-500 truncate">{sku.sku_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Footage</label>
              <input
                type="number"
                value={item.totalFootage}
                onChange={(e) => onUpdate({ totalFootage: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Buffer</label>
              <input
                type="number"
                value={item.buffer}
                onChange={(e) => onUpdate({ buffer: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Net</label>
              <input
                type="number"
                value={item.netLength}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Lines</label>
              <select
                value={item.numberOfLines}
                onChange={(e) => onUpdate({ numberOfLines: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Gates</label>
              <select
                value={item.numberOfGates}
                onChange={(e) => onUpdate({ numberOfGates: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
