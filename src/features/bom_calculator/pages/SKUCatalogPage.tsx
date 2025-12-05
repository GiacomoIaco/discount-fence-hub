import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, RefreshCw, Pencil, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { recalculateAllSKUs, SKU_STANDARD_ASSUMPTIONS } from '../services/recalculateSKUs';
import type { SelectedSKU } from '../BOMCalculatorHub';

// Product interfaces with cost fields
interface WoodVerticalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  rail_count: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;
}

interface WoodHorizontalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;
}

interface IronProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  style: string;
  rails_per_panel: number;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_cost_per_foot: number | null;
  standard_cost_calculated_at: string | null;
}

interface CustomProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  unit_basis: 'LF' | 'SF' | 'EA' | 'PROJECT';
  category: string | null;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_unit: number | null;
  standard_cost_calculated_at: string | null;
}

// Labor cost from junction table
interface SKULaborCost {
  product_type: 'wood-vertical' | 'wood-horizontal' | 'iron';
  product_id: string;
  business_unit_id: string;
  labor_cost: number;
  labor_cost_per_foot: number;
}

// Unified SKU row for table display (with per-foot costs)
interface SKURow {
  id: string;
  sku_code: string;
  sku_name: string;
  category: 'Wood Vertical' | 'Wood Horizontal' | 'Iron' | 'Custom';
  categoryKey: 'wood-vertical' | 'wood-horizontal' | 'iron' | 'custom';
  style: string;
  height: number | null;
  rails: number | null;
  post_type: string | null;
  unit_basis: string | null;
  material_cost_per_foot: number;
  labor_cost_per_foot: number;
  total_cost_per_foot: number;
  is_active: boolean;
  calculated_at: string | null;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

interface SKUCatalogPageProps {
  onEditSKU: (sku: SelectedSKU) => void;
  isAdmin: boolean;
}

type CategoryFilter = 'all' | 'wood-vertical' | 'wood-horizontal' | 'iron' | 'custom';
type StyleFilter = 'all' | string;
type HeightFilter = 'all' | number;

export default function SKUCatalogPage({ onEditSKU, isAdmin }: SKUCatalogPageProps) {
  const queryClient = useQueryClient();

  // Filters
  const [businessUnitId, setBusinessUnitId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');
  const [heightFilter, setHeightFilter] = useState<HeightFilter>('all');

  // Recalculation state
  const [recalculating, setRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState({ current: 0, total: 0, phase: '' });

  // Fetch business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      if (data && data.length > 0 && !businessUnitId) {
        setBusinessUnitId(data[0].id);
      }
      return data as BusinessUnit[];
    },
  });

  // Fetch labor costs for selected business unit from junction table
  const { data: laborCosts = [] } = useQuery({
    queryKey: ['sku-labor-costs', businessUnitId],
    queryFn: async () => {
      if (!businessUnitId) return [];
      const { data, error } = await supabase
        .from('sku_labor_costs')
        .select('product_type, product_id, business_unit_id, labor_cost, labor_cost_per_foot')
        .eq('business_unit_id', businessUnitId);
      if (error) throw error;
      return (data || []) as SKULaborCost[];
    },
    enabled: !!businessUnitId,
  });

  // Create a lookup map for labor costs
  const laborCostMap = useMemo(() => {
    const map = new Map<string, number>();
    laborCosts.forEach(lc => {
      const key = `${lc.product_type}:${lc.product_id}`;
      map.set(key, lc.labor_cost_per_foot);
    });
    return map;
  }, [laborCosts]);

  // Fetch all Wood Vertical products
  const { data: woodVertical = [], isLoading: loadingWV } = useQuery({
    queryKey: ['wood-vertical-products-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wood_vertical_products')
        .select('id, sku_code, sku_name, height, rail_count, post_type, style, is_active, standard_material_cost, standard_cost_per_foot, standard_cost_calculated_at')
        .order('sku_code');
      if (error) throw error;
      return data as WoodVerticalProduct[];
    },
  });

  const { data: woodHorizontal = [], isLoading: loadingWH } = useQuery({
    queryKey: ['wood-horizontal-products-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wood_horizontal_products')
        .select('id, sku_code, sku_name, height, post_type, style, is_active, standard_material_cost, standard_cost_per_foot, standard_cost_calculated_at')
        .order('sku_code');
      if (error) throw error;
      return data as WoodHorizontalProduct[];
    },
  });

  const { data: iron = [], isLoading: loadingIron } = useQuery({
    queryKey: ['iron-products-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iron_products')
        .select('id, sku_code, sku_name, height, post_type, style, rails_per_panel, is_active, standard_material_cost, standard_cost_per_foot, standard_cost_calculated_at')
        .order('sku_code');
      if (error) throw error;
      return data as IronProduct[];
    },
  });

  const { data: custom = [], isLoading: loadingCustom } = useQuery({
    queryKey: ['custom-products-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_products')
        .select('id, sku_code, sku_name, unit_basis, category, is_active, standard_material_cost, standard_labor_cost, standard_cost_per_unit, standard_cost_calculated_at')
        .order('sku_code');
      if (error) throw error;
      return data as CustomProduct[];
    },
  });

  const isLoading = loadingWV || loadingWH || loadingIron || loadingCustom;

  // Combine all products into unified rows with labor from stored values
  const allRows: SKURow[] = useMemo(() => {
    const rows: SKURow[] = [];

    woodVertical.forEach(p => {
      const materialCostPerFoot = p.standard_cost_per_foot || 0;
      const laborCostPerFoot = laborCostMap.get(`wood-vertical:${p.id}`) || 0;

      rows.push({
        id: p.id,
        sku_code: p.sku_code,
        sku_name: p.sku_name,
        category: 'Wood Vertical',
        categoryKey: 'wood-vertical',
        style: p.style || '-',
        height: p.height,
        rails: p.rail_count,
        post_type: p.post_type,
        unit_basis: null,
        material_cost_per_foot: materialCostPerFoot,
        labor_cost_per_foot: laborCostPerFoot,
        total_cost_per_foot: materialCostPerFoot + laborCostPerFoot,
        is_active: p.is_active,
        calculated_at: p.standard_cost_calculated_at,
      });
    });

    woodHorizontal.forEach(p => {
      const materialCostPerFoot = p.standard_cost_per_foot || 0;
      const laborCostPerFoot = laborCostMap.get(`wood-horizontal:${p.id}`) || 0;

      rows.push({
        id: p.id,
        sku_code: p.sku_code,
        sku_name: p.sku_name,
        category: 'Wood Horizontal',
        categoryKey: 'wood-horizontal',
        style: p.style || '-',
        height: p.height,
        rails: null,
        post_type: p.post_type,
        unit_basis: null,
        material_cost_per_foot: materialCostPerFoot,
        labor_cost_per_foot: laborCostPerFoot,
        total_cost_per_foot: materialCostPerFoot + laborCostPerFoot,
        is_active: p.is_active,
        calculated_at: p.standard_cost_calculated_at,
      });
    });

    iron.forEach(p => {
      const materialCostPerFoot = p.standard_cost_per_foot || 0;
      const laborCostPerFoot = laborCostMap.get(`iron:${p.id}`) || 0;

      rows.push({
        id: p.id,
        sku_code: p.sku_code,
        sku_name: p.sku_name,
        category: 'Iron',
        categoryKey: 'iron',
        style: p.style || '-',
        height: p.height,
        rails: p.rails_per_panel,
        post_type: 'STEEL',
        unit_basis: null,
        material_cost_per_foot: materialCostPerFoot,
        labor_cost_per_foot: laborCostPerFoot,
        total_cost_per_foot: materialCostPerFoot + laborCostPerFoot,
        is_active: p.is_active,
        calculated_at: p.standard_cost_calculated_at,
      });
    });

    // Custom products (services, add-ons, repairs, etc.)
    custom.forEach(p => {
      const materialCost = p.standard_material_cost || 0;
      const laborCost = p.standard_labor_cost || 0;
      const totalCost = p.standard_cost_per_unit || (materialCost + laborCost);

      rows.push({
        id: p.id,
        sku_code: p.sku_code,
        sku_name: p.sku_name,
        category: 'Custom',
        categoryKey: 'custom',
        style: p.category || '-',
        height: null,
        rails: null,
        post_type: null,
        unit_basis: p.unit_basis,
        material_cost_per_foot: materialCost,
        labor_cost_per_foot: laborCost,
        total_cost_per_foot: totalCost,
        is_active: p.is_active,
        calculated_at: p.standard_cost_calculated_at,
      });
    });

    return rows.sort((a, b) => a.sku_code.localeCompare(b.sku_code));
  }, [woodVertical, woodHorizontal, iron, custom, laborCostMap]);

  // Get unique styles and heights for filter dropdowns
  const uniqueStyles = useMemo(() => {
    const styles = new Set<string>();
    allRows.forEach(r => {
      if (r.style && r.style !== '-') styles.add(r.style);
    });
    return Array.from(styles).sort();
  }, [allRows]);

  const uniqueHeights = useMemo(() => {
    const heights = new Set<number>();
    allRows.forEach(r => {
      if (r.height !== null) heights.add(r.height);
    });
    return Array.from(heights).sort((a, b) => a - b);
  }, [allRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (categoryFilter !== 'all' && row.categoryKey !== categoryFilter) return false;
      if (styleFilter !== 'all' && row.style !== styleFilter) return false;
      if (heightFilter !== 'all' && row.height !== heightFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.sku_code.toLowerCase().includes(term) ||
          row.sku_name.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [allRows, categoryFilter, styleFilter, heightFilter, searchTerm]);

  // Calculate stats (all per-foot values)
  const stats = useMemo(() => {
    const rowsWithCosts = filteredRows.filter(r => r.total_cost_per_foot > 0);
    const totalMaterial = rowsWithCosts.reduce((sum, r) => sum + r.material_cost_per_foot, 0);
    const totalLabor = rowsWithCosts.reduce((sum, r) => sum + r.labor_cost_per_foot, 0);
    const totalCostPerFoot = rowsWithCosts.reduce((sum, r) => sum + r.total_cost_per_foot, 0);

    return {
      total: filteredRows.length,
      withCosts: rowsWithCosts.length,
      avgMaterialPerFoot: rowsWithCosts.length > 0 ? totalMaterial / rowsWithCosts.length : 0,
      avgLaborPerFoot: rowsWithCosts.length > 0 ? totalLabor / rowsWithCosts.length : 0,
      avgCostPerFoot: rowsWithCosts.length > 0 ? totalCostPerFoot / rowsWithCosts.length : 0,
    };
  }, [filteredRows]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStyleFilter('all');
    setHeightFilter('all');
  };

  const hasFilters = searchTerm || categoryFilter !== 'all' || styleFilter !== 'all' || heightFilter !== 'all';

  // Format number with commas
  const formatCurrency = (num: number): string => {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Category badge colors
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Wood Vertical':
        return 'bg-green-100 text-green-800';
      case 'Wood Horizontal':
        return 'bg-blue-100 text-blue-800';
      case 'Iron':
        return 'bg-gray-200 text-gray-800';
      case 'Custom':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Handle row click - navigate to SKU Builder
  const handleRowClick = (row: SKURow) => {
    if (!isAdmin) {
      showError('Admin access required to edit SKUs');
      return;
    }
    onEditSKU({
      id: row.id,
      type: row.categoryKey,
      skuCode: row.sku_code,
    });
  };

  // Recalculate all SKUs (materials + labor for all BUs)
  const handleRecalculateAll = async () => {
    if (!confirm(`Recalculate costs for all SKUs?\n\nThis will update:\n• Material costs (universal)\n• Labor costs (for all ${businessUnits.length} business units)`)) {
      return;
    }

    setRecalculating(true);
    setRecalcProgress({ current: 0, total: 0, phase: 'Starting...' });

    try {
      const result = await recalculateAllSKUs(
        (current, total, phase) => setRecalcProgress({ current, total, phase })
      );

      if (result.success) {
        showSuccess(`Updated ${result.updatedMaterials} materials, ${result.updatedLabor} labor costs`);
      } else {
        showSuccess(`Updated ${result.updatedMaterials} materials, ${result.updatedLabor} labor costs (${result.errors.length} errors)`);
        console.error('Recalculation errors:', result.errors);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['wood-vertical-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['iron-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['sku-labor-costs'] });
    } catch (error) {
      console.error('Recalculation failed:', error);
      showError('Failed to recalculate SKUs');
    } finally {
      setRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading SKU catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header with title and Recalculate button */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">SKU Catalog</h1>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5" />
              <span>Costs based on {SKU_STANDARD_ASSUMPTIONS.netLength}ft, {SKU_STANDARD_ASSUMPTIONS.numberOfLines} lines</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={handleRecalculateAll}
              disabled={recalculating}
              className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium transition-colors disabled:bg-gray-400"
            >
              {recalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">{recalcProgress.current}/{recalcProgress.total}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Recalculate All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Business Unit - for labor cost display */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Labor Rates (BU)</label>
            <select
              value={businessUnitId}
              onChange={(e) => setBusinessUnitId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 w-44"
            >
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.code} - {bu.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="SKU or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 w-40"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 w-36"
            >
              <option value="all">All Categories</option>
              <option value="wood-vertical">Wood Vertical</option>
              <option value="wood-horizontal">Wood Horizontal</option>
              <option value="iron">Iron</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Style Filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Style</label>
            <select
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 w-36"
            >
              <option value="all">All Styles</option>
              {uniqueStyles.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Height Filter */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height</label>
            <select
              value={heightFilter}
              onChange={(e) => setHeightFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 w-28"
            >
              <option value="all">All Heights</option>
              {uniqueHeights.map(h => (
                <option key={h} value={h}>{h}'</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <div className="ml-auto">
              <label className="block text-[10px] font-medium text-transparent mb-0.5">Clear</label>
              <button
                onClick={clearFilters}
                className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Total SKUs</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">With Costs</div>
            <div className="text-2xl font-bold text-blue-600">{stats.withCosts}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg Material/FT</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.avgMaterialPerFoot)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg Labor/FT</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.avgLaborPerFoot)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg $/FT</div>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.avgCostPerFoot)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-xs text-gray-500 uppercase">
              <th className="text-left py-2 px-3 font-medium">SKU</th>
              <th className="text-left py-2 px-3 font-medium">Name</th>
              <th className="text-left py-2 px-3 font-medium">Category</th>
              <th className="text-left py-2 px-3 font-medium">Style</th>
              <th className="text-center py-2 px-3 font-medium">Height</th>
              <th className="text-center py-2 px-3 font-medium">Rails</th>
              <th className="text-center py-2 px-3 font-medium">Post</th>
              <th className="text-right py-2 px-3 font-medium">Material/FT</th>
              <th className="text-right py-2 px-3 font-medium">Labor/FT</th>
              <th className="text-right py-2 px-3 font-medium bg-yellow-50">$/FT</th>
              {isAdmin && <th className="text-center py-2 px-2 font-medium w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row) => (
              <tr
                key={`${row.categoryKey}-${row.id}`}
                className={`hover:bg-gray-50 ${isAdmin ? 'cursor-pointer' : ''}`}
                onClick={() => handleRowClick(row)}
              >
                <td className="py-2 px-3 font-mono font-semibold text-gray-900">{row.sku_code}</td>
                <td className="py-2 px-3 text-gray-700 max-w-[200px] truncate" title={row.sku_name}>
                  {row.sku_name}
                </td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCategoryBadge(row.category)}`}>
                    {row.category}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-600">{row.style}</td>
                <td className="py-2 px-3 text-center text-gray-600">
                  {row.height !== null ? `${row.height}'` : (row.unit_basis || '-')}
                </td>
                <td className="py-2 px-3 text-center text-gray-600">{row.rails ?? '-'}</td>
                <td className="py-2 px-3 text-center text-gray-600">{row.post_type ?? '-'}</td>
                <td className={`py-2 px-3 text-right ${row.material_cost_per_foot > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.material_cost_per_foot)}
                </td>
                <td className={`py-2 px-3 text-right ${row.labor_cost_per_foot > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.labor_cost_per_foot)}
                </td>
                <td className={`py-2 px-3 text-right font-semibold bg-yellow-50 ${row.total_cost_per_foot > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatCurrency(row.total_cost_per_foot)}
                </td>
                {isAdmin && (
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(row);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit in SKU Builder"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No SKUs match the selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
