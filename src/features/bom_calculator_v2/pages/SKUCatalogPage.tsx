/**
 * SKU Catalog Page - v2
 *
 * Browse all SKUs across product types with unified view.
 * Uses the new component-based SKU architecture.
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Pencil, Info, Package, Archive, ArchiveRestore } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useProductTypes } from '../hooks';

// SKU row for table display
interface SKURow {
  id: string;
  sku_code: string;
  sku_name: string;
  product_type_id: string;
  product_type_name: string;
  product_type_code: string;
  product_style_name: string;
  height: number;
  post_type: 'WOOD' | 'STEEL';
  post_spacing: number | null;
  material_cost_per_foot: number;
  labor_cost_per_foot: number;
  total_cost_per_foot: number;
  is_active: boolean;
  archived_at: string | null;
  calculated_at: string | null;
}

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
}

interface SKUCatalogPageProps {
  onEditSKU?: (skuId: string) => void;
  isAdmin?: boolean;
}

export function SKUCatalogPage({ onEditSKU, isAdmin = false }: SKUCatalogPageProps) {
  const queryClient = useQueryClient();

  // Filters
  const [businessUnitId, setBusinessUnitId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [heightFilter, setHeightFilter] = useState<string>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Fetch product types for filter dropdown
  const { data: productTypes = [] } = useProductTypes();

  // Fetch business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units-v2'],
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

  // Fetch all SKUs with product type and style info
  const { data: skus = [], isLoading: loadingSKUs } = useQuery({
    queryKey: ['product-skus-catalog-v2', showArchived],
    queryFn: async () => {
      let query = supabase
        .from('product_skus')
        .select(`
          id,
          sku_code,
          sku_name,
          product_type_id,
          height,
          post_type,
          post_spacing,
          standard_material_cost,
          standard_labor_cost,
          standard_cost_per_foot,
          standard_cost_calculated_at,
          is_active,
          archived_at,
          product_type:product_types(id, code, name),
          product_style:product_styles(code, name)
        `)
        .eq('is_active', true);

      // Filter by archived status
      if (!showArchived) {
        query = query.is('archived_at', null);
      }

      const { data, error } = await query.order('sku_code');

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch labor costs for selected business unit
  const { data: laborCosts = [] } = useQuery({
    queryKey: ['sku-labor-costs-v2', businessUnitId],
    queryFn: async () => {
      if (!businessUnitId) return [];
      const { data, error } = await supabase
        .from('sku_labor_costs')
        .select('product_type, product_id, labor_cost_per_foot')
        .eq('business_unit_id', businessUnitId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessUnitId,
  });

  // Create labor cost lookup map
  const laborCostMap = useMemo(() => {
    const map = new Map<string, number>();
    laborCosts.forEach((lc: { product_type: string; product_id: string; labor_cost_per_foot: number }) => {
      // For v2, we'll use product_skus ID directly
      map.set(lc.product_id, lc.labor_cost_per_foot);
    });
    return map;
  }, [laborCosts]);

  // Transform SKUs into table rows
  const allRows: SKURow[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return skus.map((sku: any) => {
      const materialCostPerFoot = sku.standard_cost_per_foot || 0;
      const laborCostPerFoot = laborCostMap.get(sku.id) || 0;

      // Handle both single object and array from Supabase join
      const productType = Array.isArray(sku.product_type) ? sku.product_type[0] : sku.product_type;
      const productStyle = Array.isArray(sku.product_style) ? sku.product_style[0] : sku.product_style;

      return {
        id: sku.id,
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        product_type_id: sku.product_type_id,
        product_type_name: productType?.name || 'Unknown',
        product_type_code: productType?.code || '',
        product_style_name: productStyle?.name || '-',
        height: sku.height,
        post_type: sku.post_type,
        post_spacing: sku.post_spacing,
        material_cost_per_foot: materialCostPerFoot,
        labor_cost_per_foot: laborCostPerFoot,
        total_cost_per_foot: materialCostPerFoot + laborCostPerFoot,
        is_active: sku.is_active,
        archived_at: sku.archived_at,
        calculated_at: sku.standard_cost_calculated_at,
      };
    });
  }, [skus, laborCostMap]);

  // Archive/Restore handlers
  const handleArchive = async (skuId: string, skuCode: string) => {
    if (!confirm(`Archive SKU ${skuCode}? It will be hidden from the BOM Calculator.`)) return;

    const { error } = await supabase
      .from('product_skus')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', skuId);

    if (error) {
      toast.error('Failed to archive SKU');
      console.error(error);
      return;
    }

    toast.success(`SKU ${skuCode} archived`);
    queryClient.invalidateQueries({ queryKey: ['product-skus-catalog-v2'] });
  };

  const handleRestore = async (skuId: string, skuCode: string) => {
    const { error } = await supabase
      .from('product_skus')
      .update({ archived_at: null })
      .eq('id', skuId);

    if (error) {
      toast.error('Failed to restore SKU');
      console.error(error);
      return;
    }

    toast.success(`SKU ${skuCode} restored`);
    queryClient.invalidateQueries({ queryKey: ['product-skus-catalog-v2'] });
  };

  // Get unique heights for filter dropdown
  const uniqueHeights = useMemo(() => {
    const heights = new Set<number>();
    allRows.forEach(r => heights.add(r.height));
    return Array.from(heights).sort((a, b) => a - b);
  }, [allRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (productTypeFilter !== 'all' && row.product_type_id !== productTypeFilter) return false;
      if (heightFilter !== 'all' && row.height !== Number(heightFilter)) return false;
      if (postTypeFilter !== 'all' && row.post_type !== postTypeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.sku_code.toLowerCase().includes(term) ||
          row.sku_name.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [allRows, productTypeFilter, heightFilter, postTypeFilter, searchTerm]);

  // Calculate stats
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
    setProductTypeFilter('all');
    setHeightFilter('all');
    setPostTypeFilter('all');
  };

  const hasFilters = searchTerm || productTypeFilter !== 'all' || heightFilter !== 'all' || postTypeFilter !== 'all';

  // Format currency
  const formatCurrency = (num: number): string => {
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Product type badge colors
  const getTypeBadge = (code: string) => {
    switch (code) {
      case 'wood-vertical':
        return 'bg-green-100 text-green-800';
      case 'wood-horizontal':
        return 'bg-blue-100 text-blue-800';
      case 'iron':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-purple-100 text-purple-800';
    }
  };

  // Handle row click
  const handleRowClick = (row: SKURow) => {
    if (onEditSKU && isAdmin) {
      onEditSKU(row.id);
    }
  };

  if (loadingSKUs) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading SKU catalog...</p>
        </div>
      </div>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No SKUs Found</h2>
          <p className="text-gray-600 mb-4">
            No product SKUs have been created yet. Use the SKU Builder to create new SKUs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">SKU Catalog</h1>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5" />
              <span>Costs based on 100ft, 1 line</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Business Unit - for labor cost display */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Labor Rates (BU)</label>
            <select
              value={businessUnitId}
              onChange={(e) => setBusinessUnitId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-48"
            >
              {businessUnits.map((bu: BusinessUnit) => (
                <option key={bu.id} value={bu.id}>{bu.code} - {bu.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="SKU or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-44"
              />
            </div>
          </div>

          {/* Product Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-40"
            >
              <option value="all">All Types</option>
              {productTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>

          {/* Height Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
            <select
              value={heightFilter}
              onChange={(e) => setHeightFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-28"
            >
              <option value="all">All</option>
              {uniqueHeights.map(h => (
                <option key={h} value={h}>{h}'</option>
              ))}
            </select>
          </div>

          {/* Post Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Post Type</label>
            <select
              value={postTypeFilter}
              onChange={(e) => setPostTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-28"
            >
              <option value="all">All</option>
              <option value="WOOD">Wood</option>
              <option value="STEEL">Steel</option>
            </select>
          </div>

          {/* Show Archived Toggle (Admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Archived</label>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  showArchived
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Archive className="w-4 h-4" />
                {showArchived ? 'Showing Archived' : 'Show Archived'}
              </button>
            </div>
          )}

          {/* Clear Filters */}
          {hasFilters && (
            <div className="ml-auto">
              <label className="block text-xs font-medium text-transparent mb-1">Clear</label>
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-gray-500 uppercase">Total SKUs</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-gray-500 uppercase">With Costs</div>
            <div className="text-2xl font-bold text-blue-600">{stats.withCosts}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-gray-500 uppercase">Avg Material/FT</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.avgMaterialPerFoot)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-gray-500 uppercase">Avg Labor/FT</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.avgLaborPerFoot)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-gray-500 uppercase">Avg $/FT</div>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.avgCostPerFoot)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-xs text-gray-500 uppercase">
              <th className="text-left py-3 px-4 font-medium">SKU</th>
              <th className="text-left py-3 px-4 font-medium">Name</th>
              <th className="text-left py-3 px-4 font-medium">Type</th>
              <th className="text-left py-3 px-4 font-medium">Style</th>
              <th className="text-center py-3 px-4 font-medium">Height</th>
              <th className="text-center py-3 px-4 font-medium">Post</th>
              <th className="text-right py-3 px-4 font-medium">Material/FT</th>
              <th className="text-right py-3 px-4 font-medium">Labor/FT</th>
              <th className="text-right py-3 px-4 font-medium bg-yellow-50">$/FT</th>
              {isAdmin && <th className="text-center py-3 px-2 font-medium w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-gray-50 ${isAdmin && onEditSKU ? 'cursor-pointer' : ''} ${row.archived_at ? 'bg-amber-50/50' : ''}`}
                onClick={() => handleRowClick(row)}
              >
                <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                  <span className="flex items-center gap-2">
                    {row.sku_code}
                    {row.archived_at && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Archived</span>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-700 max-w-[200px] truncate" title={row.sku_name}>
                  {row.sku_name}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTypeBadge(row.product_type_code)}`}>
                    {row.product_type_name}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600">{row.product_style_name}</td>
                <td className="py-3 px-4 text-center text-gray-600">{row.height}'</td>
                <td className="py-3 px-4 text-center text-gray-600">{row.post_type}</td>
                <td className={`py-3 px-4 text-right ${row.material_cost_per_foot > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.material_cost_per_foot)}
                </td>
                <td className={`py-3 px-4 text-right ${row.labor_cost_per_foot > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                  {formatCurrency(row.labor_cost_per_foot)}
                </td>
                <td className={`py-3 px-4 text-right font-semibold bg-yellow-50 ${row.total_cost_per_foot > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {formatCurrency(row.total_cost_per_foot)}
                </td>
                {isAdmin && (
                  <td className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(row);
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Edit in SKU Builder"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {row.archived_at ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(row.id, row.sku_code);
                          }}
                          className="p-1.5 text-amber-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Restore SKU"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(row.id, row.sku_code);
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Archive SKU"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
