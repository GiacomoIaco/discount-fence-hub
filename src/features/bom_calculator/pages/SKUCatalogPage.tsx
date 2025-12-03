import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, X, Pencil } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';

// Extended interfaces with cost fields
interface WoodVerticalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  rail_count: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  post_material_id: string | null;
  picket_material_id: string | null;
  rail_material_id: string | null;
  cap_material_id: string | null;
  trim_material_id: string | null;
}

interface WoodHorizontalProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  style: string;
  post_spacing: number;
  board_width_actual: number;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  post_material_id: string | null;
  board_material_id: string | null;
  nailer_material_id: string | null;
  cap_material_id: string | null;
}

interface IronProduct {
  id: string;
  sku_code: string;
  sku_name: string;
  height: number;
  post_type: string;
  style: string;
  panel_width: number;
  rails_per_panel: number;
  is_active: boolean;
  standard_material_cost: number | null;
  standard_labor_cost: number | null;
  standard_cost_per_foot: number | null;
  post_material_id: string | null;
  panel_material_id: string | null;
}

// Unified SKU row for table display
interface SKURow {
  id: string;
  sku_code: string;
  sku_name: string;
  category: 'Wood Vertical' | 'Wood Horizontal' | 'Iron' | 'Other';
  categoryKey: 'wood-vertical' | 'wood-horizontal' | 'iron';
  style: string;
  height: number;
  rails: number | null;
  post_type: string;
  material_cost: number;
  labor_cost: number;
  total_cost: number;
  cost_per_foot: number;
  is_active: boolean;
  // Original data for editing
  original: WoodVerticalProduct | WoodHorizontalProduct | IronProduct;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

type CategoryFilter = 'all' | 'wood-vertical' | 'wood-horizontal' | 'iron';
type StyleFilter = 'all' | string;
type HeightFilter = 'all' | number;

export default function SKUCatalogPage() {
  const queryClient = useQueryClient();

  // Filters
  const [businessUnitId, setBusinessUnitId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');
  const [heightFilter, setHeightFilter] = useState<HeightFilter>('all');

  // Edit modal
  const [editingSku, setEditingSku] = useState<SKURow | null>(null);

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

  // Fetch all products
  const { data: woodVertical = [], isLoading: loadingWV } = useQuery({
    queryKey: ['wood-vertical-products-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wood_vertical_products')
        .select('*')
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
        .select('*')
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
        .select('*')
        .order('sku_code');
      if (error) throw error;
      return data as IronProduct[];
    },
  });

  const isLoading = loadingWV || loadingWH || loadingIron;

  // Combine all products into unified rows
  const allRows: SKURow[] = useMemo(() => {
    const rows: SKURow[] = [];

    woodVertical.forEach(p => {
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
        material_cost: p.standard_material_cost || 0,
        labor_cost: p.standard_labor_cost || 0,
        total_cost: (p.standard_material_cost || 0) + (p.standard_labor_cost || 0),
        cost_per_foot: p.standard_cost_per_foot || 0,
        is_active: p.is_active,
        original: p,
      });
    });

    woodHorizontal.forEach(p => {
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
        material_cost: p.standard_material_cost || 0,
        labor_cost: p.standard_labor_cost || 0,
        total_cost: (p.standard_material_cost || 0) + (p.standard_labor_cost || 0),
        cost_per_foot: p.standard_cost_per_foot || 0,
        is_active: p.is_active,
        original: p,
      });
    });

    iron.forEach(p => {
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
        material_cost: p.standard_material_cost || 0,
        labor_cost: p.standard_labor_cost || 0,
        total_cost: (p.standard_material_cost || 0) + (p.standard_labor_cost || 0),
        cost_per_foot: p.standard_cost_per_foot || 0,
        is_active: p.is_active,
        original: p,
      });
    });

    return rows.sort((a, b) => a.sku_code.localeCompare(b.sku_code));
  }, [woodVertical, woodHorizontal, iron]);

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
    allRows.forEach(r => heights.add(r.height));
    return Array.from(heights).sort((a, b) => a - b);
  }, [allRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      // Category filter
      if (categoryFilter !== 'all' && row.categoryKey !== categoryFilter) return false;

      // Style filter
      if (styleFilter !== 'all' && row.style !== styleFilter) return false;

      // Height filter
      if (heightFilter !== 'all' && row.height !== heightFilter) return false;

      // Search filter
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

  // Calculate stats
  const stats = useMemo(() => {
    const rowsWithCosts = filteredRows.filter(r => r.cost_per_foot > 0);
    const totalMaterial = rowsWithCosts.reduce((sum, r) => sum + r.material_cost, 0);
    const totalLabor = rowsWithCosts.reduce((sum, r) => sum + r.labor_cost, 0);
    const totalCostPerFoot = rowsWithCosts.reduce((sum, r) => sum + r.cost_per_foot, 0);

    return {
      total: filteredRows.length,
      withCosts: rowsWithCosts.length,
      avgMaterial: rowsWithCosts.length > 0 ? totalMaterial / rowsWithCosts.length : 0,
      avgLabor: rowsWithCosts.length > 0 ? totalLabor / rowsWithCosts.length : 0,
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
      default:
        return 'bg-yellow-100 text-yellow-800';
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
      {/* Filters Row */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Business Unit */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Business Unit</label>
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
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg Material</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.avgMaterial)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg Labor</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.avgLabor)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <div className="text-[10px] font-medium text-gray-500 uppercase">Avg $/Foot</div>
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
              <th className="text-right py-2 px-3 font-medium">Material</th>
              <th className="text-right py-2 px-3 font-medium">Labor</th>
              <th className="text-right py-2 px-3 font-medium bg-yellow-50">Total</th>
              <th className="text-right py-2 px-3 font-medium bg-yellow-50">$/Foot</th>
              <th className="text-center py-2 px-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row) => (
              <tr
                key={`${row.categoryKey}-${row.id}`}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setEditingSku(row)}
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
                <td className="py-2 px-3 text-center text-gray-600">{row.height}'</td>
                <td className="py-2 px-3 text-center text-gray-600">{row.rails ?? '-'}</td>
                <td className="py-2 px-3 text-center text-gray-600">{row.post_type}</td>
                <td className={`py-2 px-3 text-right ${row.material_cost > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.material_cost)}
                </td>
                <td className={`py-2 px-3 text-right ${row.labor_cost > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.labor_cost)}
                </td>
                <td className={`py-2 px-3 text-right font-medium bg-yellow-50 ${row.total_cost > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatCurrency(row.total_cost)}
                </td>
                <td className={`py-2 px-3 text-right font-medium bg-yellow-50 ${row.cost_per_foot > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatCurrency(row.cost_per_foot)}
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSku(row);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit SKU"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
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

      {/* Edit Modal */}
      {editingSku && (
        <SKUEditModal
          sku={editingSku}
          onClose={() => setEditingSku(null)}
          onSaved={() => {
            setEditingSku(null);
            queryClient.invalidateQueries({ queryKey: ['wood-vertical-products-catalog'] });
            queryClient.invalidateQueries({ queryKey: ['wood-horizontal-products-catalog'] });
            queryClient.invalidateQueries({ queryKey: ['iron-products-catalog'] });
          }}
        />
      )}
    </div>
  );
}

// Edit Modal Component
function SKUEditModal({
  sku,
  onClose,
  onSaved,
}: {
  sku: SKURow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [skuName, setSkuName] = useState(sku.sku_name);
  const [isActive, setIsActive] = useState(sku.is_active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      let table = '';
      if (sku.categoryKey === 'wood-vertical') table = 'wood_vertical_products';
      else if (sku.categoryKey === 'wood-horizontal') table = 'wood_horizontal_products';
      else table = 'iron_products';

      const { error } = await supabase
        .from(table)
        .update({
          sku_name: skuName,
          is_active: isActive,
        })
        .eq('id', sku.id);

      if (error) throw error;
      showSuccess('SKU updated successfully');
      onSaved();
    } catch (err) {
      showError('Failed to update SKU');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete SKU "${sku.sku_code}"?`)) return;

    setSaving(true);
    try {
      let table = '';
      if (sku.categoryKey === 'wood-vertical') table = 'wood_vertical_products';
      else if (sku.categoryKey === 'wood-horizontal') table = 'wood_horizontal_products';
      else table = 'iron_products';

      const { error } = await supabase.from(table).delete().eq('id', sku.id);
      if (error) throw error;
      showSuccess('SKU deleted');
      onSaved();
    } catch (err) {
      showError('Failed to delete SKU');
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const fmt = (num: number) => '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit SKU</h2>
            <p className="text-sm text-gray-500">{sku.sku_code} · {sku.category}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* SKU Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU Name</label>
            <input
              type="text"
              value={skuName}
              onChange={(e) => setSkuName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Details (Read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Style</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{sku.style}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{sku.height}'</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Post Type</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{sku.post_type}</div>
            </div>
            {sku.rails !== null && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rails</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">{sku.rails}</div>
              </div>
            )}
          </div>

          {/* Costs */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Cost Estimates (100 ft)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Material Cost</div>
                <div className="text-lg font-semibold text-green-600">{fmt(sku.material_cost)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Labor Cost</div>
                <div className="text-lg font-semibold text-purple-600">{fmt(sku.labor_cost)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Cost</div>
                <div className="text-lg font-semibold text-gray-900">{fmt(sku.total_cost)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Cost per Foot</div>
                <div className="text-lg font-semibold text-amber-600">{fmt(sku.cost_per_foot)}</div>
              </div>
            </div>
            {sku.cost_per_foot === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                No cost data. Open in SKU Builder to configure materials and calculate costs.
              </p>
            )}
          </div>

          {/* Active Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">Active (visible in calculator)</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Delete SKU
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors disabled:bg-gray-400 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
