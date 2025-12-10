/**
 * SKU Catalog Page - v2
 *
 * Browse all SKUs from sku_catalog_v2 (formula-based architecture).
 * Uses the V2 tables with JSONB for variables and components.
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Pencil, Info, Package, Archive } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useProductTypesV2, useSKUCatalogV2, type SKUCatalogV2WithRelations } from '../hooks';

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
  rail_count: number | null;
  material_cost_per_foot: number;
  labor_cost_per_foot: number;
  total_cost_per_foot: number;
  is_active: boolean;
  calculated_at: string | null;
}

interface SKUCatalogPageProps {
  onEditSKU?: (skuId: string) => void;
  isAdmin?: boolean;
}

export function SKUCatalogPage({ onEditSKU, isAdmin = false }: SKUCatalogPageProps) {
  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [heightFilter, setHeightFilter] = useState<string>('all');
  const [postTypeFilter, setPostTypeFilter] = useState<string>('all');

  // Fetch product types for filter dropdown (V2)
  const { data: productTypes = [] } = useProductTypesV2();

  // Fetch all SKUs from sku_catalog_v2
  const { data: skus = [], isLoading: loadingSKUs } = useSKUCatalogV2();

  // Transform SKUs into table rows
  const allRows: SKURow[] = useMemo(() => {
    return skus.map((sku: SKUCatalogV2WithRelations) => {
      const materialCostPerFoot = sku.standard_cost_per_foot || 0;
      const laborCostPerFoot = sku.standard_labor_cost ? sku.standard_labor_cost / 100 : 0; // Assume per 100ft

      // Get variables from JSONB
      const variables = sku.variables || {};

      return {
        id: sku.id,
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        product_type_id: sku.product_type_id,
        product_type_name: sku.product_type?.name || 'Unknown',
        product_type_code: sku.product_type?.code || '',
        product_style_name: sku.product_style?.name || '-',
        height: sku.height,
        post_type: sku.post_type,
        post_spacing: typeof variables.post_spacing === 'number' ? variables.post_spacing : null,
        rail_count: typeof variables.rail_count === 'number' ? variables.rail_count : null,
        material_cost_per_foot: materialCostPerFoot,
        labor_cost_per_foot: laborCostPerFoot,
        total_cost_per_foot: materialCostPerFoot + laborCostPerFoot,
        is_active: sku.is_active,
        calculated_at: sku.standard_cost_calculated_at,
      };
    });
  }, [skus]);

  // Delete handler (soft delete via is_active)
  const handleDelete = async (skuId: string, skuCode: string) => {
    if (!confirm(`Delete SKU ${skuCode}? This will hide it from the catalog.`)) return;

    const { error } = await supabase
      .from('sku_catalog_v2')
      .update({ is_active: false })
      .eq('id', skuId);

    if (error) {
      toast.error('Failed to delete SKU');
      console.error(error);
      return;
    }

    toast.success(`SKU ${skuCode} deleted`);
    queryClient.invalidateQueries({ queryKey: ['sku-catalog-v2'] });
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
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-48"
              />
            </div>
          </div>

          {/* Product Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Product Type</label>
            <select
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 w-44"
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
                className={`hover:bg-gray-50 ${isAdmin && onEditSKU ? 'cursor-pointer' : ''}`}
                onClick={() => handleRowClick(row)}
              >
                <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                  {row.sku_code}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(row.id, row.sku_code);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete SKU"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
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
